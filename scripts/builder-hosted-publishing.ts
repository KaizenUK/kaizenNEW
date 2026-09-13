import { createHash, randomUUID } from "node:crypto";
import {
  HostedHelperError,
  accountId,
  type RepositoryActor,
} from "./builder-hosted-auth";
import type { HostedWebsiteFolders } from "./builder-hosted-folders";
import { HostedSaveReleases } from "./builder-hosted-save-release";
import { repositoryGitStatus } from "./builder-repository-git";
import type { RepositoryPublishStatus } from "../shared/builderRepositoryPublish";
import { HostedReceiptStore, receiptError } from "./builder-hosted-receipts";

type Entry = {
  actorId: string;
  binding: string;
  status: RepositoryPublishStatus;
};
const conflict = (message: string) => new HostedHelperError(409, message);

function publicationReceipts(data: unknown, projectId: string): Entry[] {
  if (!Array.isArray(data) || data.length > 20) throw receiptError();
  const seen = new Set<string>();
  const text = (value: unknown, max = 2000) =>
    typeof value === "string" && value.length <= max;
  const origin = (value: unknown) => {
    if (!text(value)) return false;
    try {
      const url = new URL(value as string);
      return url.protocol === "https:" && url.origin === value;
    } catch {
      return false;
    }
  };
  for (const item of data) {
    const status = item?.status,
      review = status?.review;
    if (
      !item ||
      !accountId(item.actorId) ||
      !/^[a-f0-9]{64}$/.test(item.binding || "") ||
      Object.keys(item).some(
        (key) => !["actorId", "binding", "status"].includes(key),
      ) ||
      !status ||
      !["reviewed", "uncertain", "sent"].includes(status.phase) ||
      !text(status.message) ||
      (status.error !== undefined && !text(status.error)) ||
      Object.keys(status).some(
        (key) => !["review", "phase", "message", "error"].includes(key),
      ) ||
      !review ||
      !accountId(review.id) ||
      seen.has(review.id) ||
      review.projectId !== projectId ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(review.commit || "") ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(review.productionBase || "") ||
      !origin(review.stagingUrl) ||
      !origin(review.productionUrl) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(review.stagingReleaseId || "") ||
      !Number.isSafeInteger(review.expiresAt) ||
      review.expiresAt <= 0 ||
      !Array.isArray(review.files) ||
      review.files.length > 10000 ||
      review.files.some(
        (file) =>
          !text(file, 500) ||
          !file ||
          file.startsWith("/") ||
          /[\\:\u0000-\u001f]/.test(file) ||
          file
            .split("/")
            .some((part) => !part || part === "." || part === ".."),
      ) ||
      Object.keys(review).some(
        (key) =>
          ![
            "id",
            "projectId",
            "commit",
            "productionBase",
            "stagingUrl",
            "productionUrl",
            "stagingReleaseId",
            "files",
            "expiresAt",
          ].includes(key),
      )
    )
      throw receiptError();
    seen.add(review.id);
  }
  return structuredClone(data);
}

