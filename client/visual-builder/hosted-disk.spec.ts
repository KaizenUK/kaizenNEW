import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  truncate,
  writeFile,
  lstat,
  link,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  HostedDiskGuard,
  hostedDiskLimits,
  defaultHostedDiskLimits,
  nativeDiskGuard,
} from "../../scripts/builder-hosted-disk";
import { SandboxCleanupError } from "../../scripts/builder-build-sandbox";
import {
  hostedHelperFixture,
  helperProject,
} from "../../tests/builder/hosted-helper-fixture";

const directories: string[] = [];
const fixtures: Awaited<ReturnType<typeof hostedHelperFixture>>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const fixture of fixtures.splice(0).reverse()) await fixture.close();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
const limits = { projectBytes: 1024 * 1024, freeBytes: 0, intervalMs: 100 };
async function directory() {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-disk-limit-"));
  directories.push(root);
  const project = path.join(root, "projects", helperProject);
  await mkdir(project, { recursive: true });
  return { root, project, disk: new HostedDiskGuard(root, limits) };
}
async function fixture(script: string) {
  const api = await hostedHelperFixture(
    [helperProject],
    script,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    limits,
  );
  fixtures.push(api);
  expect(
    (await api.send({ action: "repository-connect", projectId: helperProject }))
      .status,
  ).toBe(200);
  const root = api.folders.root(helperProject);
  await mkdir(path.join(root, "dist"));
  await writeFile(
    path.join(root, "dist/index.html"),
    "Original verified output",
  );
  return { api, root };
}
async function start(api: Awaited<ReturnType<typeof hostedHelperFixture>>) {
  const plan = await api.send({
    action: "repository-build-review",
    projectId: helperProject,
  });
  expect(plan.status).toBe(200);
  const job = await api.send({
    action: "repository-build-start",
    projectId: helperProject,
    planId: plan.body.id,
  });
  expect(job.status).toBe(200);
  const status = async () => {
    const response = await api.send({
      action: "repository-build-status",
      projectId: helperProject,
      jobId: job.body.id,
    });
    expect(response.status).toBe(200);
    return response.body;
  };
  await expect
    .poll(
      async () =>
        ["failed", "cancelled", "succeeded"].includes((await status()).status),
      { timeout: 15000 },
    )
    .toBe(true);
  return status();
}

