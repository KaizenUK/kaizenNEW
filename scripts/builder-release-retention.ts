/** One retained-release retirement per invocation. The caller already owns its
 * outer worker/recovery lock: a native operation for repository stores, or the
 * client worker's own process for client destinations. All store work remains
 * in the existing staging/activation lock until completion or durable failure. */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { NativeFileProtection } from "./builder-native-operations";
import { isNativeOperationIdentity } from "../shared/builderNativeOperations";
import {
  isNativeControllerIdentity,
  type NativeOperationController,
} from "./builder-native-controller";
import { withReleaseRetentionStore } from "./release-retention.mjs";
import { ReleaseRetirementState } from "./release-retirement-state.mjs";
import {
  inspectRetiringFiles,
  removeRetiringFiles,
} from "./release-retirement-files.mjs";

export type ClientWorkerIdentity = {
  kind: "client";
  workerId: string;
  /** SHA-256 of the exact configured destination registry entry. */
  configuration: string;
  projectId: string;
  processId: number;
  host: string;
  bootId: string;
  startTime: number;
};
/** Client publication has no native journal. Its stopped-work proof is the
 * exact process identity; retirement starts no child processes. */
export type ClientRetirementWorker = {
  identity: ClientWorkerIdentity;
  stopped: (previous: ClientWorkerIdentity) => Promise<boolean>;
  retain: () => void;
};
type Options = {
  store: string;
  origin: string;
  projectId: string;
  scope: string;
  workerId: string;
  connection: {
    rpc: (name: string, input: Record<string, unknown>) => Promise<any>;
  };
  nativeFiles?: NativeFileProtection;
  controller?: NativeOperationController;
  clientWorker?: ClientRetirementWorker;
  retention?: {
    keepCount: number;
    minAgeDays: number;
    visitorGraceDays: number;
  };
};
type Adapters = {
  now?: () => number;
  checkLive?: (origin: string, manifest: any) => Promise<void>;
  afterRemove?: (relative: string) => Promise<void>;
  /** Also reclaim abandoned staging, records, immutable files and journals. */
  reclaimGenerated?: boolean;
};
const problem = () =>
  new Error(
    "Release retirement needs reconciliation. Its ownership and remaining files are preserved.",
  );
const sameOperation = (a: any, b: any) =>
  [
    "id",
    "workerId",
    "configuration",
    "projectId",
    "processId",
    "host",
    "instanceId",
  ].every((key) => a[key] === b[key]);
const sameController = (a: any, b: any) =>
  ["kind", "unit", "invocationId"].every((key) => a[key] === b[key]);
function receiptMatches(receipt: any, attempt: any, options: Options) {
  return (
    !!receipt &&
    receipt.project_id === options.projectId &&
    receipt.scope === options.scope &&
    receipt.artifact_id === attempt.artifactId &&
    receipt.worker_id === options.workerId &&
    receipt.store_fingerprint === attempt.fingerprint &&
    receipt.manifest_sha256 === attempt.manifestSha256 &&
    receipt.bytes === attempt.bytes &&
    Number.isSafeInteger(receipt.attempt_generation) &&
    receipt.attempt_generation >= 0 &&
    receipt.attempt_generation <= 2147483647
  );
}

export function assertRetirementOperation(options: Options) {
  const files = options.nativeFiles,
    operation = files?.operation,
    controller = options.controller;
  if (
    !(files instanceof NativeFileProtection) ||
    files.recoveryRequired ||
    !isNativeOperationIdentity(operation) ||
    operation.projectId !== options.projectId ||
    operation.host !== hostname() ||
    operation.processId !== process.pid ||
    !isNativeControllerIdentity(files.controller) ||
    !isNativeControllerIdentity(controller?.identity) ||
    !sameController(files.controller, controller.identity) ||
    typeof controller.stopped !== "function"
  )
    throw problem();
  return { files, operation, controller };
}

function retirementExecutor(options: Options) {
  if (options.scope?.startsWith("client:")) {
    const worker = options.clientWorker,
      identity = worker?.identity;
    if (
      options.nativeFiles ||
      options.controller ||
      identity?.kind !== "client" ||
      identity.projectId !== options.projectId ||
      identity.workerId !== options.workerId ||
      identity.host !== hostname() ||
      identity.processId !== process.pid ||
      typeof worker?.stopped !== "function" ||
      typeof worker.retain !== "function"
    )
      throw problem();
    return {
      owner: () => ({ worker: { ...identity } }),
      retain: () => worker.retain(),
    };
  }
  if (options.clientWorker) throw problem();
  const { files, operation } = assertRetirementOperation(options);
  return {
    owner: () => ({
      operation: { ...operation },
      controller: { ...files.controller },
    }),
    retain: () => files.retainOperation(),
  };
}

