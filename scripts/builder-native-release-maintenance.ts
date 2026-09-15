/** Called inside the configured deployment service's outer lock and native
 * operation. Never treats a partially removed release as a publication target. */
import { lstat, opendir } from "node:fs/promises";
import path from "node:path";
import {
  generatedAge,
  inventoryGeneratedTree,
  removeGeneratedEntries,
} from "./release-generated-files.mjs";
import {
  assertRetirementOperation,
  assertRetirementRecovery,
  retireRelease,
} from "./builder-release-retention";
import { ReleaseRetirementState } from "./release-retirement-state.mjs";
import { releaseRetentionPolicy } from "./release-retention.mjs";
import { inspectProcessLock } from "./release-recovery.mjs";
import { readReleaseSelection, reconcileRelease } from "./kaizen-releases.mjs";
import { assertNativeRelease } from "./builder-native-release-guard.mjs";
import type { NativeFileProtection } from "./builder-native-operations";
import type { NativeOperationController } from "./builder-native-controller";

type Input = {
  environment: NodeJS.ProcessEnv;
  nativeFiles: NativeFileProtection;
  controller: NativeOperationController;
  connection: {
    rpc: (name: string, input: Record<string, unknown>) => Promise<any>;
    get?: (id: string) => Promise<any>;
  };
  recoverOnly?: boolean;
};
type Adapters = Parameters<typeof retireRelease>[1] & {
  validateConfig?: () => Promise<void>;
  reload?: () => Promise<void>;
};

export async function maintainNativeReleases(
  input: Input,
  adapters: Adapters = {},
) {
  const env = input.environment;
  if (![undefined, "0", "1"].includes(env.BUILDER_RELEASE_RETENTION_ENABLED))
    throw new Error("Configure release retention as 0 or 1.");
  if (!["main", "stage"].includes(env.KAIZEN_DEPLOY_BRANCH || ""))
    throw new Error("Configure the fixed repository release destination.");
  const options = {
    store: env.KAIZEN_RELEASE_STORE || "",
    origin: `https://${env.KAIZEN_PUBLIC_DOMAIN || ""}`,
    projectId: env.BUILDER_RELEASE_PROJECT_ID || "",
    scope:
      env.KAIZEN_DEPLOY_BRANCH === "main"
        ? "repository:production"
        : "repository:staging",
    workerId: env.BUILDER_NATIVE_WORKER_ID || "",
    connection: input.connection,
    nativeFiles: input.nativeFiles,
    controller: input.controller,
    retention: releaseRetentionPolicy(env),
  };
  const { operation } = assertRetirementOperation(options);
  if (
    operation.workerId !== options.workerId ||
    operation.configuration !== env.BUILDER_NATIVE_CONFIGURATION
  )
    throw new Error(
      "Release maintenance must use its configured native worker.",
    );
  const state = new ReleaseRetirementState(options.store);
  const saved = await state.peek();
  if (
    saved &&
    !["projectId", "scope", "workerId", "origin"].every(
      (key) => saved.binding[key] === options[key as keyof typeof options],
    )
  )
    throw new Error("Release maintenance cannot reassign an existing store.");
  if (saved?.attempt) {
    try {
      await assertRetirementRecovery(options, saved.attempt.owner);
      const lock = await inspectProcessLock(
        path.join(options.store, ".activation-lock"),
      );
      if (
        lock &&
        (lock.owner.pid !== saved.attempt.owner.operation.processId ||
          lock.owner.host !== saved.attempt.owner.operation.host)
      )
        throw new Error(
          "The activation lock belongs to another operation. Reconcile that publication first.",
        );
      // Read only the selected artifact: listing every manifest would fail on
      // the intentionally partial retirement target after a killed service.
      const selected = await readReleaseSelection(options.store);
      if (!selected || selected.id === saved.attempt.artifactId)
        throw new Error(
          "The retirement target is selected or the serving state is unknown.",
        );
      await reconcileRelease(
        { store: options.store, id: selected.id, origin: options.origin },
        {
          ...adapters,
          beforeReconcile: (manifest: any) =>
            assertNativeRelease(options, manifest),
        },
      );
    } catch (error) {
      input.nativeFiles.retainOperation();
      throw error;
    }
  } else if (
    input.recoverOnly ||
    env.BUILDER_RELEASE_RETENTION_ENABLED !== "1"
  ) {
    return { phase: "disabled" };
  }
  // Turning off new retirement must still finish the exact previously owned
  // operation; otherwise a partially deleted release would remain stranded.
  const newWork =
    !input.recoverOnly && env.BUILDER_RELEASE_RETENTION_ENABLED === "1";
  const result = await retireRelease(options, {
    ...adapters,
    reclaimGenerated: newWork,
  });
  if (!newWork || typeof input.connection.get !== "function") return result;
  const requests = await reclaimNativeRequests(
    options.store,
    input.connection.get,
    (adapters.now || Date.now)(),
    options.retention,
  );
  return requests.removed ? { ...result, requests } : result;
}

/** Build inputs written under the deployment lock this invocation holds. Only
 * a finished database release, past visitor grace, gives up its snapshot. */
export async function reclaimNativeRequests(
  store: string,
  get: (id: string) => Promise<any>,
  now: number,
  policy: { visitorGraceDays: number },
) {
  const directory = path.join(store, "requests"),
    summary = { removed: 0, bytes: 0 };
  if (
    !(await lstat(directory).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }))
  )
    return summary;
  const names: string[] = [];
  for await (const entry of await opendir(directory)) {
    if (names.length >= 10000) break;
    names.push(entry.name);
  }
  for (const name of names.sort()) {
    if (summary.removed >= 1000) break;
    const match =
      /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/.exec(
        name,
      );
    if (!match) continue;
    const [file] = await inventoryGeneratedTree(store, `requests/${name}`);
    if (
      file.type !== "file" ||
      generatedAge(file.identity, now) < policy.visitorGraceDays * 86400000
    )
      continue;
    let release;
    try {
      release = await get(match[1]);
    } catch {
      continue; // An unavailable or missing record keeps the snapshot.
    }
    if (!["live", "failed", "rolled_back"].includes(release?.status)) continue;
    const removed = await removeGeneratedEntries(store, [file]);
    summary.removed += removed.removed;
    summary.bytes += removed.bytes;
  }
  return summary;
}