describe("hosted storage bounds", () => {
  it("counts native checkout and worker dependencies together and remeasures after a restart", async () => {
    const { root, project } = await directory();
    const state = path.join(root, "native-state");
    await mkdir(path.join(state, "dependencies"), { recursive: true });
    const source = path.join(project, "page.txt");
    await writeFile(source, "Preserved source");
    const cache = path.join(state, "dependencies", "package.bin");
    await writeFile(cache, "");
    await truncate(cache, 600 * 1024);
    const env = {
      BUILDER_NATIVE_STORAGE_MAX_BYTES: String(limits.projectBytes),
      BUILDER_NATIVE_MIN_FREE_BYTES: "0",
      BUILDER_NATIVE_DISK_CHECK_MS: "100",
    };
    await expect(
      nativeDiskGuard(project, state, env).check("kaizen"),
    ).resolves.toMatchObject({ bytes: expect.any(Number) });
    await mkdir(path.join(project, "node_modules"));
    await link(cache, path.join(project, "node_modules", "package.bin"));
    // A pnpm hard link can later be replaced by a copy; both retained paths
    // consume the operational allowance even before that materialization.
    await expect(
      nativeDiskGuard(project, state, env).check("kaizen"),
    ).rejects.toThrow("storage limit");
    expect(await readFile(source, "utf8")).toBe("Preserved source");
    await rm(path.join(project, "node_modules"), { recursive: true });
    await expect(
      nativeDiskGuard(project, state, env).check("kaizen"),
    ).resolves.toMatchObject({ bytes: expect.any(Number) });
    expect(() =>
      nativeDiskGuard(project, state, {
        BUILDER_NATIVE_STORAGE_MAX_BYTES: "Infinity",
      }),
    ).toThrow();
    expect(() => nativeDiskGuard(project, project, env)).toThrow();
    expect(() => nativeDiskGuard(root, state, env)).toThrow();
    expect(() => nativeDiskGuard(path.parse(root).root, state, env)).toThrow();
    await rm(state, { recursive: true });
    await expect(
      nativeDiskGuard(project, state, env).check("kaizen"),
    ).rejects.toThrow("could not check");
    await symlink(path.join(root, "projects"), state);
    await expect(
      nativeDiskGuard(project, state, env).check("kaizen"),
    ).rejects.toThrow("could not check");
  });

  it("preserves uncertain process-cleanup evidence when storage cancellation also fails", async () => {
    const { project, disk } = await directory();
    const failure = new SandboxCleanupError();
    await expect(
      disk.run(helperProject, async (signal) => {
        await writeFile(
          path.join(project, "growing-output"),
          Buffer.alloc(2 * 1024 * 1024),
        );
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect((await lstat(path.join(project, "growing-output"))).size).toBe(
      2 * 1024 * 1024,
    );
  });

  it("accepts explicit bounded operator settings and rejects malformed or unbounded values", () => {
    expect(hostedDiskLimits({})).toEqual(defaultHostedDiskLimits);
    expect(
      hostedDiskLimits({
        BUILDER_HOSTED_PROJECT_MAX_BYTES: "1024",
        BUILDER_HOSTED_MIN_FREE_BYTES: "0",
        BUILDER_HOSTED_DISK_CHECK_MS: "100",
      }),
    ).toEqual({ projectBytes: 1024, freeBytes: 0, intervalMs: 100 });
    for (const value of [
      "",
      "-1",
      "Infinity",
      "1e9",
      "9007199254740993",
      " 100",
      "0",
    ])
      expect(() =>
        hostedDiskLimits({ BUILDER_HOSTED_PROJECT_MAX_BYTES: value }),
      ).toThrow("storage");
    expect(() =>
      hostedDiskLimits({ BUILDER_HOSTED_DISK_CHECK_MS: "99" }),
    ).toThrow();
  });

  it("counts sparse and ignored project files without following links into other websites", async () => {
    const { root, project, disk } = await directory();
    const outside = path.join(root, "other-website.bin");
    await writeFile(outside, "");
    await truncate(outside, 3 * 1024 * 1024);
    await symlink(outside, path.join(project, "outside-link"));
    await expect(disk.check(helperProject)).resolves.toMatchObject({
      bytes: expect.any(Number),
    });
    const cache = path.join(project, "build-home", "cache");
    await mkdir(path.dirname(cache));
    await writeFile(cache, "");
    await truncate(cache, 2 * 1024 * 1024);
    await expect(disk.check(helperProject)).rejects.toThrow("storage limit");
    expect((await lstat(outside)).size).toBe(3 * 1024 * 1024);
  });

  it("reserves write capacity and free space, and refuses a linked project root", async () => {
    const { root, project, disk } = await directory();
    await expect(disk.check(helperProject, 2 * 1024 * 1024)).rejects.toThrow(
      "storage limit",
    );
    const lowSpace = new HostedDiskGuard(root, { ...limits, freeBytes: 1024 });
    vi.spyOn(lowSpace, "sample").mockResolvedValue({
      bytes: 1,
      freeBytes: 10n,
    });
    await expect(lowSpace.check(helperProject)).rejects.toThrow(
      "free disk space",
    );
    await rm(project, { recursive: true });
    const other = path.join(root, "other");
    await mkdir(other);
    await symlink(other, project);
    await expect(disk.check(helperProject)).rejects.toThrow("could not check");
  });

  it("rejects an oversized clone before installing it as the website checkout", async () => {
    const api = await hostedHelperFixture(
      [helperProject],
      undefined,
      undefined,
      async (seed) => {
        await writeFile(
          path.join(seed, "oversized.bin"),
          Buffer.alloc(2 * 1024 * 1024, 1),
        );
      },
      undefined,
      undefined,
      undefined,
      limits,
    );
    fixtures.push(api);
    const result = await api.send({
      action: "repository-connect",
      projectId: helperProject,
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toContain("storage limit");
    expect(
      await lstat(api.folders.root(helperProject)).catch(() => null),
    ).toBeNull();
  });

  it("refuses a build before moving previous output when storage is already full", async () => {
    const { api, root } = await fixture(
      "import {writeFileSync} from 'node:fs'; writeFileSync('.kaizen/should-not-run','started');",
    );
    const filler = path.join(
      api.folders.projectDirectory(helperProject),
      "retained-data",
    );
    await writeFile(filler, Buffer.alloc(2 * 1024 * 1024));
    const job = await start(api);
    expect(job.status).toBe("failed");
    expect(job.error).toContain("storage limit");
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Original verified output",
    );
    expect(
      await lstat(path.join(root, ".kaizen/should-not-run")).catch(() => null),
    ).toBeNull();
    expect((await lstat(filler)).size).toBe(2 * 1024 * 1024);
  });

  it("stops a growing build, restores the previous output, and keeps failed output for recovery", async () => {
    const { api, root } = await fixture(`
      import {mkdirSync,writeFileSync} from 'node:fs';
      mkdirSync('dist',{recursive:true});
      writeFileSync('dist/index.html','Incomplete output');
      setTimeout(()=>writeFileSync('dist/large.bin',Buffer.alloc(2*1024*1024)),300);
      setInterval(()=>{},100);
    `);
    const original = await readFile(path.join(root, "src/pages/index.astro"));
    const job = await start(api);
    expect(job.status).toBe("cancelled");
    expect(job.error).toContain("storage limit");
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toBe(
      "Original verified output",
    );
    expect(
      await readFile(
        path.join(job.recoveryDirectory, "failed-dist/index.html"),
        "utf8",
      ),
    ).toBe("Incomplete output");
    expect(
      (await lstat(path.join(job.recoveryDirectory, "failed-dist/large.bin")))
        .size,
    ).toBe(2 * 1024 * 1024);
    expect(await readFile(path.join(root, "src/pages/index.astro"))).toEqual(
      original,
    );
    await expect(
      api.folders.assertNotBuilding(helperProject),
    ).resolves.toBeUndefined();
  });
});
