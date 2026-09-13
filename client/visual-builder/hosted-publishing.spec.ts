import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFile, lstat, rm } from "node:fs/promises";
import path from "node:path";
import {
  hostedHelperFixture,
  helperProject,
  helperOwner,
  helperEditor,
  helperOtherProject,
} from "../../tests/builder/hosted-helper-fixture";
import { hostedProjectRepositories } from "../../scripts/builder-hosted-folders";
import { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";
import { hostedReleaseMarker } from "../../scripts/builder-hosted-publishing";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const api of fixtures.splice(0).reverse()) await api.close();
});
const staging = {
  environment: "staging" as const,
  url: "https://stage.fixture.invalid",
};
const production = {
  environment: "production" as const,
  branch: "main",
  url: "https://production.fixture.invalid",
};
async function fixture() {
  const deployed = {
    stage: "",
    main: "",
    stageId: "fixture-stage",
    mainId: "fixture-main",
  };
  const requests: { url: string; options?: RequestInit }[] = [];
  const api = await hostedHelperFixture(
    undefined,
    undefined,
    undefined,
    undefined,
    { target: staging },
    undefined,
    {
      target: production,
      fetch: async (url: string | URL | Request, options?: RequestInit) => {
        requests.push({ url: String(url), options });
        const stage = new URL(String(url)).origin === staging.url;
        return Response.json({
          schemaVersion: 1,
          commit: stage ? deployed.stage : deployed.main,
          releaseId: stage ? deployed.stageId : deployed.mainId,
        });
      },
    },
  );
  fixtures.push(api);
  await api.git(api.seed, [
    "commit",
    "--allow-empty",
    "-m",
    "Second baseline commit",
  ]);
  await api.git(api.seed, ["push", api.remote, "stage"]);
  const base = await api.git(api.remote, ["rev-parse", "stage"]);
  await api.git(api.remote, ["branch", "main", base]);
  deployed.stage = deployed.main = base;
  return { api, deployed, requests, base };
}
async function saved(api: Fixture) {
  const inspected = (
    await api.send({
      action: "repository-source-inspect",
      route: "src/pages/index.astro",
    })
  ).body;
  const heading = inspected.fields.find(
    (field: { value: string }) => field.value === "Hosted original",
  );
  const plan = await api.send({
    action: "repository-source-prepare",
    edits: {
      inspection: inspected,
      values: { [heading.id]: "Reviewed staging heading" },
      orders: {},
    },
  });
  expect(plan.status).toBe(200);
  expect(
    (await api.send({ action: "repository-apply", planId: plan.body.id }))
      .status,
  ).toBe(200);
  const result = await api.send({
    action: "repository-save",
    planId: plan.body.id,
    message: "Update the website heading",
  });
  expect(result).toMatchObject({ status: 200, body: { phase: "saved" } });
  return result.body.commit as string;
}
const review = (api: Fixture, actor = helperOwner) =>
  api.send({ action: "repository-publish-review" }, actor);
const publish = (
  api: Fixture,
  reviewId: unknown,
  actor = helperOwner,
  extra = {},
) => api.send({ action: "repository-publish", reviewId, ...extra }, actor);
const status = (api: Fixture, reviewId?: string) =>
  api.send({
    action: "repository-publish-status",
    ...(reviewId ? { reviewId } : {}),
  });
const main = (api: Fixture) => api.git(api.remote, ["rev-parse", "main"]);
async function ready() {
  const data = await fixture();
  data.deployed.stage = await saved(data.api);
  return data;
}

