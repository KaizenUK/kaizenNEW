import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  hostedHelperFixture,
  helperOwner,
  helperEditor,
  helperProject,
  helperOtherProject,
} from "../../tests/builder/hosted-helper-fixture";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { HostedHelperError } from "../../scripts/builder-hosted-auth";
import { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";
import { hostedProjectRepositories } from "../../scripts/builder-hosted-folders";
import type { SourceInspection } from "../../shared/builderSourceEditing";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const api of fixtures.splice(0).reverse()) await api.close();
});
async function fixture() {
  const api = await hostedHelperFixture(
    undefined,
    undefined,
    undefined,
    undefined,
    {
      target: { environment: "staging", url: "https://stage.fixture.invalid" },
    },
  );
  fixtures.push(api);
  return api;
}
async function apply(api: Fixture, actor = helperOwner) {
  const inspected = await api.send(
    { action: "repository-source-inspect", route: "src/pages/index.astro" },
    actor,
  );
  expect(inspected.status).toBe(200);
  const inspection: SourceInspection = inspected.body;
  const heading = inspection.fields.find(
    (field) => field.value === "Hosted original",
  )!;
  const plan = await api.send(
    {
      action: "repository-source-prepare",
      edits: {
        inspection,
        values: { [heading.id]: "Saved by the hosted editor" },
        orders: {},
      },
    },
    actor,
  );
  expect(plan.status).toBe(200);
  const result = await api.send(
    { action: "repository-apply", planId: plan.body.id },
    actor,
  );
  expect(result.status).toBe(200);
  return {
    planId: result.body.planId,
    root: inspection.root,
    base: await api.git(inspection.root, ["rev-parse", "HEAD"]),
  };
}
const save = (
  api: Fixture,
  planId: string,
  actor = helperOwner,
  extra: Record<string, unknown> = {},
) =>
  api.send(
    {
      action: "repository-save",
      planId,
      message: "Update the website heading",
      ...extra,
    },
    actor,
  );
const remote = (api: Fixture) =>
  api.git(api.remote, ["rev-parse", "refs/heads/stage"]);