/** Read-only public release identity, from an operator-approved origin. A marker does not attest all served bytes. */
export async function hostedReleaseMarker(
  origin: string,
  request: typeof fetch = fetch,
) {
  try {
    const response = await request(
      new URL("/.well-known/kaizen-release.json", origin),
      {
        headers: { Accept: "application/json" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > 8192) throw new Error();
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const marker = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      marker.schemaVersion !== 1 ||
      typeof marker.commit !== "string" ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(marker.commit) ||
      typeof marker.releaseId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(marker.releaseId)
    )
      throw new Error();
    return {
      commit: marker.commit as string,
      releaseId: marker.releaseId as string,
    };
  } catch {
    throw conflict(
      "The website's deployed revision could not be checked. Ask the owner to check deployment before publishing.",
    );
  }
}

/** Project-locked explicit promotion of a reviewed staging commit, preserving production history and the original checkout. */
export class HostedWebsitePublishing {
  private entries = new Map<string, Entry>();
  private records: HostedReceiptStore<Entry[]>;
  constructor(
    private folders: HostedWebsiteFolders,
    private releases = new HostedSaveReleases(),
    private request: typeof fetch = fetch,
  ) {
    this.records = new HostedReceiptStore(
      folders,
      "publication-receipts.json",
      publicationReceipts,
      () => [],
    );
  }
  async refresh(id: string) {
    const records = await this.records.read(id);
    for (const [key, entry] of this.entries)
      if (entry.status.review.projectId === id) this.entries.delete(key);
    for (const entry of records)
      this.entries.set(entry.status.review.id, entry);
  }
  private binding(id: string) {
    const configured = this.folders.configuration(id);
    return createHash("sha256")
      .update(
        JSON.stringify([
          configured.repositoryUrl,
          configured.branch,
          configured.saveToWebsite,
          configured.publishToWebsite,
        ]),
      )
      .digest("hex");
  }
  private persist(id: string) {
    const entries = [...this.entries.values()]
      .filter((entry) => entry.status.review.projectId === id)
      .map((entry) => {
        const {
          release: _release,
          delivery: _delivery,
          ...status
        } = entry.status;
        return { ...entry, status };
      });
    return this.records.write(id, entries);
  }
  assertCanReconfigure(id: string) {
    if (
      [...this.entries.values()].some(
        (entry) =>
          entry.status.review.projectId === id &&
          entry.status.phase === "uncertain",
      )
    )
      throw conflict(
        "Check the outstanding production publication before changing repository settings. Its outcome is still unknown.",
      );
  }
  async forget(id: string) {
    this.assertCanReconfigure(id);
    for (const [key, entry] of this.entries)
      if (entry.status.review.projectId === id) this.entries.delete(key);
    await this.persist(id);
  }
  private async clean(id: string) {
    await this.folders.assertNotBuilding(id);
    const root = await this.folders.check(id),
      git = await repositoryGitStatus(root, this.folders.localGit(id));
    if (git.inProgress || git.files.length)
      throw conflict(
        "The website folder has unsaved or unfinished Git work. Save or reconcile it before reviewing production publication.",
      );
    const commit = await this.folders.head(id);
    if (commit !== (await this.folders.remoteHead(id)))
      throw conflict(
        "The staging branch changed or your latest commit has not been saved. Reconcile the website folder before publishing.",
      );
    return commit;
  }
  async review(id: string, actor: RepositoryActor) {
    const configured = this.folders.configuration(id),
      target = this.folders.productionTarget(id);
    this.assertCanReconfigure(id);
    const commit = await this.clean(id),
      productionBase = await this.folders.productionHead(id);
    if (commit === productionBase)
      throw conflict(
        "The production branch already has this saved revision. Check its deployment status or save a new change to staging first.",
      );
    await this.folders.fetchProduction(id);
    const files = await this.folders.publicationFiles(
      id,
      commit,
      productionBase,
    );
    const marker = await hostedReleaseMarker(
      configured.saveToWebsite!.url,
      this.request,
    );
    if (marker.commit !== commit)
      throw conflict(
        "Staging is not serving this saved revision yet. Wait for its deployment and review again.",
      );
    if (
      (await this.folders.productionHead(id)) !== productionBase ||
      (await this.folders.remoteHead(id)) !== commit
    )
      throw conflict(
        "A website branch changed during review. Review staging again before publishing.",
      );
    for (const [key, entry] of this.entries)
      if (
        entry.status.phase === "reviewed" &&
        entry.status.review.expiresAt <= Date.now()
      )
        this.entries.delete(key);
    const retained = [...this.entries].filter(
      ([, entry]) => entry.status.review.projectId === id,
    );
    while (retained.length >= 20) this.entries.delete(retained.shift()![0]);
    if (this.entries.size >= 1000)
      throw new HostedHelperError(
        429,
        "Publication history is full. Ask the operator to check it before creating another review.",
      );
    const value: RepositoryPublishStatus = {
      phase: "reviewed",
      message:
        "Review the website on staging, then publish this saved revision to the live website.",
      review: {
        id: randomUUID(),
        projectId: id,
        commit,
        productionBase,
        files,
        stagingUrl: configured.saveToWebsite!.url,
        productionUrl: target.url,
        stagingReleaseId: marker.releaseId,
        expiresAt: Math.min(Date.now() + 15 * 60000, actor.expiresAt),
      },
    };
    this.entries.set(value.review.id, {
      actorId: actor.id,
      binding: this.binding(id),
      status: value,
    });
    await this.persist(id);
    return structuredClone(value);
  }
  private entry(id: string, actor: RepositoryActor, reviewId?: unknown) {
    const entry =
      reviewId === undefined
        ? [...this.entries.values()]
            .reverse()
            .find(
              (entry) =>
                entry.actorId === actor.id &&
                entry.status.review.projectId === id,
            )
        : typeof reviewId === "string"
          ? this.entries.get(reviewId)
          : undefined;
    if (
      reviewId !== undefined &&
      (!entry ||
        entry.actorId !== actor.id ||
        entry.status.review.projectId !== id)
    )
      throw conflict(
        "This publication review belongs to another account, project or helper session. Review staging again.",
      );
    if (entry) {
      const configured = this.folders.configuration(id);
      if (
        entry.binding !== this.binding(id) ||
        entry.status.review.stagingUrl !== configured.saveToWebsite?.url ||
        entry.status.review.productionUrl !== configured.publishToWebsite?.url
      )
        throw receiptError();
    }
    return entry;
  }
  async status(id: string, actor: RepositoryActor, reviewId?: unknown) {
    this.folders.productionTarget(id);
    const entry = this.entry(id, actor, reviewId);
    if (!entry) return null;
    const status = entry.status;
    if (status.phase === "uncertain") {
      try {
        const current = await this.folders.productionHead(id);
        if (current === status.review.commit) {
          status.phase = "sent";
          delete status.error;
          status.message =
            "This reviewed revision is on the production branch. Its deployment is a separate step.";
        } else if (current === status.review.productionBase) {
          status.phase = "reviewed";
          status.message =
            "The reviewed revision is not on the production branch. Retry publishing explicitly, or review again.";
        } else
          status.error =
            "Production changed after this publication attempt. Ask the owner to reconcile its outcome before another publication.";
      } catch {
        status.error =
          "Publication state could not be checked. Nothing has been retried; check again when the Git host is available.";
      }
    }
    if (status.phase === "sent") {
      const configured = this.folders.configuration(id),
        target = this.folders.productionTarget(id);
      status.release = await this.releases.status(
        configured,
        status.review.commit,
        target,
      );
      try {
        const marker = await hostedReleaseMarker(target.url, this.request);
        status.delivery =
          marker.commit === status.review.commit ? "reported" : "waiting";
      } catch {
        status.delivery = "unavailable";
      }
    }
    await this.persist(id);
    return structuredClone(status);
  }
  async publish(
    id: string,
    actor: RepositoryActor,
    reviewId: unknown,
    authorize: () => Promise<void>,
  ) {
    this.folders.productionTarget(id);
    if (typeof reviewId !== "string")
      throw conflict("Choose a publication review before publishing.");
    const entry = this.entry(id, actor, reviewId);
    if (!entry) throw conflict("Review staging before publishing.");
    const { review } = entry.status;
    if (entry.status.phase !== "reviewed")
      throw conflict(
        "Check this publication's state before trying another publish action. No push has been repeated.",
      );
    if (review.expiresAt <= Date.now())
      throw conflict(
        "This publication review expired. Review staging again before publishing.",
      );
    if ((await this.clean(id)) !== review.commit)
      throw conflict(
        "Your saved website changed after this review. Review staging again before publishing.",
      );
    if ((await this.folders.productionHead(id)) !== review.productionBase)
      throw conflict(
        "Production changed after this review. Review staging again before publishing.",
      );
    if (
      JSON.stringify(
        await this.folders.publicationFiles(
          id,
          review.commit,
          review.productionBase,
        ),
      ) !== JSON.stringify(review.files)
    )
      throw conflict(
        "The publication file review changed. Review staging again before publishing.",
      );
    const marker = await hostedReleaseMarker(review.stagingUrl, this.request);
    if (
      marker.commit !== review.commit ||
      marker.releaseId !== review.stagingReleaseId
    )
      throw conflict(
        "The staging deployment changed after this review. Review staging again before publishing.",
      );
    let attempted = false;
    entry.status.phase = "uncertain";
    entry.status.message =
      "Publication was attempted. Check its state before retrying; the live site may still be deploying.";
    delete entry.status.error;
    // Persist uncertainty before Git can begin a push. A restart only observes it.
    await this.persist(id);
    try {
      await this.folders.pushPublication(
        id,
        review.commit,
        review.productionBase,
        async () => {
          await authorize();
          attempted = true;
        },
      );
      entry.status.phase = "sent";
      entry.status.message =
        "The reviewed revision was sent to the production branch. Follow deployment and check the live website.";
    } catch (error) {
      if (!attempted) {
        entry.status.phase = "reviewed";
        entry.status.message =
          "Publication did not start. Review the current website and your access before trying again.";
        await this.persist(id);
        throw error;
      }
      entry.status.error =
        "The production push was rejected or its acknowledgement was lost. Check publication state before an explicit retry. Your staging revision is kept.";
    }
    await this.persist(id);
    return this.status(id, actor, review.id);
  }
}
