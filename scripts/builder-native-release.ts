/** Immutable bundled entry for coordinated native release work. The outer
 * deployment service must also protect checkout/dependency preparation. */
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createReleaseClient,
  loadReleaseEnvironment,
  runReleaseWorker,
} from "./builder-release-worker.mjs";
import {
  NativeOperationJournal,
  type NativeFileProtection,
} from "./builder-native-operations";
import {
  nativeServiceController,
  type NativeOperationController,
} from "./builder-native-controller";
import { nativeWorkerConnection } from "./builder-native-worker";
import {
  runControlledBuild,
  runControlledCommand,
} from "./builder-controlled-build";
import {
  isolatedBuildCommand,
  type SandboxCommand,
} from "./builder-build-sandbox";
import {
  prepareNativeCheckout,
  recoverNativeCheckout,
} from "./builder-native-deploy";
import { nativeDiskGuard } from "./builder-hosted-disk";

import { maintainNativeReleases } from "./builder-native-release-maintenance";

type NativeReleaseAction =
  | "deploy"
  | "preflight"
  | "reconcile"
  | "reconcile-usage"
  | "maintain";
export function nativeReleaseAction(argv: string[]): NativeReleaseAction {
  if (!argv.length) return "deploy";
  if (
    argv.length !== 1 ||
    ![
      "--deploy",
      "--preflight",
      "--reconcile",
      "--reconcile-usage",
      "--maintain",
    ].includes(argv[0])
  )
    throw new Error(
      "Choose a deployment, maintenance or explicit reconciliation action.",
    );
  return argv[0].slice(2) as NativeReleaseAction;
}

type Task = {
  environment: NodeJS.ProcessEnv;
  action: NativeReleaseAction;
  root: string;
  native: NativeOperationJournal;
  controller: NativeOperationController;
  client: ReturnType<typeof createReleaseClient>;
  command: SandboxCommand;
  signal: AbortSignal;
  log: (chunk: Buffer | string) => void;
  preflight: () => Promise<void>;
  build: (files: NativeFileProtection, snapshotFile?: string) => Promise<void>;
};
type TaskAdapters = {
  recoverCheckout?: typeof recoverNativeCheckout;
  prepareCheckout?: typeof prepareNativeCheckout;
  release?: typeof runReleaseWorker;
  maintenance?: Parameters<typeof maintainNativeReleases>[1];
};

/** The installed CLI and fixtures use the same complete orchestration. The
 * fixed launcher holds build.lock and the same service identity in every mode. */
export async function runNativeReleaseTask(
  task: Task,
  adapters: TaskAdapters = {},
) {
  const { environment: env, action, native, controller } = task;
  nativeReleaseAction([`--${action}`]);
  if (env.KAIZEN_APP_DIR !== task.root || !path.isAbsolute(task.root))
    throw new Error("The deployment service must use its fixed checkout.");
  task.signal.throwIfAborted();
  if (action === "preflight") return task.preflight();
  const recovered = await native.recover();
  if (recovered.deferred)
    throw new Error(
      "Previous native work is not proven stopped. Its files and operations are preserved.",
    );
  return native.run(
    "",
    env.BUILDER_RELEASE_PROJECT_ID || "",
    async (nativeFiles) => {
      try {
        await task.preflight();
        const checkout = {
          root: task.root,
          state: env.BUILDER_NATIVE_STATE_DIRECTORY || "",
          repository: env.KAIZEN_NATIVE_REPOSITORY || "",
          branch: env.KAIZEN_DEPLOY_BRANCH as "main" | "stage",
          commit: env.KAIZEN_DEPLOY_SHA || "",
          environment: env,
          command: task.command,
          signal: task.signal,
          files: nativeFiles,
          controller,
          log: task.log,
        };
        // A maintenance invocation repairs an existing checkout receipt but
        // never fetches, installs dependencies, builds or consumes a publication.
        await (adapters.recoverCheckout || recoverNativeCheckout)(checkout);
        task.signal.throwIfAborted();
        const maintenance = {
          environment: env,
          nativeFiles,
          controller,
          connection: task.client,
        };
        const reconciling =
          action === "reconcile" || action === "reconcile-usage";
        let retention = await maintainNativeReleases(
          { ...maintenance, recoverOnly: reconciling },
          adapters.maintenance,
        );
        if (action === "maintain") return retention;
        task.signal.throwIfAborted();
        if (action === "deploy")
          await (adapters.prepareCheckout || prepareNativeCheckout)(checkout);
        const result = await (adapters.release || runReleaseWorker)(
          env,
          action === "deploy" ? [] : [`--${action}`],
          {
            client: task.client,
            nativeFiles,
            build: (snapshot?: string) => task.build(nativeFiles, snapshot),
          },
        );
        // Explicit publication recovery takes priority over starting new cleanup.
        // A previously owned retirement was already resumed above, at most once.
        if (reconciling && retention.phase === "disabled")
          retention = await maintainNativeReleases(
            maintenance,
            adapters.maintenance,
          );
        return { release: result, retention };
      } catch (error) {
        if (
          (error as { nativeRecoveryRequired?: boolean })
            ?.nativeRecoveryRequired
        )
          nativeFiles.retainOperation();
        throw error;
      }
    },
  );
}