describe("reviewed production publication", () => {
  it("promotes the exact staged commit without creating a commit or switching the checkout and separately reports production delivery", async () => {
    const { api, deployed, requests, base } = await ready();
    expect(
      (await api.send({ action: "repository-connect" })).body.canPublishWebsite,
    ).toBe(true);
    const inspected = await review(api);
    expect(inspected).toMatchObject({
      status: 200,
      body: {
        phase: "reviewed",
        review: {
          commit: deployed.stage,
          productionBase: base,
          files: ["src/pages/index.astro"],
          stagingUrl: staging.url,
          productionUrl: production.url,
        },
      },
    });
    expect(await main(api)).toBe(base);
    for (const missingReview of [undefined, null, "", 123])
      expect((await publish(api, missingReview)).status).toBe(409);
    expect(await main(api)).toBe(base);
    const pushed = await publish(api, inspected.body.review.id, helperOwner, {
      branch: "attacker",
      commit: base,
      productionUrl: "https://outside.invalid",
    });
    expect(pushed).toMatchObject({
      status: 200,
      body: {
        phase: "sent",
        delivery: "waiting",
        release: { state: "unavailable" },
      },
    });
    expect(await main(api)).toBe(deployed.stage);
    expect(
      await api.git(api.folders.root(helperProject), [
        "branch",
        "--show-current",
      ]),
    ).toBe("stage");
    expect(
      await api.git(api.remote, ["show", "main:src/pages/index.astro"]),
    ).toContain("Reviewed staging heading");
    expect(
      await api.git(api.folders.root(helperProject), ["status", "--porcelain"]),
    ).toBe("");
    expect((await publish(api, inspected.body.review.id)).status).toBe(409);
    deployed.main = deployed.stage;
    expect((await status(api)).body).toMatchObject({
      phase: "sent",
      delivery: "reported",
    });
    expect((await review(api)).status).toBe(409);
    expect(
      requests.every((item) =>
        [staging.url, production.url].includes(new URL(item.url).origin),
      ),
    ).toBe(true);
    for (const request of requests) {
      expect(request.options).toMatchObject({
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      expect(request.options?.headers).not.toHaveProperty("Authorization");
    }
  });
  it("requires publish permission even for owners before touching disk, and keeps reviews bound to their project and publisher", async () => {
    const { api, deployed } = await fixture();
    api.publishers.get(helperProject)!.clear();
    for (const action of [
      "repository-publish-review",
      "repository-publish",
      "repository-publish-status",
    ])
      expect((await api.send({ action })).status).toBe(403);
    await expect(lstat(api.folders.directory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    deployed.stage = await saved(api);
    api.publishers.get(helperProject)!.add(helperEditor);
    const reviewed = await review(api, helperEditor);
    expect(reviewed.status).toBe(200);
    api.publishers.get(helperProject)!.add(helperOwner);
    expect((await publish(api, reviewed.body.review.id)).status).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-publish",
          projectId: helperOtherProject,
          reviewId: reviewed.body.review.id,
        })
      ).status,
    ).toBe(409);
    api.archived.add(helperProject);
    expect(
      (await publish(api, reviewed.body.review.id, helperEditor)).status,
    ).toBe(403);
  });
  it("requires the saved revision to be deployed on staging and refuses dirty work, moved staging and a changed staging release", async () => {
    const { api, deployed, base } = await fixture();
    const commit = await saved(api);
    expect((await review(api)).body.error).toContain("not serving");
    deployed.stage = commit;
    const root = api.folders.root(helperProject);
    await writeFile(path.join(root, "README.md"), "New pending work\n");
    expect((await review(api)).body.error).toContain("unsaved");
    await api.git(root, ["restore", "README.md"]);
    const reviewed = await review(api);
    deployed.stageId = "new-staging-release";
    expect((await publish(api, reviewed.body.review.id)).body.error).toContain(
      "staging deployment changed",
    );
    expect(await main(api)).toBe(base);
    const second = await review(api);
    await api.git(api.remote, ["update-ref", "refs/heads/stage", base, commit]);
    expect((await publish(api, second.body.review.id)).body.error).toContain(
      "staging branch changed",
    );
    expect(await main(api)).toBe(base);
  });
  it("checks permission again after waiting for the lock and immediately before pushing", async () => {
    const { api, deployed, base } = await ready();
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = api.folders.locked(helperProject, async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await waiting;
    const calls = api.calls.length;
    const request = review(api);
    await expect
      .poll(() =>
        api.calls
          .slice(calls)
          .some((call) => call.body?.capability === "publish"),
      )
      .toBe(true);
    api.publishers.get(helperProject)!.delete(helperOwner);
    release();
    await held;
    expect((await request).status).toBe(403);
    api.publishers.get(helperProject)!.add(helperOwner);
    const reviewed = await review(api);
    const original = api.folders.productionHead.bind(api.folders);
    vi.spyOn(api.folders, "productionHead").mockImplementationOnce(
      async (id) => {
        const result = await original(id);
        api.publishers.get(id)!.delete(helperOwner);
        return result;
      },
    );
    expect((await publish(api, reviewed.body.review.id)).status).toBe(403);
    expect(await main(api)).toBe(base);
    expect(deployed.stage).not.toBe(base);
  });
  it.each(["advance", "rewind"])(
    "rejects a production %s at push time without rewriting remote work",
    async (direction) => {
      const { api, base } = await ready();
      const reviewed = await review(api),
        original = api.folders.pushPublication.bind(api.folders);
      const changed =
        direction === "rewind"
          ? await api.git(api.seed, ["rev-parse", "HEAD^"])
          : (await api.git(api.seed, [
              "commit",
              "--allow-empty",
              "-m",
              "Concurrent production work",
            ]),
            await api.git(api.seed, ["rev-parse", "HEAD"]));
      if (direction === "advance")
        await api.git(api.seed, [
          "push",
          api.remote,
          "HEAD:refs/heads/fixture-production-object",
        ]);
      vi.spyOn(api.folders, "pushPublication").mockImplementationOnce(
        async (id, commit, old, authorize) => {
          await api.git(api.remote, [
            "update-ref",
            "refs/heads/main",
            changed,
            base,
          ]);
          return original(id, commit, old, authorize);
        },
      );
      const result = await publish(api, reviewed.body.review.id);
      expect(result).toMatchObject({
        status: 200,
        body: { phase: "uncertain" },
      });
      expect(await main(api)).toBe(changed);
      expect((await review(api)).body.error).toContain("outstanding");
    },
  );
  it("refuses divergent production history even when replacement refs make it appear ancestral", async () => {
    const { api, deployed } = await ready();
    await writeFile(
      path.join(api.seed, "README.md"),
      "Other production content\n",
    );
    await api.git(api.seed, ["commit", "-am", "Independent production work"]);
    await api.git(api.seed, ["push", api.remote, "HEAD:main"]);
    const remote = await main(api),
      root = api.folders.root(helperProject);
    await api.folders.fetchProduction(helperProject);
    await api.git(root, ["replace", "--graft", deployed.stage, remote]);
    expect((await review(api)).body.error).toContain(
      "outside this staging revision",
    );
    expect(await main(api)).toBe(remote);
  });
  it("keeps rejected publication available for explicit retry and resolves a lost acknowledgement without another push", async () => {
    const { api, deployed, base } = await ready();
    const reviewed = await review(api),
      hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(
      hook,
      "#!/bin/sh\necho private-rejection-detail >&2\nexit 1\n",
      { mode: 0o700 },
    );
    const failed = await publish(api, reviewed.body.review.id);
    expect(failed).toMatchObject({ status: 200, body: { phase: "reviewed" } });
    expect(JSON.stringify(failed.body)).not.toContain(
      "private-rejection-detail",
    );
    expect(await main(api)).toBe(base);
    expect((await status(api)).body.phase).toBe("reviewed");
    expect(await main(api)).toBe(base);
    await rm(hook);
    const original = api.folders.pushPublication.bind(api.folders);
    const push = vi
      .spyOn(api.folders, "pushPublication")
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new Error("lost fixture acknowledgement");
      });
    expect((await publish(api, reviewed.body.review.id)).body.phase).toBe(
      "sent",
    );
    expect(await main(api)).toBe(deployed.stage);
    await status(api);
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("expires reviews and refuses publication while the real build lock is held", async () => {
    const { api, base } = await ready();
    const reviewed = await review(api);
    const release = await api.folders.locked(helperProject, () =>
      api.folders.claimBuild(helperProject, "fixture-build"),
    );
    try {
      expect(
        (await publish(api, reviewed.body.review.id)).body.error,
      ).toContain("build owns");
    } finally {
      await release();
    }
    vi.spyOn(Date, "now").mockReturnValue(reviewed.body.review.expiresAt + 1);
    expect((await publish(api, reviewed.body.review.id)).body.error).toContain(
      "expired",
    );
    expect(await main(api)).toBe(base);
  });
  it("accepts only a distinct operator-configured production destination and does not let owner retargeting retain its approval", async () => {
    const repo = {
      projectId: helperProject,
      repositoryUrl: "git@github.com:fixture/site.git",
      branch: "stage",
      saveToWebsite: staging,
    };
    for (const target of [
      { ...production, branch: "stage" },
      { ...production, url: staging.url },
      { ...production, branch: "../main" },
      { ...production, url: "http://outside.invalid" },
      { ...production, privateKey: "no" },
      { ...production, workflow: "../deploy.yml" },
    ])
      expect(() =>
        hostedProjectRepositories({
          version: 1,
          projects: [{ ...repo, publishToWebsite: target }],
        }),
      ).toThrow();
    expect(() =>
      hostedProjectRepositories({
        version: 1,
        projects: [
          { ...repo, saveToWebsite: undefined, publishToWebsite: production },
        ],
      }),
    ).toThrow();
    const { api } = await fixture();
    const keyFile = path.join(api.credentials, helperProject, "known_hosts");
    // The non-setup transport fixture has a synthetic host line; replace only this temporary host file for settings validation.
    await writeFile(
      keyFile,
      "fixture.invalid ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n",
      { mode: 0o600 },
    );
    const result = await api.send({
      action: "repository-settings-save",
      version: 0,
      repository: {
        repositoryUrl: "git@fixture.invalid:fixture/site.git",
        branch: "preview",
      },
    });
    expect(result.status).toBe(200);
    expect(api.folders.configuration(helperProject)).not.toHaveProperty(
      "publishToWebsite",
    );
  });
});

describe("publication delivery observations", () => {
  it("rejects missing, forged, oversized and unavailable markers and never sends credentials", async () => {
    for (const value of [
      { schemaVersion: 2, commit: "a".repeat(40), releaseId: "fixture" },
      { schemaVersion: 1, commit: "bad", releaseId: "fixture" },
      { schemaVersion: 1, commit: "a".repeat(40), releaseId: "../fixture" },
    ])
      await expect(
        hostedReleaseMarker(staging.url, async () => Response.json(value)),
      ).rejects.toThrow("deployed revision");
    await expect(
      hostedReleaseMarker(
        staging.url,
        async () => new Response("x".repeat(8193)),
      ),
    ).rejects.toThrow();
    await expect(
      hostedReleaseMarker(
        staging.url,
        async () => new Response("", { status: 503 }),
      ),
    ).rejects.toThrow();
  });
  it("does not reuse a staging workflow result when checking production for the same commit", async () => {
    const calls: URL[] = [];
    const releases = new HostedSaveReleases({
      fetch: async (url: string | URL | Request) => {
        const parsed = new URL(String(url));
        calls.push(parsed);
        return Response.json({
          workflow_runs: [
            {
              id: calls.length,
              head_sha: "a".repeat(40),
              head_branch: parsed.searchParams.get("branch"),
              event: "push",
              status: "completed",
              conclusion: "success",
            },
          ],
        });
      },
    });
    const repo = {
      projectId: helperProject,
      repositoryUrl: "git@github.com:fixture/site.git",
      branch: "stage",
      saveToWebsite: { ...staging, workflow: "deploy.yml" },
    };
    expect((await releases.status(repo, "a".repeat(40))).message).toContain(
      "staging",
    );
    expect(
      (
        await releases.status(repo, "a".repeat(40), {
          ...production,
          workflow: "deploy.yml",
        })
      ).message,
    ).toContain("production");
    expect(calls.map((url) => url.searchParams.get("branch"))).toEqual([
      "stage",
      "main",
    ]);
  });
});
