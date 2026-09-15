/** Called inside the configured deployment service's outer lock and native
 * operation. Never treats a partially removed release as a publication target. */
import path from "node:path";
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
  return retireRelease(options, adapters);
}
