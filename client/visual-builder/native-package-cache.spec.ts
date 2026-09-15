import { afterEach, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NativePackageCache } from "../../scripts/builder-native-package-cache";
import { verifyNativePackageCache } from "../../tests/builder/native-package-cache-fixture";

const exec = promisify(execFile),
  roots: string[] = [];
const mounts = vi.hoisted(() => ({ extra: "" }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: async (...args: any[]) => {
      const result = await actual.readFile(args[0], args[1]);
      return args[0] === "/proc/self/mountinfo" && mounts.extra
        ? String(result) + "\n" + mounts.extra
        : result;
    },
  };
});
afterEach(async () => {
  mounts.extra = "";
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture(prepare = true) {
  const directory = await mkdtemp(path.join(tmpdir(), "kaizen-package-cache-"));
  roots.push(directory);
  const root = path.join(directory, "checkout"),
    state = path.join(directory, "state");
  await mkdir(root, { mode: 0o700 });
  await mkdir(state, { mode: 0o700 });
  const cache = new NativePackageCache(root, state, {
    BUILDER_NATIVE_CACHE_PRUNE_BYTES: "1",
  });
  if (prepare) await cache.prepare();
  const run = vi.fn(async (_args: string[], _env: NodeJS.ProcessEnv) => {});
  const log = vi.fn();
  const abort = new AbortController();
  const prune = () =>
    cache.prune({ signal: abort.signal, pressured: false, run, log });
  const populate = async () => {
    const cas = path.join(cache.store, "v10/files/aa", "b".repeat(126));
    await mkdir(path.dirname(cas), { recursive: true });
    await writeFile(cas, "unused fixture contents");
    return cas;
  };
  return {
    directory,
    root,
    state,
    cache,
    run,
    log,
    abort,
    prune,
    populate,
    record: path.join(state, "package-cache.json"),
  };
}
it("does not adopt populated unrecorded stores or run cleanup on them", async () => {
  const f = await fixture(false);
  await mkdir(f.cache.store, { mode: 0o700 });
  const file = path.join(f.cache.store, "private.txt");
  await writeFile(file, "preserved");
  expect(await f.prune()).toBe(false);
  await expect(f.cache.prepare()).rejects.toThrow("ownership");
  expect(f.run).not.toHaveBeenCalled();
  expect(await readFile(file, "utf8")).toBe("preserved");
});
it("recovers empty roots and exact interrupted ownership publication", async () => {
  const f = await fixture(false);
  await mkdir(f.cache.store, { mode: 0o700 });
  await f.cache.prepare();
  const record = JSON.parse(await readFile(f.record, "utf8"));
  const temporary = path.join(f.state, `.package-cache-${record.id}.json.tmp`);
  await link(f.record, temporary);
  await f.cache.prepare();
  expect((await lstat(f.record)).nlink).toBe(1);
  await expect(lstat(temporary)).rejects.toMatchObject({ code: "ENOENT" });
});
it("refuses malformed, oversized and unrelated hard-linked ownership records", async () => {
  const f = await fixture();
  const original = await readFile(f.record);
  for (const contents of [
    "{",
    "x".repeat(2049),
    JSON.stringify({ version: 1 }),
  ]) {
    await writeFile(f.record, contents);
    await expect(f.prune()).rejects.toThrow("ownership");
  }
  await writeFile(f.record, original);
  await link(f.record, path.join(f.state, "private-copy"));
  await expect(f.prune()).rejects.toThrow("ownership");
  expect(f.run).not.toHaveBeenCalled();
});
it("refuses replaced and linked cache roots without touching their contents", async () => {
  const f = await fixture();
  await f.populate();
  const original = f.cache.store + "-original";
  await rename(f.cache.store, original);
  await mkdir(f.cache.store, { mode: 0o700 });
  await expect(f.prune()).rejects.toThrow("ownership");
  await rm(f.cache.store, { recursive: true });
  await symlink(original, f.cache.store);
  await expect(f.prune()).rejects.toThrow();
  expect(f.run).not.toHaveBeenCalled();
});
it("preserves unknown files in pnpm deletion targets and prevents link traversal", async () => {
  const f = await fixture();
  const cas = await f.populate(),
    alien = path.join(path.dirname(cas), "private.txt");
  await writeFile(alien, "preserved private data");
  expect(await f.prune()).toBe(false);
  await rename(alien, path.join(f.root, "outside.txt"));
  await symlink(path.join(f.root, "outside.txt"), alien);
  expect(await f.prune()).toBe(false);
  expect(await readFile(path.join(f.root, "outside.txt"), "utf8")).toBe(
    "preserved private data",
  );
  expect(f.run).not.toHaveBeenCalled();
});
it("refuses global virtual-store and unsupported metadata cleanup", async () => {
  const f = await fixture();
  await f.populate();
  const links = path.join(f.cache.store, "v10/links");
  await mkdir(links);
  expect(await f.prune()).toBe(false);
  await rm(links, { recursive: true });
  await mkdir(path.join(f.cache.cache, "metadata-private"));
  expect(await f.prune()).toBe(false);
  expect(f.run).not.toHaveBeenCalled();
});
it("refuses mounted deletion targets, including same-device bind mounts", async () => {
  const f = await fixture();
  await f.populate();
  for (const target of [f.cache.store, path.join(f.cache.store, "v10/files")]) {
    mounts.extra = `900 800 1:1 / ${target} rw - tmpfs fixture rw`;
    expect(await f.prune()).toBe(false);
  }
  expect(f.run).not.toHaveBeenCalled();
});
it("runs below the trigger only under capacity pressure, with explicit offline maintenance configuration", async () => {
  const f = await fixture();
  await f.populate();
  const cache = new NativePackageCache(f.root, f.state, {});
  expect(
    await cache.prune({
      signal: f.abort.signal,
      pressured: false,
      run: f.run,
      log: f.log,
    }),
  ).toBe(false);
  expect(
    await cache.prune({
      signal: f.abort.signal,
      pressured: true,
      run: f.run,
      log: f.log,
    }),
  ).toBe(true);
  const [args, env] = f.run.mock.calls[0];
  expect(args).toContain("--config.ignore-pnpmfile=true");
  expect(args).toContain("--config.ignore-scripts=true");
  expect(args).not.toContain("--force");
  expect(env).not.toHaveProperty("BUILDER_RELEASE_SERVICE_ROLE_KEY");
  expect(env.HOME).toBe(f.state);
});
it("honors cancellation before maintenance and propagates uncertain process cleanup", async () => {
  const f = await fixture();
  await f.populate();
  const error = Object.assign(new Error("Unknown process cleanup"), {
    nativeRecoveryRequired: true,
  });
  f.run.mockRejectedValueOnce(error);
  await expect(f.prune()).rejects.toBe(error);
  f.abort.abort(new Error("Cancelled"));
  await expect(f.prune()).rejects.toThrow("Cancelled");
  expect(f.run).toHaveBeenCalledTimes(1);
});
it("uses real pinned pnpm to prune unused files and metadata while installed packages survive repeated maintenance", async () => {
  const f = await fixture(false);
  const cli = process.env.KAIZEN_TEST_PNPM_CLI || process.env.npm_execpath;
  expect(
    cli,
    "Run this fixture with the repository's pinned pnpm",
  ).toBeTruthy();
  const version = await exec(process.execPath, [cli!, "--version"]);
  expect(version.stdout.trim()).toBe("10.32.1");
  await verifyNativePackageCache({
    directory: path.join(f.directory, "real-pnpm"),
    cli: cli!,
    execute: async (cwd, executable, args, environment) => {
      await exec(executable, args, {
        cwd,
        env: environment,
        timeout: 30000,
        maxBuffer: 128 * 1024,
      });
    },
  });
}, 30000);