async function advance(api: Fixture) {
  await api.git(api.seed, [
    "commit",
    "--allow-empty",
    "-m",
    "Other remote work",
  ]);
  await api.git(api.seed, ["push", api.remote, "stage"]);
  return remote(api);
}
describe("hosted Save to website", () => {
  it("uses restricted hosted Git for the status refresh instead of running repository-configured programs", async () => {
    const api = await fixture();
    await api.send({ action: "repository-connect" });
    const root = api.folders.root(helperProject);
    const hook = path.join(root, ".git/hooks/fixture-fsmonitor");
    const marker = path.join(root, ".git/hooks/fsmonitor-ran");
    await mkdir(path.dirname(hook));
    await writeFile(
      hook,
      '#!/bin/sh\ntouch "$(dirname "$0")/fsmonitor-ran"\nexit 1\n',
      { mode: 0o700 },
    );
    await api.git(root, ["config", "core.fsmonitor", hook]);
    expect((await api.send({ action: "repository-git-status" })).status).toBe(
      200,
    );
    await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("commits only applied files as the verified account, pushes the configured branch and restores its status after reopening", async () => {
    const api = await fixture(),
      applied = await apply(api);
    await writeFile(
      path.join(applied.root, "README.md"),
      "Unrelated dirty work\n",
    );
    await api.git(applied.root, [
      "config",
      "user.name",
      "Wrong service identity",
    ]);
    await api.git(applied.root, [
      "config",
      "user.email",
      "wrong@example.invalid",
    ]);
    const result = await save(api, applied.planId, helperOwner, {
      author: { name: "Impersonated", email: "fake@example.invalid" },
      branch: "main",
      repositoryUrl: "git@outside.invalid:other/site.git",
    });
    expect(result).toMatchObject({
      status: 200,
      body: {
        phase: "saved",
        projectId: helperProject,
        branch: "stage",
        destinationUrl: "https://stage.fixture.invalid",
      },
    });
    const commit = result.body.commit;
    expect(await remote(api)).toBe(commit);
    expect(
      await api.git(api.remote, ["show", "stage:src/pages/index.astro"]),
    ).toContain("Saved by the hosted editor");
    expect(
      await api.git(applied.root, [
        "show",
        "-s",
        "--format=%an <%ae>%n%cn <%ce>",
        commit,
      ]),
    ).toBe(
      "Fixture owner <owner@example.invalid>\nFixture owner <owner@example.invalid>",
    );
    expect(
      await api.git(applied.root, [
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        commit,
      ]),
    ).toBe("src/pages/index.astro");
    expect(await api.git(api.remote, ["show", "stage:README.md"])).toBe(
      "Unrelated repository content",
    );
    expect(await readFile(path.join(applied.root, "README.md"), "utf8")).toBe(
      "Unrelated dirty work\n",
    );
    expect(await api.git(api.remote, ["branch", "--list", "main"])).toBe("");
    const reopened = await api.send({
      action: "repository-save-status",
      route: "src/pages/index.astro",
    });
    expect(reopened.body).toMatchObject({ phase: "saved", commit });
    expect(
      (
        await api.send(
          { action: "repository-save-status", route: "src/pages/index.astro" },
          helperEditor,
        )
      ).body,
    ).toBeNull();
    expect((await save(api, applied.planId)).body.commit).toBe(commit);
    expect(await api.git(api.remote, ["rev-list", "--count", "stage"])).toBe(
      "2",
    );
  });
  it("refuses staged work and changed applied bytes without changing local or remote history", async () => {
    const api = await fixture(),
      applied = await apply(api);
    await writeFile(path.join(applied.root, "README.md"), "Staged elsewhere");
    await api.git(applied.root, ["add", "README.md"]);
    expect(await save(api, applied.planId)).toMatchObject({
      status: 409,
      body: { error: expect.stringMatching(/already staged/) },
    });
    expect(
      await api.git(applied.root, ["diff", "--cached", "--name-only"]),
    ).toBe("README.md");
    await api.git(applied.root, ["reset", "--", "README.md"]);
    await writeFile(
      path.join(applied.root, "src/pages/index.astro"),
      "<h1>Later source edit</h1>",
    );
    expect(await save(api, applied.planId)).toMatchObject({
      status: 409,
      body: { error: expect.stringMatching(/Changed since apply/) },
    });
    expect(await remote(api)).toBe(applied.base);
    expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(
      applied.base,
    );
  });
  it("requires an account name/email and current owner of the applied plan, never request-supplied authorship", async () => {
    const api = await fixture(),
      applied = await apply(api);
    expect((await save(api, applied.planId, helperEditor)).status).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-save",
          projectId: helperOtherProject,
          planId: applied.planId,
          message: "Wrong project",
        })
      ).status,
    ).toBe(409);
    const profile = api.profiles.get(helperOwner)!;
    for (const name of ["", "Unsafe\nName", "Spoof <other>"]) {
      profile.user_metadata.full_name = name;
      expect((await save(api, applied.planId)).status).toBe(409);
    }
    profile.user_metadata.full_name = "Fixture owner";
    for (const email of [
      "invalid",
      "too@many@example.invalid",
      "bad@example.\u0000invalid",
    ]) {
      profile.email = email;
      expect((await save(api, applied.planId)).status).toBe(409);
    }
    expect(await remote(api)).toBe(applied.base);
  });
  it("refuses a remotely advanced branch before making a commit", async () => {
    const api = await fixture(),
      applied = await apply(api),
      moved = await advance(api);
    expect(await save(api, applied.planId)).toMatchObject({
      status: 409,
      body: { error: expect.stringMatching(/branch moved/) },
    });
    expect(await remote(api)).toBe(moved);
    expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(
      applied.base,
    );
  });
  it("refuses saving during a build and ignores replacement refs when proving the push has exactly one new commit", async () => {
    const api = await fixture(),
      applied = await apply(api);
    const lock = path.join(
      api.folders.directory,
      "locks",
      `${helperProject}.build.lock`,
    );
    await writeFile(lock, "fixture-running-build");
    expect((await save(api, applied.planId)).status).toBe(409);
    expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(
      applied.base,
    );
    await rm(lock);
    const identity = [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
    ];
    for (const message of ["Unreviewed parent", "Disguised child"])
      await api.git(applied.root, [
        ...identity,
        "commit",
        "--allow-empty",
        "-m",
        message,
      ]);
    const child = await api.git(applied.root, ["rev-parse", "HEAD"]);
    await api.git(applied.root, [
      ...identity,
      "replace",
      "--graft",
      child,
      applied.base,
    ]);
    expect(
      await api.git(applied.root, ["rev-list", "--parents", "-n", "1", child]),
    ).toBe(`${child} ${applied.base}`);
    await expect(
      api.folders.pushCommit(helperProject, child, applied.base),
    ).rejects.toThrow(/no longer follows/);
    expect(await remote(api)).toBe(applied.base);
  });
  it("refuses a changed local branch and repository URL rewrites before network writes", async () => {
    const api = await fixture(),
      applied = await apply(api);
    await api.git(applied.root, [
      "-c",
      "user.name=Operator",
      "-c",
      "user.email=operator@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "Local operator work",
    ]);
    expect((await save(api, applied.planId)).body.error).toMatch(
      /branch moved/,
    );
    await api.git(applied.root, [
      "config",
      "url.git@outside.invalid:elsewhere/.pushInsteadOf",
      "git@fixture.invalid:",
    ]);
    expect((await save(api, applied.planId)).status).toBe(503);
    expect(await remote(api)).toBe(applied.base);
  });
  it("retains a rejected push for an explicit retry and does not create a duplicate commit", async () => {
    const api = await fixture(),
      applied = await apply(api),
      hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(
      hook,
      "#!/bin/sh\nprintf 'fixture private server diagnostic' >&2\nexit 1\n",
      { mode: 0o755 },
    );
    const rejected = await save(api, applied.planId);
    expect(rejected).toMatchObject({
      status: 200,
      body: {
        phase: "committed",
        error: expect.stringMatching(/push was rejected/),
      },
    });
    expect(JSON.stringify(rejected.body)).not.toContain(
      "private server diagnostic",
    );
    expect(await remote(api)).toBe(applied.base);
    const status = await api.send({
      action: "repository-save-status",
      planId: applied.planId,
    });
    expect(status.body.phase).toBe("committed");
    expect(
      (await api.send({ action: "repository-apply", planId: "another-plan" }))
        .body.error,
    ).toMatch(/Finish saving/);
    await rm(hook);
    expect(
      (
        await save(api, applied.planId, helperOwner, {
          message: "Do not make another commit",
        })
      ).body,
    ).toMatchObject({ phase: "saved", commit: rejected.body.commit });
    expect(await api.git(api.remote, ["rev-list", "--count", "stage"])).toBe(
      "2",
    );
  });
  it("keeps a remote advance and a remote rewind when either happens at push time", async () => {
    for (const mode of ["advance", "rewind"]) {
      const api = await fixture();
      await advance(api);
      const applied = await apply(api);
      const original = api.folders.pushCommit.bind(api.folders);
      let changed = "";
      vi.spyOn(api.folders, "pushCommit").mockImplementationOnce(
        async (...args) => {
          if (mode === "advance") changed = await advance(api);
          else {
            changed = await api.git(api.remote, ["rev-parse", "stage^"]);
            await api.git(api.remote, [
              "update-ref",
              "refs/heads/stage",
              changed,
            ]);
          }
          return original(...args);
        },
      );
      const result = await save(api, applied.planId);
      expect(result.body.phase, mode).toBe("committed");
      expect(result.body.error, mode).toBeTruthy();
      expect(await remote(api), mode).toBe(changed);
    }
  });
  it("confirms a push whose acknowledgement was lost using a read-only remote check", async () => {
    const api = await fixture(),
      applied = await apply(api),
      original = api.folders.pushCommit.bind(api.folders);
    const push = vi
      .spyOn(api.folders, "pushCommit")
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new HostedHelperError(503, "Fixture lost acknowledgement");
      });
    const result = await save(api, applied.planId);
    expect(result.body.phase).toBe("saved");
    expect(push).toHaveBeenCalledTimes(1);
    expect(await remote(api)).toBe(result.body.commit);
  });
  it("rechecks membership after committing and refuses to push after revocation", async () => {
    const api = await fixture(),
      applied = await apply(api),
      original = RepositoryCompanion.prototype.commit;
    vi.spyOn(RepositoryCompanion.prototype, "commit").mockImplementationOnce(
      async function (...args) {
        const result = await original.apply(this, args);
        api.members.get(helperProject)!.delete(helperOwner);
        return result;
      },
    );
    expect((await save(api, applied.planId)).status).toBe(403);
    expect(await remote(api)).toBe(applied.base);
    expect(await api.git(applied.root, ["rev-parse", "HEAD"])).not.toBe(
      applied.base,
    );
    api.members.get(helperProject)!.add(helperOwner);
    expect(
      (
        await api.send({
          action: "repository-save-status",
          planId: applied.planId,
        })
      ).body.phase,
    ).toBe("committed");
    expect((await save(api, applied.planId)).body.phase).toBe("saved");
  });
});