export async function assertRetirementRecovery(
  options: Options,
  previous: any,
) {
  if (options.scope?.startsWith("client:")) {
    retirementExecutor(options);
    const worker = options.clientWorker!,
      earlier = previous?.worker;
    if (
      earlier?.kind !== "client" ||
      !["workerId", "configuration", "projectId", "host"].every(
        (key) => earlier[key] === worker.identity[key as "host"],
      )
    )
      throw problem();
    if (
      !["processId", "bootId", "startTime"].every(
        (key) => earlier[key] === worker.identity[key as "host"],
      ) &&
      !(await worker.stopped(earlier))
    )
      throw problem();
    return;
  }
  const { operation, controller } = assertRetirementOperation(options);
  if (
    !isNativeOperationIdentity(previous?.operation) ||
    !isNativeControllerIdentity(previous?.controller) ||
    !["workerId", "configuration", "projectId", "host"].every(
      (key) => previous.operation[key] === operation[key],
    ) ||
    previous.controller.unit !== controller.identity.unit
  )
    throw problem();
  if (
    !sameOperation(previous.operation, operation) ||
    !sameController(previous.controller, controller.identity)
  ) {
    if (!(await controller.stopped(previous.operation, previous.controller)))
      throw problem();
  }
}

export async function retireRelease(options: Options, adapters: Adapters = {}) {
  const executor = retirementExecutor(options);
  let hasIntent = false;
  try {
    return await withReleaseRetentionStore(
      options,
      async (session) => {
        const state = new ReleaseRetirementState(options.store);
        const withGenerated = async (result: Record<string, unknown>) => {
          if (!adapters.reclaimGenerated) return result;
          const generated = await session.reclaimGenerated();
          return generated?.removedEntries ? { ...result, generated } : result;
        };
        await state.bind(session);
        let attempt = await state.attempt();
        const recovered = !!attempt;
        if (attempt) {
          hasIntent = true;
          await assertRetirementRecovery(options, attempt.owner);
          attempt = await state.adopt(attempt, executor.owner());
        } else {
          const plan = await session.inspect();
          if (plan.recovery.length) throw problem(); // A foreign claim has no local stopped-work proof.
          const now = (adapters.now || Date.now)();
          const candidate = plan.candidates.find(
            (item) => Date.parse(item.receipt.eligible_at) <= now,
          );
          if (!candidate)
            return withGenerated({
              phase: plan.candidates.length ? "waiting" : "idle",
            });
          attempt = {
            version: 1,
            token: randomUUID(),
            generation: candidate.receipt.attempt_generation,
            artifactId: candidate.artifactId,
            manifestSha256: candidate.manifestSha256,
            bytes: candidate.bytes,
            fingerprint: session.storeFingerprint,
            owner: executor.owner(),
            entries: await session.capture(candidate),
          };
          // Persisting may have succeeded even if the local response is lost.
          hasIntent = true;
          await state.begin(attempt);
          await session.assertUnchanged();
        }
        const common = {
          target: options.projectId,
          release_scope: options.scope,
          artifact: attempt.artifactId,
          worker: options.workerId,
          fingerprint: attempt.fingerprint,
          manifest: attempt.manifestSha256,
          token: attempt.token,
          generation: attempt.generation,
        };
        const call = async (
          action: string,
          extra: Record<string, unknown> = {},
        ) => {
          const receipt = await options.connection.rpc(
            `builder_release_retention_${action}`,
            { ...common, ...extra },
          );
          if (!receiptMatches(receipt, attempt, options)) throw problem();
          if (receipt.phase === "cancelled") {
            if (
              receipt.cancelled_token !== attempt.token ||
              receipt.cancelled_generation !== attempt.generation ||
              receipt.attempt_generation <= attempt.generation
            )
              throw problem();
          } else if (
            receipt.attempt_generation !== attempt.generation ||
            (receipt.phase === "pending"
              ? receipt.owner_token !== null
              : !["removing", "removed"].includes(receipt.phase) ||
                receipt.owner_token !== attempt.token)
          )
            throw problem();
          return receipt;
        };
        const wasFenced = await state.isFenced(attempt.artifactId);
        // On recovery, cancellation either proves that an old delayed request
        // can never claim, or returns the exact claim that already won.
        let receipt = await call(recovered && !wasFenced ? "cancel" : "claim");
        if (receipt.phase === "pending") receipt = await call("cancel");
        if (receipt.phase === "cancelled") {
          await state.abandon(attempt, receipt);
          hasIntent = false;
          return { phase: "abandoned", artifactId: attempt.artifactId };
        }
        if (!["removing", "removed"].includes(receipt.phase)) throw problem();
        const guard = await session.guardRecovery(attempt.artifactId);
        if (!recovered) await session.assertUnchanged();
        const physical = await inspectRetiringFiles(
          state.binding,
          attempt,
          wasFenced || receipt.phase === "removed",
        );
        if (receipt.phase === "removed" && !physical.absent) throw problem();
        await state.fence(attempt);
        await guard();
        if (receipt.phase !== "removed") {
          await removeRetiringFiles(state.binding, attempt, guard, {
            afterRemove: adapters.afterRemove,
          });
          receipt = await call("finish", {
            proof: {
              artifactId: attempt.artifactId,
              storeFingerprint: attempt.fingerprint,
              manifestSha256: attempt.manifestSha256,
              artifactAbsent: true,
            },
          });
          if (receipt.phase !== "removed") throw problem();
        }
        await guard();
        await state.forget(attempt, receipt);
        hasIntent = false;
        return withGenerated({
          phase: "removed",
          artifactId: attempt.artifactId,
          bytes: attempt.bytes,
          recovered,
        });
      },
      adapters,
    );
  } catch (error) {
    if (hasIntent) executor.retain();
    throw error;
  }
}
