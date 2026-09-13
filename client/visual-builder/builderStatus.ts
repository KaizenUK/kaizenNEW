import type { WebsiteStatus } from "../../shared/builderWebsiteStatus";
import type { BuilderPage } from "../../shared/visualBuilder";
import type { ReleasePhase, ReleaseStatus } from "../../shared/builderReleases";
import type { ClientPublicationJob } from "../../shared/builderClientPublication";
import type { RepositorySaveStatus } from "../../shared/builderRepositorySave";
import type { RepositoryPublishStatus } from "../../shared/builderRepositoryPublish";

export type BuilderStatusKey = "draft" | "saved" | "staging" | "live";
export type StatusPresentation = {
  label: string;
  tone: "grey" | "green" | "orange" | "blue";
  detail: string;
};
export const builderStatuses = {
  draft: {
    label: "Draft",
    tone: "orange",
    detail: "These edits have not been saved yet.",
  },
  saved: {
    label: "Saved",
    tone: "grey",
    detail: "Your edits are kept. Saving does not publish them.",
  },
  staging: {
    label: "On staging",
    tone: "blue",
    detail: "This version is on staging. Check it before publishing.",
  },
  live: {
    label: "Live",
    tone: "green",
    detail: "This version is on the live website.",
  },
} as const satisfies Record<BuilderStatusKey, StatusPresentation>;

/** The loaded publication is a verified baseline; newer draft edits remain private. */
export function savedPageStatus(page: BuilderPage): BuilderStatusKey {
  if (!page.published) return "saved";
  const publishedAt = Date.parse(page.publishedAt || "");
  const lastEdit = Math.max(
    Date.parse(page.updatedAt) || 0,
    ...page.revisions.map((revision) => Date.parse(revision.createdAt) || 0),
  );
  if (Number.isFinite(publishedAt))
    return lastEdit > publishedAt ? "saved" : "live";
  return JSON.stringify(page.draft) === JSON.stringify(page.published)
    ? "live"
    : "saved";
}

export function editorStatus(
  state: "dirty" | "saving" | "saved" | "failed",
  page?: BuilderPage,
): StatusPresentation {
  if (state === "saving")
    return { ...builderStatuses.draft, detail: "Saving your edits…" };
  if (state === "failed")
    return {
      ...builderStatuses.draft,
      detail: "Saving failed. Keep this window open and try saving again.",
    };
  if (state === "dirty") return builderStatuses.draft;
  return builderStatuses[page ? savedPageStatus(page) : "saved"];
}

/** A successful workflow alone cannot establish which revision a destination currently serves. */
export function repositorySaveState(
  status: RepositorySaveStatus | null,
): BuilderStatusKey {
  return status?.phase === "saved" &&
    status.release?.state === "succeeded" &&
    status.delivery === "reported"
    ? "staging"
    : "saved";
}
export function repositoryPublicationState(
  status: RepositoryPublishStatus,
  website?: WebsiteStatus,
): BuilderStatusKey {
  if (status.phase === "reviewed" && website?.head === status.review.commit)
    return website.state;
  return status.phase === "sent" &&
    status.release?.state === "succeeded" &&
    status.delivery === "reported"
    ? "live"
    : "saved";
}

const releaseProgress: Record<
  Exclude<ReleasePhase, "live">,
  StatusPresentation
> = {
  queued: {
    label: "Queued",
    tone: "blue",
    detail: "Waiting to update the destination.",
  },
  building: {
    label: "Building",
    tone: "blue",
    detail: "Preparing the website for its destination.",
  },
  activating: {
    label: "Updating website",
    tone: "blue",
    detail: "The release is being activated.",
  },
  verifying: {
    label: "Checking website",
    tone: "blue",
    detail: "Checking the served website before confirming the release.",
  },
  failed: {
    label: "Update failed",
    tone: "orange",
    detail: "This release did not finish. Check its error before trying again.",
  },
  rolled_back: {
    label: "Previous release restored",
    tone: "grey",
    detail: "This attempted update was undone.",
  },
  recovery_required: {
    label: "Recovery needs attention",
    tone: "orange",
    detail: "The destination needs an operator check before another update.",
  },
};

export function releaseStatus(input: {
  phase: ReleasePhase;
  active: boolean;
  environment: "staging" | "production";
  offline?: boolean;
}): StatusPresentation {
  if (input.phase !== "live") return releaseProgress[input.phase];
  if (!input.active)
    return {
      label: "Earlier release",
      tone: "grey",
      detail: "This verified release has been replaced at its destination.",
    };
  if (input.offline)
    return {
      label: "Offline",
      tone: "grey",
      detail: "The website has been taken offline at this destination.",
    };
  return builderStatuses[input.environment === "staging" ? "staging" : "live"];
}
export const clientReleaseStatus = (job: ClientPublicationJob) =>
  releaseStatus({
    phase: job.phase,
    active: job.active,
    environment: job.destination.environment,
    offline: job.action === "unpublish",
  });
export const mainReleaseStatus = (release: ReleaseStatus) =>
  releaseStatus({
    phase: release.status,
    active: release.live,
    environment: "production",
  });

/** Draft routes belong only to the current account. An unconfirmed folder stays Saved. */
export function websitePageStatus(
  observation: WebsiteStatus | undefined,
  route: string,
): StatusPresentation {
  if (observation?.draftRoutes.includes(route))
    return {
      ...builderStatuses.saved,
      detail:
        "Your edits are saved for review. Review and apply them before saving to the website.",
    };
  return observation
    ? { ...builderStatuses[observation.state], detail: observation.detail }
    : {
        ...builderStatuses.saved,
        detail:
          "Saved in the website folder. Deployment has not been confirmed for this version.",
      };
}
