import { describe, expect, it } from "vitest";
import {
  firstRunEligible,
  firstRunKey,
  firstRunSteps,
  newProjectWorkspace,
  previewDigest,
  readFirstRun,
} from "./firstRun";
import {
  DEFAULT_PROJECT_CAPABILITIES,
  LEGACY_PROJECT_CAPABILITIES,
  type BuilderProject,
} from "../../shared/builderProjects";
import type { Workspace, BuilderPage } from "../../shared/visualBuilder";
import type { ClientPublicationJob } from "../../shared/builderClientPublication";
import { initialSiteState } from "../../shared/builderSite";
import { newDocument } from "./starters";

const project: BuilderProject = {
  id: "project-a",
  name: "Garden",
  createdAt: "",
  updatedAt: "",
  archived: false,
  version: 1,
  capabilities: DEFAULT_PROJECT_CAPABILITIES,
  destination: { kind: "unconfigured", label: "Not connected" },
};
const workspace = (): Workspace => ({
  pages: [],
  assets: [],
  saved: [],
  site: initialSiteState(),
});
const page = (): BuilderPage => ({
  id: "page-a",
  version: 1,
  draft: newDocument("Home", "home", true),
  published: null,
  updatedAt: "",
  revisions: [],
});
const live = (): ClientPublicationJob => ({
  id: "job",
  destination: {
    projectId: project.id,
    destinationId: "staging",
    environment: "staging",
    origin: "https://fixture.test",
    label: "Staging",
  },
  action: "publish",
  phase: "live",
  active: true,
  createdAt: "",
  updatedAt: "",
  previousReleaseId: null,
  artifactId: "artifact",
  log: "",
});

describe("first-run checklist", () => {
  it("enrolls only an empty builder project, excluding website folders, Kaizen, archives and unknown metadata", () => {
    expect(firstRunEligible(project)).toBe(true);
    expect(newProjectWorkspace(workspace())).toBe(true);
    expect(firstRunEligible(undefined)).toBe(false);
    expect(firstRunEligible(project, true)).toBe(false);
    expect(firstRunEligible({ ...project, archived: true })).toBe(false);
    expect(
      firstRunEligible({
        ...project,
        capabilities: LEGACY_PROJECT_CAPABILITIES,
      }),
    ).toBe(false);
    expect(newProjectWorkspace({ ...workspace(), pages: [page()] })).toBe(
      false,
    );
    expect(
      newProjectWorkspace({
        ...workspace(),
        site: { ...initialSiteState(), version: 1 },
      }),
    ).toBe(false);
  });

  it("derives steps from saved work and a verified delivery, never a published snapshot alone", () => {
    expect(
      firstRunSteps(project, workspace(), false, []).map(
        (step) => step.complete,
      ),
    ).toEqual([true, false, false, false, false]);
    const saved = page();
    saved.published = saved.draft;
    const ready = {
      ...workspace(),
      pages: [saved],
      site: { ...initialSiteState(), version: 1 },
    };
    expect(
      firstRunSteps(project, ready, true, []).map((step) => step.complete),
    ).toEqual([true, true, true, true, false]);
    expect(
      firstRunSteps(project, ready, true, [live()]).every(
        (step) => step.complete,
      ),
    ).toBe(true);
    expect(firstRunSteps(project, workspace(), true, [])[3].complete).toBe(
      false,
    );
  });

  it.each([
    "queued",
    "building",
    "activating",
    "verifying",
    "failed",
    "recovery_required",
    "rolled_back",
  ] as const)("does not tick publication while %s", (phase) => {
    expect(
      firstRunSteps(project, workspace(), false, [{ ...live(), phase }])[4]
        .complete,
    ).toBe(false);
  });
  it("excludes inactive, removed and another project's releases, but accepts a verified restoration", () => {
    for (const job of [
      { ...live(), active: false },
      { ...live(), action: "unpublish" as const },
      { ...live(), destination: { ...live().destination, projectId: "other" } },
    ])
      expect(
        firstRunSteps(project, workspace(), false, [job])[4].complete,
      ).toBe(false);
    expect(
      firstRunSteps(project, workspace(), false, [
        { ...live(), action: "rollback" },
      ])[4].complete,
    ).toBe(true);
  });

  it("scopes preferences to both account and project and reads only the supported shape", () => {
    expect(
      new Set([
        firstRunKey("a", "p"),
        firstRunKey("b", "p"),
        firstRunKey("a", "q"),
        firstRunKey("a:p", "q"),
        firstRunKey("a", "p:q"),
      ]).size,
    ).toBe(5);
    const saved = {
      schemaVersion: 1,
      enrolled: true,
      dismissed: true,
      preview: { pageId: "page", digest: "a".repeat(64) },
    };
    expect(readFirstRun(JSON.stringify(saved))).toEqual(saved);
    for (const value of [
      null,
      "bad json",
      "null",
      "{}",
      '{"schemaVersion":2,"enrolled":true,"dismissed":true}',
    ])
      expect(readFirstRun(value)).toBeUndefined();
    expect(
      readFirstRun(
        JSON.stringify({
          ...saved,
          preview: { pageId: "page", digest: "untrusted" },
        }),
      )?.preview,
    ).toBeUndefined();
  });

  it("invalidates the remembered preview after page, design or asset bytes change, without storing their content", async () => {
    const w = workspace(),
      draft = page().draft;
    const original = await previewDigest(draft, w);
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await previewDigest(structuredClone(draft), structuredClone(w)),
    ).toBe(original);
    expect(await previewDigest({ ...draft, title: "Changed" }, w)).not.toBe(
      original,
    );
    const design = structuredClone(w);
    design.site!.draft.theme.accent = "#ff0000";
    expect(await previewDigest(draft, design)).not.toBe(original);
    const assetWorkspace = {
      ...w,
      assets: [
        { id: "image", hash: "changed-bytes" } as Workspace["assets"][number],
      ],
    };
    expect(await previewDigest(draft, assetWorkspace)).not.toBe(original);
  });
});
