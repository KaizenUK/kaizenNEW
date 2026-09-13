import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { HostedBuildRecovery } from "../../scripts/builder-hosted-build-recovery";
import { RepositoryRunner, type BuildJob } from "../../scripts/builder-runner";
import {
  hostedHelperFixture,
  helperProject,
  helperOtherProject,
} from "../../tests/builder/hosted-helper-fixture";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
const runners: RepositoryRunner[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const runner of runners.splice(0)) await runner.close();
  for (const api of fixtures.splice(0).reverse()) await api.close();
});
async function fixture() {
  const api = await hostedHelperFixture(
    [helperProject, helperOtherProject],
    `
    import {mkdirSync,writeFileSync} from 'node:fs';
    mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html','Built output');
  `,
  );
  fixtures.push(api);
  expect((await api.send({ action: "repository-connect" })).status).toBe(200);
  return {
    api,
    recovery: new HostedBuildRecovery(api.folders),
    root: api.folders.root(helperProject),
  };
}
const recordPath = (api: Fixture) =>
  path.join(api.folders.projectDirectory(helperProject), "build-receipts.json");
async function records(api: Fixture) {
  return JSON.parse(await readFile(recordPath(api), "utf8"));
}
function job(root: string): BuildJob {
  const id = randomUUID();
  return {
    id,
    root,
    projectId: helperProject,
    command: "pnpm run build",
    status: "building",
    log: "",
    startedAt: new Date().toISOString(),
    recoveryDirectory: path.join(root, ".kaizen/build-recovery", id),
  };
}
async function completed(
  recovery: HostedBuildRecovery,
  root: string,
  status: "succeeded" | "failed" | "cancelled" = "succeeded",
) {
  const value = job(root);
  await recovery.begin(value, "a".repeat(64));
  await mkdir(path.join(value.recoveryDirectory, "previous-dist"), {
    recursive: true,
  });
  await writeFile(
    path.join(value.recoveryDirectory, "previous-dist/index.html"),
    "Older output",
  );
  value.status = status;
  value.finishedAt = new Date().toISOString();
  await recovery.finish(value);
  return value;
}

