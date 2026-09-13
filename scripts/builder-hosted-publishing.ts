import { randomUUID } from "node:crypto";
import { HostedHelperError, type RepositoryActor } from "./builder-hosted-auth";
import type { HostedWebsiteFolders } from "./builder-hosted-folders";
import { HostedSaveReleases } from "./builder-hosted-save-release";
import { repositoryGitStatus } from "./builder-repository-git";
import type { RepositoryPublishStatus } from "../shared/builderRepositoryPublish";

type Entry = { actorId: string; status: RepositoryPublishStatus };
const conflict = (message: string) => new HostedHelperError(409, message);

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
  constructor(
    private folders: HostedWebsiteFolders,
    private releases = new HostedSaveReleases(),
    private request: typeof fetch = fetch,
  ) {}
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
  forget(id: string) {
    this.assertCanReconfigure(id);
    for (const [key, entry] of this.entries)
      if (entry.status.review.projectId === id) this.entries.delete(key);
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
    this.entries.set(value.review.id, { actorId: actor.id, status: value });
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
        throw error;
      }
      entry.status.error =
        "The production push was rejected or its acknowledgement was lost. Check publication state before an explicit retry. Your staging revision is kept.";
    }
    return this.status(id, actor, review.id);
  }
}
