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
import {
  RepositoryCompanion,
  type AppliedFileChange,
} from "../../scripts/builder-repository";
import { HostedHelperError } from "../../scripts/builder-hosted-auth";
import { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";
import {
  HostedReceiptStore,
  receiptError,
} from "../../scripts/builder-hosted-receipts";
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
async function prepare(api: Fixture, actor = helperOwner) {
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
  return {
    planId: plan.body.id as string,
    root: inspection.root,
    base: await api.git(inspection.root, ["rev-parse", "HEAD"]),
  };
}
async function apply(api: Fixture, actor = helperOwner) {
  const prepared = await prepare(api, actor);
  const result = await api.send(
    { action: "repository-apply", planId: prepared.planId },
    actor,
  );
  expect(result.status).toBe(200);
  return prepared;
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
  it("reserves space before apply without leaving an operation intent or changing source when full", async () => {
    const api = await fixture(),
      prepared = await prepare(api);
    const file = path.join(prepared.root, "src/pages/index.astro");
    const before = await readFile(file);
    const receiptFile = path.join(
      api.folders.projectDirectory(helperProject),
      "save-receipts.json",
    );
    const receiptBefore = await readFile(receiptFile);
    vi.spyOn(api.folders.disk, "sample").mockResolvedValue({
      bytes: api.folders.disk.limits.projectBytes - 1,
      freeBytes: 100n * 1024n ** 3n,
    });
    const response = await api.send({
      action: "repository-apply",
      planId: prepared.planId,
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("storage limit");
    expect(await readFile(file)).toEqual(before);
    expect(await api.git(prepared.root, ["status", "--porcelain"])).toBe("");
    expect(await readFile(receiptFile)).toEqual(receiptBefore);
  });
  it("keeps an applied save retryable when there is no room for its Git objects", async () => {
    const api = await fixture(),
      applied = await apply(api);
    const sample = vi.spyOn(api.folders.disk, "sample").mockResolvedValue({
      bytes: api.folders.disk.limits.projectBytes - 1,
      freeBytes: 100n * 1024n ** 3n,
    });
    const refused = await save(api, applied.planId);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toContain("storage limit");
    expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(
      applied.base,
    );
    expect(await remote(api)).toBe(applied.base);
    expect(
      await api.git(applied.root, ["diff", "--cached", "--name-only"]),
    ).toBe("");
    const status = await api.send({
      action: "repository-save-status",
      route: "src/pages/index.astro",
    });
    expect(status.body.phase).toBe("applied");
    sample.mockRestore();
    const saved = await save(api, applied.planId);
    expect(saved.status).toBe(200);
    expect(saved.body.phase).toBe("saved");
    expect(await remote(api)).toBe(saved.body.commit);
  });
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

describe("durable Save to website recovery", () => {
  const recordFile = (api: Fixture) =>
    path.join(
      api.folders.projectDirectory(helperProject),
      "save-receipts.json",
    );
  const status = (api: Fixture) =>
    api.send({
      action: "repository-save-status",
      route: "src/pages/index.astro",
    });
  it("restores an applied plan from hashes after restart and commits only its files as the current verified account", async () => {
    const api = await fixture(),
      applied = await apply(api);
    const records = await readFile(recordFile(api), "utf8");
    expect(records).not.toContain("Saved by the hosted editor");
    expect(records).not.toContain(api.directory);
    expect(records).not.toMatch(/fixture-signature|fixture-only-key-material/);
    await writeFile(
      path.join(applied.root, "README.md"),
      "Keep separate work\n",
    );
    await api.restart();
    const commit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
      push = vi.spyOn(api.folders, "pushCommit");
    expect((await status(api)).body).toMatchObject({
      phase: "applied",
      planId: applied.planId,
    });
    expect(
      (
        await api.send(
          { action: "repository-save-status", planId: applied.planId },
          helperEditor,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-save-status",
          projectId: helperOtherProject,
          planId: applied.planId,
        })
      ).status,
    ).toBe(409);
    api.members.get(helperProject)!.delete(helperOwner);
    expect((await save(api, applied.planId)).status).toBe(403);
    expect(commit).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    api.members.get(helperProject)!.add(helperOwner);
    api.profiles.get(helperOwner)!.user_metadata.full_name =
      "Updated fixture owner";
    const result = await save(api, applied.planId);
    expect(result.body.phase).toBe("saved");
    expect(
      await api.git(api.remote, ["show", "-s", "--format=%an", "stage"]),
    ).toBe("Updated fixture owner");
    expect(await readFile(path.join(applied.root, "README.md"), "utf8")).toBe(
      "Keep separate work\n",
    );
    expect(
      await api.git(api.remote, [
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        "stage",
      ]),
    ).toBe("src/pages/index.astro");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    await api.restart();
    expect((await status(api)).body).toMatchObject({
      phase: "saved",
      commit: result.body.commit,
    });
    expect((await save(api, applied.planId)).body.commit).toBe(
      result.body.commit,
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it.each(["complete", "changed"])(
    "recognizes a %s apply after its acknowledgement was lost without applying again",
    async (outcome) => {
      const api = await fixture(),
        prepared = await prepare(api);
      const original = HostedReceiptStore.prototype.write;
      const writing = vi
        .spyOn(HostedReceiptStore.prototype, "write")
        .mockImplementation(async function (id, data) {
          if (
            Array.isArray(data) &&
            data.some((entry) => entry.status.phase === "applied")
          )
            throw receiptError();
          return original.call(this, id, data);
        });
      expect(
        (
          await api.send({
            action: "repository-apply",
            planId: prepared.planId,
          })
        ).status,
      ).toBe(503);
      const file = path.join(prepared.root, "src/pages/index.astro");
      expect(await readFile(file, "utf8")).toContain(
        "Saved by the hosted editor",
      );
      expect(
        JSON.parse(await readFile(recordFile(api), "utf8")).data[0].pending,
      ).toBe("apply");
      if (outcome === "changed")
        await writeFile(file, "Preserve a later or partial edit\n");
      writing.mockRestore();
      await api.restart();
      const applyAgain = vi.spyOn(RepositoryCompanion.prototype, "apply"),
        commit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
        push = vi.spyOn(api.folders, "pushCommit");
      expect((await status(api)).body.phase).toBe(
        outcome === "complete" ? "applied" : "recovery_required",
      );
      expect(applyAgain).not.toHaveBeenCalled();
      expect(commit).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(await remote(api)).toBe(prepared.base);
      if (outcome === "changed") {
        expect((await save(api, prepared.planId)).body.error).toContain(
          "operator check",
        );
        expect(
          (
            await api.send({
              action: "repository-apply",
              planId: "another-plan",
            })
          ).status,
        ).toBe(409);
        expect(await readFile(file, "utf8")).toBe(
          "Preserve a later or partial edit\n",
        );
      }
    },
  );
  it("discards only a verified unstarted apply intent after restart and preserves the original bytes", async () => {
    const api = await fixture(),
      prepared = await prepare(api);
    const original = RepositoryCompanion.prototype.apply;
    vi.spyOn(RepositoryCompanion.prototype, "apply").mockImplementationOnce(
      async function (id, projectId, beforeMutation) {
        return original.call(
          this,
          id,
          projectId,
          async (
            changes: AppliedFileChange[],
            additionalBytes: number,
            sourceUsage,
            replacements,
          ) => {
            await beforeMutation?.(
              changes,
              additionalBytes,
              sourceUsage,
              replacements,
            );
            throw new Error("Fixture interruption before file mutation");
          },
        );
      },
    );
    expect(
      (await api.send({ action: "repository-apply", planId: prepared.planId }))
        .status,
    ).toBe(409);
    expect(
      JSON.parse(await readFile(recordFile(api), "utf8")).data[0].pending,
    ).toBe("apply");
    await api.restart();
    expect((await status(api)).body).toBeNull();
    expect(JSON.parse(await readFile(recordFile(api), "utf8")).data).toEqual(
      [],
    );
    expect(
      await readFile(path.join(prepared.root, "src/pages/index.astro"), "utf8"),
    ).toContain("Hosted original");
    expect(await api.git(prepared.root, ["status", "--porcelain"])).toBe("");
    expect(await remote(api)).toBe(prepared.base);
  });
  it.each(["before", "after"])(
    "retains the correct save state when the durable record fails %s committing",
    async (when) => {
      const api = await fixture(),
        applied = await apply(api);
      const original = HostedReceiptStore.prototype.write;
      const writing = vi
        .spyOn(HostedReceiptStore.prototype, "write")
        .mockImplementation(async function (id, data) {
          if (
            Array.isArray(data) &&
            data.some((entry) =>
              when === "before"
                ? entry.pending === "commit"
                : entry.status.phase === "committed",
            )
          )
            throw receiptError();
          return original.call(this, id, data);
        });
      const firstPush = vi.spyOn(api.folders, "pushCommit");
      expect((await save(api, applied.planId)).status).toBe(503);
      const local = await api.git(applied.root, ["rev-parse", "HEAD"]);
      expect(local === applied.base).toBe(when === "before");
      expect(await remote(api)).toBe(applied.base);
      expect(firstPush).not.toHaveBeenCalled();
      writing.mockRestore();
      await api.restart();
      const nextCommit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
        nextPush = vi.spyOn(api.folders, "pushCommit");
      expect((await status(api)).body.phase).toBe(
        when === "before" ? "applied" : "recovery_required",
      );
      if (when === "after")
        expect((await save(api, applied.planId)).body.error).toContain(
          "operator check",
        );
      expect(nextCommit).not.toHaveBeenCalled();
      expect(nextPush).not.toHaveBeenCalled();
      expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(local);
      expect(
        await api.git(applied.root, ["diff", "--cached", "--name-only"]),
      ).toBe("");
    },
  );
  it("keeps a rejected commit across restart and retries that commit only after an explicit save", async () => {
    const api = await fixture(),
      applied = await apply(api);
    const hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o700 });
    const failed = await save(api, applied.planId);
    expect(failed.body.phase).toBe("committed");
    await rm(hook);
    await api.restart();
    const commit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
      push = vi.spyOn(api.folders, "pushCommit");
    expect((await status(api)).body).toMatchObject({
      phase: "committed",
      commit: failed.body.commit,
    });
    expect(push).not.toHaveBeenCalled();
    expect(await remote(api)).toBe(applied.base);
    expect((await save(api, applied.planId)).body).toMatchObject({
      phase: "saved",
      commit: failed.body.commit,
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(await api.git(api.remote, ["rev-list", "--count", "stage"])).toBe(
      "2",
    );
  });
  it("resolves a lost push acknowledgement after restart without another commit or push", async () => {
    const api = await fixture(),
      applied = await apply(api);
    const original = api.folders.pushCommit.bind(api.folders);
    vi.spyOn(api.folders, "pushCommit").mockImplementationOnce(
      async (...args) => {
        await original(...args);
        vi.spyOn(api.folders, "remoteHead").mockRejectedValue(
          new Error("Fixture Git outage"),
        );
        throw new Error("Fixture lost acknowledgement");
      },
    );
    const failed = await save(api, applied.planId);
    expect(failed.body.phase).toBe("committed");
    await api.restart();
    const commit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
      push = vi.spyOn(api.folders, "pushCommit");
    expect((await status(api)).body).toMatchObject({
      phase: "saved",
      commit: failed.body.commit,
    });
    expect((await save(api, applied.planId)).body.commit).toBe(
      failed.body.commit,
    );
    expect(commit).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(await remote(api)).toBe(failed.body.commit);
  });
  it.each(["path", "hash", "project", "destination", "binding"])(
    "refuses restored %s metadata that no longer matches the approved operation",
    async (damage) => {
      const api = await fixture(),
        applied = await apply(api);
      const file = recordFile(api),
        record = JSON.parse(await readFile(file, "utf8")),
        receipt = record.data[0];
      if (damage === "path") {
        receipt.changes[0].file = "../outside.txt";
        receipt.status.files[0] = "../outside.txt";
      }
      if (damage === "hash") receipt.changes[0].after = "a".repeat(64);
      if (damage === "project") record.projectId = helperOtherProject;
      if (damage === "destination")
        receipt.status.destinationUrl = "https://outside.invalid";
      if (damage === "binding") receipt.binding = "b".repeat(64);
      await writeFile(file, JSON.stringify(record));
      await api.restart();
      const commit = vi.spyOn(RepositoryCompanion.prototype, "commit"),
        push = vi.spyOn(api.folders, "pushCommit");
      expect((await save(api, applied.planId)).status).toBe(
        damage === "hash" ? 409 : 503,
      );
      expect(commit).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(await api.git(applied.root, ["rev-parse", "HEAD"])).toBe(
        applied.base,
      );
      expect(await remote(api)).toBe(applied.base);
      expect(
        await readFile(
          path.join(applied.root, "src/pages/index.astro"),
          "utf8",
        ),
      ).toContain("Saved by the hosted editor");
    },
  );
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