export async function runNativeReleaseCli() {
  const action = nativeReleaseAction(process.argv.slice(2));
  const env = loadReleaseEnvironment();
  if (!path.isAbsolute(env.BUILDER_NATIVE_STATE_DIRECTORY || ""))
    throw new Error("Configure the native worker's private state directory.");
  const client = createReleaseClient({
    url: env.VITE_SUPABASE_URL || "",
    key: env.BUILDER_RELEASE_SERVICE_ROLE_KEY,
  });
  const serviceController = await nativeServiceController();
  const native = new NativeOperationJournal({
    directory: path.join(env.BUILDER_NATIVE_STATE_DIRECTORY!, "operations"),
    workerId: env.BUILDER_NATIVE_WORKER_ID || "",
    configuration: env.BUILDER_NATIVE_CONFIGURATION || "",
    connection: nativeWorkerConnection(client),
    controller: serviceController,
  });
  const command = await isolatedBuildCommand(
    env.BUILDER_NATIVE_PACKAGE_MANAGER || "",
  );
  const controller = new AbortController();
  const stop = () =>
    controller.abort(new Error("The deployment service is stopping."));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    const result = await runNativeReleaseTask({
      environment: env,
      action,
      root: process.cwd(),
      native,
      controller: serviceController,
      client,
      command,
      signal: controller.signal,
      log: (chunk) => process.stdout.write(chunk),
      async preflight() {
        if (!path.isAbsolute(env.KAIZEN_NATIVE_PREFLIGHT || ""))
          throw new Error("Configure the installed deployment preflight.");
        const code = await runControlledCommand({
          id: randomUUID(),
          root: process.cwd(),
          executable: "/usr/bin/bash",
          args: [env.KAIZEN_NATIVE_PREFLIGHT!],
          environment: env,
          signal: controller.signal,
          log: (chunk) => process.stdout.write(chunk),
        });
        if (code !== 0) throw new Error("Deployment preflight failed.");
      },
      async build(nativeFiles, snapshotFile) {
        const projectId = nativeFiles.operation?.projectId;
        if (!projectId)
          throw new Error("A coordinated native operation is required.");
        const disk = nativeDiskGuard(
          process.cwd(),
          env.BUILDER_NATIVE_STATE_DIRECTORY!,
          env,
        );
        await disk.check(projectId, 200 * 1024 ** 2);
        await disk.run(projectId, async (storageSignal) => {
          const code = await runControlledBuild({
            id: randomUUID(),
            root: process.cwd(),
            command,
            signal: AbortSignal.any([controller.signal, storageSignal]),
            environment: {
              ...env,
              BUILDER_RELEASE_SNAPSHOT_FILE: snapshotFile || "",
            },
            log: (chunk) => process.stdout.write(chunk),
          });
          if (code !== 0)
            throw new Error(`Static build failed with exit code ${code}.`);
        });
      },
    });
    if (result) console.info(JSON.stringify(result));
    return result;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
}
