import type { ClientPublicationJob } from "../shared/builderClientPublication";
import { validateClientDestination } from "./kaizen-releases.mjs";

export type PublicationIndex = {
  schemaVersion: 1;
  jobs: ClientPublicationJob[];
  active: Record<string, string>;
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value,
  );
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const artifact = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);
const timestamp = (value: unknown) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const fail = (detail: string): never => {
  throw new Error(
    `Invalid publication history (${detail}). Preserve its files for operator recovery.`,
  );
};

/** Validate saved references before they can become filesystem paths or live pointers. */
export function validatePublicationIndex(
  value: unknown,
  projectId: string,
): PublicationIndex {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.jobs) ||
    !record(value.active)
  )
    return fail("unsupported structure or version");
  const jobs = new Map<string, ClientPublicationJob>();
  for (const raw of value.jobs) {
    if (!record(raw) || !uuid(raw.id) || jobs.has(raw.id))
      return fail("invalid or duplicate job reference");
    const destination = raw.destination;
    if (
      !record(destination) ||
      destination.projectId !== projectId ||
      typeof destination.label !== "string"
    )
      return fail("destination belongs to another project or is malformed");
    try {
      validateClientDestination({
        projectId: destination.projectId,
        destinationId: destination.destinationId,
        environment: destination.environment,
        origin: destination.origin,
      });
    } catch {
      return fail("invalid destination identity");
    }
    if (
      !["publish", "rollback", "unpublish"].includes(raw.action as string) ||
      ![
        "queued",
        "building",
        "activating",
        "verifying",
        "live",
        "failed",
        "rolled_back",
        "recovery_required",
      ].includes(raw.phase as string) ||
      !timestamp(raw.createdAt) ||
      !timestamp(raw.updatedAt) ||
      !artifact(raw.artifactId) ||
      (raw.previousReleaseId !== null && !artifact(raw.previousReleaseId)) ||
      typeof raw.log !== "string" ||
      typeof raw.active !== "boolean" ||
      (raw.error !== undefined && typeof raw.error !== "string") ||
      (raw.recoveryAvailable !== undefined &&
        typeof raw.recoveryAvailable !== "boolean") ||
      (raw.rollbackOf !== undefined && !uuid(raw.rollbackOf)) ||
      (raw.action === "rollback" && !uuid(raw.rollbackOf))
    )
      return fail("malformed job fields");
    jobs.set(raw.id, raw as unknown as ClientPublicationJob);
  }
  for (const job of jobs.values()) {
    if (job.action !== "rollback") continue;
    const prior = jobs.get(job.rollbackOf!);
    if (
      !prior ||
      prior.id === job.id ||
      prior.phase !== "live" ||
      prior.destination.destinationId !== job.destination.destinationId ||
      prior.artifactId !== job.artifactId
    )
      return fail(
        "rollback reference does not match a verified destination artifact",
      );
  }
  for (const [destinationId, jobId] of Object.entries(value.active)) {
    const job = typeof jobId === "string" ? jobs.get(jobId) : undefined;
    if (
      !uuid(destinationId) ||
      !job ||
      job.destination.destinationId !== destinationId ||
      !["live", "recovery_required"].includes(job.phase)
    )
      return fail("active baseline does not match a verified destination job");
  }
  return value as unknown as PublicationIndex;
}
