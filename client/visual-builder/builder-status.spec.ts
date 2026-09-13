import { expect, it } from "vitest";
import type { BuilderPage } from "../../shared/visualBuilder";
import { newDocument } from "./starters";
import {
  builderStatuses,
  editorStatus,
  savedPageStatus,
  repositorySaveState,
  repositoryPublicationState,
  releaseStatus,
  websitePageStatus,
} from "./builderStatus";
import type { RepositorySaveStatus } from "../../shared/builderRepositorySave";
import type { RepositoryPublishStatus } from "../../shared/builderRepositoryPublish";
import { readWebsiteStatus } from "../../shared/builderWebsiteStatus";
import { clientDeploymentMessage } from "./repositorySaveCopy";

const document = newDocument("Status page", "status", false);
const page: BuilderPage = {
  id: "page",
  version: 1,
  draft: document,
  published: document,
  publishedAt: "2026-09-14T10:00:00.000Z",
  updatedAt: "2026-09-14T10:00:00.000Z",
  revisions: [],
};
it("uses four stable labels and reserves Live for a saved draft no newer than the publication", () => {
  expect(Object.values(builderStatuses).map((s) => s.label)).toEqual([
    "Draft",
    "Saved",
    "On staging",
    "Live",
  ]);
  expect(savedPageStatus({ ...page, published: null })).toBe("saved");
  expect(savedPageStatus(page)).toBe("live");
  expect(
    savedPageStatus({ ...page, updatedAt: "2026-09-14T10:00:00.001Z" }),
  ).toBe("saved");
  expect(
    savedPageStatus({
      ...page,
      publishedAt: undefined,
      draft: { ...document, title: "Later change" },
    }),
  ).toBe("saved");
  expect(editorStatus("dirty", page).label).toBe("Draft");
  expect(editorStatus("saving", page)).toMatchObject({
    label: "Draft",
    detail: "Saving your edits…",
  });
  expect(editorStatus("failed", page)).toMatchObject({ label: "Draft" });
  expect(editorStatus("saved", page).label).toBe("Live");
  expect(editorStatus("saved").label).toBe("Saved");
});
it("separates active staging, active production, offline and earlier releases", () => {
  const active = {
    phase: "live" as const,
    active: true,
    environment: "staging" as const,
  };
  expect(releaseStatus(active).label).toBe("On staging");
  expect(releaseStatus({ ...active, environment: "production" }).label).toBe(
    "Live",
  );
  expect(releaseStatus({ ...active, offline: true }).label).toBe("Offline");
  expect(releaseStatus({ ...active, offline: true, active: false }).label).toBe(
    "Earlier release",
  );
  for (const phase of [
    "queued",
    "building",
    "activating",
    "verifying",
    "failed",
    "rolled_back",
    "recovery_required",
  ] as const)
    expect(releaseStatus({ ...active, phase }).label).not.toMatch(
      /^(Live|On staging)$/,
    );
});
it("requires both successful deployment and a matching destination observation", () => {
  const save = {
    phase: "saved",
    release: { state: "succeeded" },
    delivery: "reported",
  } as RepositorySaveStatus;
  const publish = {
    phase: "sent",
    release: { state: "succeeded" },
    delivery: "reported",
  } as RepositoryPublishStatus;
  expect(repositorySaveState(save)).toBe("staging");
  expect(repositoryPublicationState(publish)).toBe("live");
  for (const delivery of [undefined, "waiting", "unavailable"] as const) {
    expect(repositorySaveState({ ...save, delivery })).toBe("saved");
    expect(repositoryPublicationState({ ...publish, delivery })).toBe("saved");
    expect(clientDeploymentMessage("succeeded", delivery)).not.toMatch(
      /^On staging/,
    );
  }
  for (const state of [
    "queued",
    "building",
    "waiting",
    "failed",
    "unavailable",
  ] as const) {
    expect(
      repositorySaveState({ ...save, release: { state, message: "test" } }),
    ).toBe("saved");
    expect(
      repositoryPublicationState({
        ...publish,
        release: { state, message: "test" },
      }),
    ).toBe("saved");
  }
});
it("keeps account drafts Saved even when the website folder is deployed and rejects malformed observations", () => {
  const observation = {
    state: "live" as const,
    head: "a".repeat(40),
    draftRoutes: ["src/pages/about.astro"],
    checkedAt: page.updatedAt,
    detail: "Verified fixture version.",
  };
  expect(websitePageStatus(observation, "src/pages/about.astro").label).toBe(
    "Saved",
  );
  expect(websitePageStatus(observation, "src/pages/index.astro").label).toBe(
    "Live",
  );
  expect(websitePageStatus(undefined, "src/pages/index.astro").label).toBe(
    "Saved",
  );
  expect(readWebsiteStatus(observation)).toEqual(observation);
  for (const value of [
    null,
    {},
    { ...observation, state: "building" },
    { ...observation, head: "" },
    { ...observation, checkedAt: "bad" },
    { ...observation, draftRoutes: [7] },
  ])
    expect(readWebsiteStatus(value)).toBeUndefined();
});

it("describes a reviewed staged version only when the observed checkout matches that review", () => {
  const commit = "a".repeat(40);
  const review = {
    phase: "reviewed",
    review: { commit },
  } as RepositoryPublishStatus;
  const website = {
    state: "staging" as const,
    head: commit,
    draftRoutes: [],
    checkedAt: page.updatedAt,
    detail: "Fixture staging observation",
  };
  expect(repositoryPublicationState(review, website)).toBe("staging");
  expect(
    repositoryPublicationState(review, { ...website, head: "b".repeat(40) }),
  ).toBe("saved");
});
