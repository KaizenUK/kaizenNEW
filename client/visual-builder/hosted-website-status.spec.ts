import { afterEach, expect, it, vi } from "vitest";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  hostedHelperFixture,
  helperProject,
  helperOtherProject,
  helperOwner,
  helperEditor,
} from "../../tests/builder/hosted-helper-fixture";
import { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const api of fixtures.splice(0)) await api.close();
});
const staging = {
  environment: "staging" as const,
  url: "https://stage.fixture.invalid",
  workflow: "deploy.yml",
};
const production = {
  environment: "production" as const,
  branch: "main",
  url: "https://production.fixture.invalid",
  workflow: "deploy.yml",
};
async function fixture() {
  const deployment = {
    stage: "",
    main: "",
    success: true,
    unavailable: false,
    during: undefined as (() => Promise<void>) | undefined,
  };
  const request = vi.fn(async (value: string | URL | Request) => {
    const url = new URL(String(value));
    if (deployment.during) {
      const during = deployment.during;
      deployment.during = undefined;
      await during();
    }
    if (deployment.unavailable) return new Response(null, { status: 503 });
    if (url.hostname === "api.github.com")
      return Response.json({
        workflow_runs: [
          {
            id: 1,
            event: "push",
            head_sha: url.searchParams.get("head_sha"),
            head_branch: url.searchParams.get("branch"),
            status: "completed",
            conclusion: deployment.success ? "success" : "failure",
          },
        ],
      });
    return Response.json({
      schemaVersion: 1,
      commit: url.origin === staging.url ? deployment.stage : deployment.main,
      releaseId: "fixture-release",
    });
  });
  const api = await hostedHelperFixture(
    undefined,
    undefined,
    undefined,
    undefined,
    { target: staging, releases: new HostedSaveReleases({ fetch: request }) },
    undefined,
    { target: production, fetch: request },
  );
  fixtures.push(api);
  const inspection = (
    await api.send({
      action: "repository-source-inspect",
      route: "src/pages/index.astro",
    })
  ).body;
  const head = await api.git(inspection.root, ["rev-parse", "HEAD"]);
  deployment.stage = head;
  deployment.main = "b".repeat(40);
  return { api, inspection, head, deployment, request };
}
const status = (api: Fixture, actor = helperOwner, projectId = helperProject) =>
  api.send({ action: "repository-website-status", projectId }, actor);
it("observes clean staging and production without changing the folder or remote", async () => {
  const { api, inspection, head, deployment, request } = await fixture();
  const before = await readFile(
    path.join(inspection.root, "src/pages/index.astro"),
  );
  expect(await status(api)).toMatchObject({
    status: 200,
    body: { state: "staging", head, draftRoutes: [] },
  });
  expect(
    request.mock.calls.some(([url]) => String(url).startsWith(production.url)),
  ).toBe(true);
  deployment.main = head;
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11000);
  expect((await status(api)).body.state).toBe("live");
  expect(await api.git(inspection.root, ["status", "--porcelain"])).toBe("");
  expect(await api.git(api.remote, ["rev-parse", "stage"])).toBe(head);
  expect(
    await readFile(path.join(inspection.root, "src/pages/index.astro")),
  ).toEqual(before);
});
it.each(["different", "failed", "unavailable"])(
  "keeps a %s destination observation Saved",
  async (outcome) => {
    const { api, deployment } = await fixture();
    if (outcome === "different") deployment.stage = "c".repeat(40);
    if (outcome === "failed") deployment.success = false;
    if (outcome === "unavailable") deployment.unavailable = true;
    expect((await status(api)).body.state).toBe("saved");
  },
);
it("keeps unsent source Saved without network reads and rechecks a checkout changed during observation", async () => {
  const { api, inspection, deployment, request } = await fixture();
  const readme = path.join(inspection.root, "README.md");
  const original = await readFile(readme);
  await writeFile(readme, "Keep unrelated work\n");
  request.mockClear();
  expect((await status(api)).body.state).toBe("saved");
  expect(request).not.toHaveBeenCalled();
  await writeFile(readme, original);
  deployment.during = async () => {
    await api.git(inspection.root, [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "--allow-empty",
      "-m",
      "Concurrent checkout advance",
    ]);
  };
  expect((await status(api)).body.state).toBe("saved");
  expect(await readFile(readme)).toEqual(original);
});
it("returns only the caller's draft routes and enforces membership even without publishing access", async () => {
  const { api, inspection } = await fixture();
  const field = inspection.fields.find(
    (field: { value: string }) => field.value === "Hosted original",
  );
  expect(
    (
      await api.send({
        action: "repository-source-draft-save",
        route: inspection.route,
        version: 0,
        edits: {
          inspection,
          values: { [field.id]: "Private fixture wording" },
          orders: {},
        },
      })
    ).status,
  ).toBe(200);
  const own = await status(api);
  expect(own.body.draftRoutes).toEqual([inspection.route]);
  expect(JSON.stringify(own.body)).not.toContain("Private fixture wording");
  api.publishers.get(helperProject)!.delete(helperEditor);
  expect(await status(api, helperEditor)).toMatchObject({
    status: 200,
    body: { draftRoutes: [] },
  });
  expect(
    (await status(api, helperOwner, helperOtherProject)).body.draftRoutes,
  ).toEqual([]);
  api.members.get(helperProject)!.delete(helperEditor);
  expect((await status(api, helperEditor)).status).toBe(403);
  expect(
    (await status(api, helperOwner, "55555555-5555-4555-8555-555555555555"))
      .status,
  ).toBe(403);
});
it("bounds and caches public marker observations without forwarding the GitHub credential", async () => {
  let commit = "a".repeat(40),
    oversized = false;
  const request = vi.fn(
    async (_url: string | URL | Request, options?: RequestInit) => {
      expect(new Headers(options?.headers).has("Authorization")).toBe(false);
      expect(options).toMatchObject({ redirect: "error", cache: "no-store" });
      return oversized
        ? new Response("x".repeat(8193))
        : Response.json({
            schemaVersion: 1,
            commit,
            releaseId: "fixture-release",
          });
    },
  );
  const releases = new HostedSaveReleases({
    githubToken: "fixture-private-token",
    fetch: request,
  });
  const first = commit;
  expect(await releases.delivery(staging.url, first)).toBe("reported");
  commit = "b".repeat(40);
  expect(await releases.delivery(staging.url, commit)).toBe("waiting");
  expect(request).toHaveBeenCalledTimes(1);
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 11000);
  expect(await releases.delivery(staging.url, commit)).toBe("reported");
  expect(await releases.delivery(production.url, first)).toBe("waiting");
  expect(request).toHaveBeenCalledTimes(3);
  oversized = true;
  vi.spyOn(Date, "now").mockReturnValue(now + 22000);
  expect(await releases.delivery(staging.url, commit)).toBe("unavailable");
  expect(await releases.delivery(staging.url, commit)).toBe("unavailable");
  expect(request).toHaveBeenCalledTimes(4);
});
