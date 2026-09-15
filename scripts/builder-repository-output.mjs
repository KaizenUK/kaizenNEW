import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { measureRepositorySource } from "./builder-repository-usage.mjs";
import { reconcileRelease } from "./kaizen-releases.mjs";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = (value) =>
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value || "");
const artifactName = (value) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value || "");
const commitHash = (value) => /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value || "");

export function assertRepositoryOutputTarget(options) {
  if (
    !(options.projectId === "kaizen" || uuid(options.projectId)) ||
    !["staging", "production"].includes(options.channel)
  )
    throw new Error(
      "Configure the release's fixed website and output accounting destination.",
    );
}

/** This accepts verified retained manifests, never browser-supplied counters. */
export function outputMeasurement(manifest, source) {
  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    !commitHash(manifest.commit)
  )
    throw new Error(
      "The retained output manifest is invalid for usage accounting.",
    );
  let bytes = 0,
    pages = 0;
  const names = new Set();
  for (const file of manifest.files) {
    if (
      typeof file.path !== "string" ||
      names.has(file.path) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    )
      throw new Error("The retained output file inventory is invalid.");
    names.add(file.path);
    bytes += file.size;
    if (/\.html$/i.test(file.path)) pages++;
  }
  if (!Number.isSafeInteger(bytes) || !pages)
    throw new Error("The retained website has no measured HTML pages.");
  return {
    bytes,
    pages,
    sourceBytes: source.bytes,
    sourceRevision: source.revision,
    manifestSha256: digest(manifest),
  };
}

export class RepositoryOutputAccounting {
  input;
  source;
  constructor(client, options) {
    if (
      !(options.projectId === "kaizen" || uuid(options.projectId)) ||
      !["staging", "production"].includes(options.channel) ||
      !uuid(options.id) ||
      !artifactName(options.artifactId) ||
      !commitHash(options.commit) ||
      (options.sourceRoot && !path.isAbsolute(options.sourceRoot))
    )
      throw new Error(
        "Configure the release's fixed website and output accounting identity.",
      );
    this.client = client;
    this.options = options;
  }
  async prepareSource() {
    if (!this.options.sourceRoot)
      throw new Error(
        "Configure the website source directory before building.",
      );
    this.source = await measureRepositorySource(this.options.sourceRoot);
  }
  async begin(manifest) {
    if (
      manifest.id !== this.options.artifactId ||
      manifest.commit !== this.options.commit ||
      !this.source
    )
      throw new Error(
        "The measured source does not belong to this release artifact.",
      );
    if (
      (await measureRepositorySource(this.options.sourceRoot)).revision !==
      this.source.revision
    )
      throw new Error(
        "Website source changed during the release build. Build the reviewed source again.",
      );
    return this.reserve(outputMeasurement(manifest, this.source));
  }
  async reserve(sample) {
    this.input = {
      target: this.options.projectId,
      request_id: this.options.id,
      output_channel: this.options.channel,
      artifact: this.options.artifactId,
      source_commit: this.options.commit,
      sample,
    };
    const result = await this.client.rpc("builder_repository_output_begin", {
      ...this.input,
      recovery: !!this.options.recovery,
    });
    if (result?.id !== this.options.id || result?.phase !== "reserved")
      throw new Error(
        "This output usage attempt is already finished. Reconcile its artifact before deploying again.",
      );
  }
  async settle(outcome) {
    if (!this.input) return;
    const result = await this.client.rpc("builder_repository_output_settle", {
      ...this.input,
      outcome,
    });
    if (result?.id !== this.options.id || result?.phase !== outcome)
      throw new Error("The release usage outcome could not be confirmed.");
  }
  async live() {
    try {
      await this.settle("live");
    } catch {
      const error = new Error(
        "The verified website is serving, but its usage acknowledgement is uncertain. Reconcile this release before another deployment.",
      );
      error.releaseCommitUncertain = true;
      throw error;
    }
  }
  failed() {
    return this.settle("failed");
  }
}

/** Reuses the filesystem's stopped-process recovery lock and real live checks.
 * Restoring an older artifact retains uncertain candidates until verification. */
export async function reconcileRepositoryOutput(options, adapters = {}) {
  const {
    client,
    projectId,
    channel,
    store,
    origin,
    artifactId,
    restoreId,
    sourceRoot,
  } = options;
  const desired = restoreId || artifactId;
  let accounting;
  return (adapters.reconcile || reconcileRelease)(
    { store, origin, id: artifactId, restoreId },
    {
      ...adapters,
      async beforeReconcile(manifest) {
        await options.beforeReserve?.(manifest);
        const record = await client.rpc("builder_repository_output_read", {
          target: projectId,
          output_channel: channel,
          artifact: desired,
        });
        if (
          record &&
          (record.commit !== manifest.commit ||
            record.measurement?.manifestSha256 !== digest(manifest))
        )
          throw new Error(
            "The retained artifact does not match its recorded usage. Restore the matching artifact before reconciling it.",
          );
        accounting = new RepositoryOutputAccounting(client, {
          projectId,
          channel,
          artifactId: desired,
          commit: manifest.commit,
          // A fresh reservation fences delayed callbacks from the stopped worker.
          id: randomUUID(),
          sourceRoot,
          recovery: true,
        });
        if (record) await accounting.reserve(record.measurement);
        else {
          // Artifacts retained before output accounting have no ledger. Under
          // the recovery lock, measure the current source and verified retained
          // files before allowing this explicit restoration to switch anything.
          await accounting.prepareSource();
          await accounting.begin(manifest);
        }
      },
      async finalize(manifest) {
        if (options.finalize)
          await options.finalize(manifest, accounting.input);
        else await accounting.live();
      },
    },
  );
}