describe("durable hosted build recovery", () => {
  it("records intent before output changes and completes after the real build", async () => {
    const { api, root, recovery } = await fixture();
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/index.html"), "Original output");
    const runner = new RepositoryRunner(undefined, undefined, {
      beforeBuild: async (value, fingerprint) => {
        await recovery.begin(value, fingerprint);
        expect((await records(api)).data).toMatchObject([
          { id: value.id, phase: "running" },
        ]);
        expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
          "Original output",
        );
      },
      afterBuild: async (value) => {
        expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
          "Built output",
        );
        await recovery.finish(value);
      },
    });
    runners.push(runner);
    const plan = await runner.prepare(root, helperProject);
    const started = await runner.start(plan.id, helperProject);
    expect((await runner.wait(started.id, helperProject)).status).toBe(
      "succeeded",
    );
    expect((await records(api)).data).toMatchObject([
      {
        phase: "finished",
        outcome: "succeeded",
        fingerprint: plan.fingerprint,
      },
    ]);
    expect((await lstat(recordPath(api))).mode & 0o777).toBe(0o600);
  });

  it("preserves source and previous output when the intent cannot be persisted", async () => {
    const { api, root, recovery } = await fixture();
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/index.html"), "Original output");
    await writeFile(recordPath(api), "{}", { mode: 0o600 });
    const original = await readFile(path.join(root, "src/pages/index.astro"));
    const runner = new RepositoryRunner(undefined, undefined, {
      beforeBuild: (value, fingerprint) => recovery.begin(value, fingerprint),
      afterBuild: (value) => recovery.finish(value),
    });
    runners.push(runner);
    const plan = await runner.prepare(root, helperProject),
      started = await runner.start(plan.id, helperProject);
    expect((await runner.wait(started.id, helperProject)).status).toBe(
      "failed",
    );
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Original output",
    );
    expect(await readFile(path.join(root, "src/pages/index.astro"))).toEqual(
      original,
    );
    expect(await lstat(started.recoveryDirectory).catch(() => null)).toBeNull();
    expect(await readFile(recordPath(api), "utf8")).toBe("{}");
  });

  it("blocks mutations after restart without replay, while inspection and draft recovery remain available", async () => {
    const { api, root, recovery } = await fixture();
    const pending = job(root);
    await recovery.begin(pending, "a".repeat(64));
    await mkdir(pending.recoveryDirectory, { recursive: true });
    await writeFile(
      path.join(pending.recoveryDirectory, "operator-evidence"),
      "Preserve this",
    );
    const before = await readFile(recordPath(api));
    await api.restart();
    for (const action of [
      "repository-build-review",
      "repository-build-start",
      "repository-apply",
      "repository-save",
      "repository-fetch",
      "repository-publish-review",
      "repository-settings-save",
      "repository-settings-key",
      "repository-settings-connect",
      "repository-native-backup-review",
    ]) {
      const response = await api.send({ action });
      expect(response.status, action).toBe(409);
      expect(response.body.error).toContain("previous build");
    }
    for (const action of [
      "repository-connect",
      "repository-source-inspect",
      "repository-source-draft-read",
      "repository-git-status",
    ]) {
      expect(
        (await api.send({ action, route: "src/pages/index.astro" })).status,
        action,
      ).toBe(200);
    }
    expect(
      (
        await api.send({
          action: "repository-connect",
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(200);
    expect(await readFile(recordPath(api))).toEqual(before);
    expect(
      await readFile(
        path.join(pending.recoveryDirectory, "operator-evidence"),
        "utf8",
      ),
    ).toBe("Preserve this");
    expect(await lstat(path.join(root, "dist")).catch(() => null)).toBeNull();
  });

  it("prunes only recorded completed output, retaining recent builds, source recovery and unrecorded directories", async () => {
    const { api, root, recovery } = await fixture();
    const sourceRecovery = path.join(root, ".kaizen/recovery/source.txt"),
      unknown = path.join(
        root,
        ".kaizen/build-recovery",
        randomUUID(),
        "note.txt",
      );
    for (const file of [sourceRecovery, unknown]) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "Keep");
    }
    const first = await completed(recovery, root),
      second = await completed(recovery, root, "failed"),
      third = await completed(recovery, root, "cancelled");
    const next = job(root);
    await recovery.begin(next, "b".repeat(64));
    expect(await lstat(first.recoveryDirectory).catch(() => null)).toBeNull();
    for (const previous of [second, third])
      expect((await lstat(previous.recoveryDirectory)).isDirectory()).toBe(
        true,
      );
    for (const file of [sourceRecovery, unknown])
      expect(await readFile(file, "utf8")).toBe("Keep");
    expect((await records(api)).data.map((item: any) => item.phase)).toEqual([
      "finished",
      "finished",
      "running",
    ]);
  });

  it("resumes a recorded interrupted cleanup without replaying the build", async () => {
    const { api, root, recovery } = await fixture();
    const first = await completed(recovery, root);
    await completed(recovery, root);
    await completed(recovery, root);
    const saved = await records(api);
    saved.data[0].phase = "pruning";
    await writeFile(recordPath(api), JSON.stringify(saved));
    await rm(first.recoveryDirectory, { recursive: true });
    const restarted = new HostedBuildRecovery(api.folders),
      next = job(root);
    await restarted.begin(next, "b".repeat(64));
    expect(
      (await records(api)).data.some((item: any) => item.id === first.id),
    ).toBe(false);
    expect(await lstat(path.join(root, "dist")).catch(() => null)).toBeNull();
  });

  it("preserves unexpected data and refuses linked output or a different repository binding", async () => {
    const { api, root, recovery } = await fixture();
    const first = await completed(recovery, root);
    const note = path.join(first.recoveryDirectory, "manual-notes.txt");
    await writeFile(note, "Keep");
    await completed(recovery, root);
    await completed(recovery, root);
    await completed(recovery, root);
    expect(await readFile(note, "utf8")).toBe("Keep");
    await rm(note);
    const outside = path.join(api.directory, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "keep.txt"), "Keep");
    await rm(first.recoveryDirectory, { recursive: true });
    await symlink(outside, first.recoveryDirectory);
    await expect(recovery.begin(job(root), "b".repeat(64))).rejects.toThrow();
    expect(await readFile(path.join(outside, "keep.txt"), "utf8")).toBe("Keep");
    await rm(first.recoveryDirectory);
    await mkdir(first.recoveryDirectory);
    const saved = await records(api);
    saved.data[0].binding = "f".repeat(64);
    await writeFile(recordPath(api), JSON.stringify(saved));
    await expect(recovery.begin(job(root), "b".repeat(64))).rejects.toThrow(
      "operator check",
    );
    expect((await lstat(first.recoveryDirectory)).isDirectory()).toBe(true);
  });

  it("refuses malformed, foreign-project and non-private records", async () => {
    const { api, root, recovery } = await fixture();
    await completed(recovery, root);
    const saved = await records(api);
    for (const changed of [
      { ...saved, projectId: helperOtherProject },
      { ...saved, data: [{ ...saved.data[0], id: "../../source" }] },
      { ...saved, data: [{ ...saved.data[0], phase: "running" }] },
      { ...saved, data: [{ ...saved.data[0], path: root }] },
    ]) {
      await writeFile(recordPath(api), JSON.stringify(changed));
      await expect(recovery.begin(job(root), "b".repeat(64))).rejects.toThrow(
        "operator check",
      );
    }
    await writeFile(recordPath(api), JSON.stringify(saved));
    await chmod(recordPath(api), 0o644);
    await expect(recovery.begin(job(root), "b".repeat(64))).rejects.toThrow(
      "operator check",
    );
  });

  it("keeps an unfinished record and closes the preview if completion cannot be persisted", async () => {
    const { api, root, recovery } = await fixture();
    const runner = new RepositoryRunner(undefined, undefined, {
      beforeBuild: (value, fingerprint) => recovery.begin(value, fingerprint),
      afterBuild: async () => {
        throw new Error("Simulated disk failure");
      },
    });
    runners.push(runner);
    const plan = await runner.prepare(root, helperProject),
      started = await runner.start(plan.id, helperProject);
    const result = await runner.wait(started.id, helperProject);
    expect(result).toMatchObject({ status: "failed", recoveryRequired: true });
    expect(result.previewUrl).toBeUndefined();
    expect((await records(api)).data[0].phase).toBe("running");
    const restarted = new HostedBuildRecovery(api.folders);
    await api.folders.locked(helperProject, () =>
      restarted.refresh(helperProject),
    );
    expect(() => restarted.assertCanOperate(helperProject)).toThrow(
      "previous build",
    );
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Built output",
    );
  });

  it("retains the previous output and blocks further mutations when output restoration fails", async () => {
    const { api, root, recovery } = await fixture();
    await writeFile(
      path.join(root, "fixture-build.mjs"),
      `
      import {symlinkSync} from 'node:fs';symlinkSync('src','dist');process.exit(1);
    `,
    );
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist/index.html"), "Original output");
    const runner = new RepositoryRunner(undefined, undefined, {
      beforeBuild: (value, fingerprint) => recovery.begin(value, fingerprint),
      afterBuild: (value) => recovery.finish(value),
    });
    runners.push(runner);
    const plan = await runner.prepare(root, helperProject),
      started = await runner.start(plan.id, helperProject);
    expect(await runner.wait(started.id, helperProject)).toMatchObject({
      status: "failed",
      recoveryRequired: true,
    });
    expect((await records(api)).data[0]).toMatchObject({
      phase: "recovery_required",
      outcome: "failed",
    });
    expect(
      await readFile(
        path.join(started.recoveryDirectory, "previous-dist/index.html"),
        "utf8",
      ),
    ).toBe("Original output");
    expect((await lstat(path.join(root, "dist"))).isSymbolicLink()).toBe(true);
    expect(() => recovery.assertCanOperate(helperProject)).toThrow(
      "previous build",
    );
  });

  it("refuses a mismatched recovery path and bounds records without dropping uncertain data", async () => {
    const { api, root, recovery } = await fixture();
    const wrong = job(root);
    wrong.recoveryDirectory = path.join(root, "src");
    await expect(recovery.begin(wrong, "a".repeat(64))).rejects.toThrow(
      "operator check",
    );
    await completed(recovery, root);
    const saved = await records(api),
      original = saved.data[0];
    saved.data = Array.from({ length: 24 }, () => ({
      ...original,
      id: randomUUID(),
    }));
    for (const entry of saved.data) {
      const directory = path.join(root, ".kaizen/build-recovery", entry.id);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "manual-notes.txt"), "Keep");
    }
    await writeFile(recordPath(api), JSON.stringify(saved));
    const before = await readFile(recordPath(api));
    await expect(recovery.begin(job(root), "a".repeat(64))).rejects.toThrow(
      "operator check",
    );
    expect(await readFile(recordPath(api))).toEqual(before);
    for (const entry of saved.data)
      expect(
        await readFile(
          path.join(
            root,
            ".kaizen/build-recovery",
            entry.id,
            "manual-notes.txt",
          ),
          "utf8",
        ),
      ).toBe("Keep");
  });
});
