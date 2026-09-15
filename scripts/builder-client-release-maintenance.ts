/** Called by the client publication worker after its queued jobs, inside the
 * same service invocation. Never treats a partially removed release as a
 * publication target, and never borrows native-operation protection. */
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import {
  assertRetirementRecovery,
  retireRelease,
  type ClientRetirementWorker,
  type ClientWorkerIdentity,
} from "./builder-release-retention";
import { ReleaseRetirementState } from "./release-retirement-state.mjs";
import { releaseRetentionPolicy } from "./release-retention.mjs";
import { inspectProcessLock } from "./release-recovery.mjs";
import { readReleaseSelection } from "./kaizen-releases.mjs";
import { clientPublicationAction } from "./client-publication.mjs";
import { currentBoot, processStart } from "./process-identity.mjs";

type Destination = {
  projectId: string;
  destinationId: string;
  environment: string;
  origin: string;
  label: string;
  store: string;
};
type Input = {
  environment: NodeJS.ProcessEnv;
  destination: Destination;
  workerId: string;
  connection: {
    rpc: (name: string, input: Record<string, unknown>) => Promise<any>;
  };
  clientWorker: ClientRetirementWorker;
  recoverOnly?: boolean;
};
type Adapters = Parameters<typeof retireRelease>[1] & {
  validateConfig?: () => Promise<void>;
  reload?: () => Promise<void>;
};
const unavailable = () =>
  new Error(
    "Client release maintenance requires this Linux host's process identity.",
  );

/** A label is display text; any other registry change is a new configuration. */
export function clientDestinationConfiguration(destination: Destination) {
  const { projectId, destinationId, environment, origin, store } = destination;
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: 1,
        projectId,
        destinationId,
        environment,
        origin,
        store,
      }),
    )
    .digest("hex");
}

export { processStart };

export async function clientRetirementWorker(input: {
  workerId: string;
  destination: Destination;
}): Promise<ClientRetirementWorker & { readonly recoveryRequired: boolean }> {
  if (process.platform !== "linux") throw unavailable();
  const bootId = await currentBoot(),
    current = await processStart(process.pid);
  if (!current) throw unavailable();
  const identity: ClientWorkerIdentity = Object.freeze({
    kind: "client",
    workerId: input.workerId,
    configuration: clientDestinationConfiguration(input.destination),
    projectId: input.destination.projectId,
    processId: process.pid,
    host: hostname(),
    bootId,
    startTime: current.startTime,
  });
  let recoveryRequired = false;
  return {
    identity,
    async stopped(previous) {
      // Another host's process table cannot be observed from here.
      if (previous.host !== identity.host) return false;
      if (previous.bootId !== bootId) return true;
      const observed = await processStart(previous.processId);
      return (
        !observed ||
        observed.startTime !== previous.startTime ||
        observed.state === "Z"
      );
    },
    retain() {
      recoveryRequired = true;
    },
    get recoveryRequired() {
      return recoveryRequired;
    },
  };
}

export async function maintainClientReleases(
  input: Input,
  adapters: Adapters = {},
) {
  const env = input.environment,
    destination = input.destination;
  if (![undefined, "0", "1"].includes(env.BUILDER_RELEASE_RETENTION_ENABLED))
    throw new Error("Configure release retention as 0 or 1.");
  const options = {
    store: destination.store,
    origin: destination.origin,
    projectId: destination.projectId,
    scope: `client:${destination.destinationId}`,
    workerId: input.workerId,
    connection: input.connection,
    clientWorker: input.clientWorker,
    retention: releaseRetentionPolicy(env),
  };
  if (
    input.clientWorker?.identity?.configuration !==
    clientDestinationConfiguration(destination)
  )
    throw new Error(
      "Release maintenance must use its configured client destination.",
    );
  const state = new ReleaseRetirementState(destination.store);
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
      const previous = saved.attempt.owner.worker;
      const lock = await inspectProcessLock(
        path.join(destination.store, ".activation-lock"),
      );
      if (
        lock &&
        (lock.owner.pid !== previous.processId ||
          lock.owner.host !== previous.host)
      )
        throw new Error(
          "The activation lock belongs to another operation. Reconcile that publication first.",
        );
      // Read only the selected artifact: listing every manifest would fail on
      // the intentionally partial retirement target after a killed worker.
      const selected = await readReleaseSelection(destination.store);
      if (!selected || selected.id === saved.attempt.artifactId)
        throw new Error(
          "The retirement target is selected or the serving state is unknown.",
        );
      await clientPublicationAction(
        destination,
        "reconcile",
        { id: selected.id },
        adapters,
      );
    } catch (error) {
      input.clientWorker.retain();
      throw error;
    }
  } else if (
    input.recoverOnly ||
    env.BUILDER_RELEASE_RETENTION_ENABLED !== "1"
  ) {
    return { phase: "disabled" };
  }
  // Turning off new retirement must still finish the exact previously owned
  // attempt; otherwise a partially deleted release would remain stranded.
  return retireRelease(options, {
    ...adapters,
    reclaimGenerated:
      !input.recoverOnly && env.BUILDER_RELEASE_RETENTION_ENABLED === "1",
  });
}