describe("saved website deployment status", () => {
  const config = {
    projectId: helperProject,
    repositoryUrl: "git@github.com:fixture/site.git",
    branch: "stage",
    saveToWebsite: {
      environment: "staging" as const,
      url: "https://stage.fixture.invalid",
      workflow: "deploy.yml",
    },
  };
  it("observes only the configured push workflow for the exact saved commit, including failure and unavailable states", async () => {
    const commit = "a".repeat(40);
    for (const [status, conclusion, expected] of [
      ["queued", null, "queued"],
      ["in_progress", null, "building"],
      ["completed", "success", "succeeded"],
      ["completed", "failure", "failed"],
    ]) {
      const fetch = vi.fn(async () =>
        Response.json({
          workflow_runs: [
            {
              id: 123,
              status,
              conclusion,
              event: "push",
              head_sha: commit,
              head_branch: "stage",
              html_url: "https://outside.invalid/",
            },
          ],
        }),
      );
      const value = await new HostedSaveReleases({
        fetch,
        githubToken: "fixture-read-only",
      }).status(config, commit);
      expect(value.state).toBe(expected);
      expect(value.url).toBe(
        "https://github.com/fixture/site/actions/runs/123",
      );
      const [url, options] = fetch.mock.calls[0] as unknown as [
        URL,
        RequestInit,
      ];
      expect(url.origin).toBe("https://api.github.com");
      expect(url.pathname).toBe(
        "/repos/fixture/site/actions/workflows/deploy.yml/runs",
      );
      expect(url.searchParams.get("head_sha")).toBe(commit);
      expect(options).toMatchObject({
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: "Bearer fixture-read-only" },
      });
    }
    const irrelevant = await new HostedSaveReleases({
      fetch: async () =>
        Response.json({
          workflow_runs: [
            {
              id: 1,
              status: "completed",
              conclusion: "success",
              head_sha: "b".repeat(40),
              head_branch: "stage",
              event: "push",
            },
          ],
        }),
    }).status(config, commit);
    expect(irrelevant.state).toBe("waiting");
    const unavailable = await new HostedSaveReleases({
      fetch: async () => {
        throw new Error("private token must not escape");
      },
    }).status(config, commit);
    expect(unavailable.state).toBe("unavailable");
    expect(JSON.stringify(unavailable)).not.toContain("private token");
  });
  it("requires an explicit HTTPS staging destination and a GitHub repository for workflow tracking", () => {
    for (const saveToWebsite of [
      { ...config.saveToWebsite, environment: "production" },
      { ...config.saveToWebsite, url: "http://stage.fixture.invalid" },
      {
        ...config.saveToWebsite,
        url: "https://user:password@stage.fixture.invalid",
      },
      { ...config.saveToWebsite, workflow: "../other.yml" },
    ])
      expect(() =>
        hostedProjectRepositories({
          version: 1,
          projects: [{ ...config, saveToWebsite }],
        }),
      ).toThrow(/configuration/);
    expect(() =>
      hostedProjectRepositories({
        version: 1,
        projects: [
          {
            ...config,
            repositoryUrl: "git@elsewhere.invalid:fixture/site.git",
          },
        ],
      }),
    ).toThrow(/configuration/);
  });
});
