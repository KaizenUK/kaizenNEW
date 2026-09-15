import { afterEach, expect, it, vi } from "vitest";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NativeCandidates } from "../../scripts/builder-native-candidates";
import { NativeFileProtection } from "../../scripts/builder-native-operations";
import type { NativeOperationIdentity } from "../../shared/builderNativeOperations";
import type { NativeOperationController } from "../../scripts/builder-native-controller";

const roots: string[] = [];
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
async function fixture() {
  const parent = await mkdtemp(path.join(tmpdir(), "kaizen-candidates-"));
  roots.push(parent);
  const root = path.join(parent, "checkout"),
    state = path.join(parent, "state");
  await mkdir(root, { mode: 0o700 });
  await mkdir(state, { mode: 0o700 });
  await writeFile(
    path.join(root, "private-draft.txt"),
    "Preserved private fixture",
  );
  let invocationId = "a".repeat(32),
    protectedPath: string | null = null;
  const identity = (): NativeOperationIdentity => ({
    id: randomUUID(),
    instanceId: randomUUID(),
    workerId: "fixture-deployment",
    configuration: "c".repeat(64),
    projectId: "kaizen",
    host: hostname(),
    processId: process.pid,
  });
  const controller: NativeOperationController = {
    get identity() {
      return {
        kind: "systemd" as const,
        unit: "fixture-deployment.service",
        invocationId,
      };
    },
    async stopped(_operation, previous) {
      return (
        previous.unit === this.identity.unit &&
        previous.invocationId !== invocationId
      );
    },
  };
  const options = () => ({
    root,
    state,
    repository: "https://fixture.example.test/site.git",
    branch: "main",
    files: new NativeFileProtection([], identity(), controller.identity),
    controller,
    protectedCandidate: async () => protectedPath,
  });
  const create = () => new NativeCandidates(options());
  const receipt = path.join(state, "candidate.json");
  const read = async () => JSON.parse(await readFile(receipt, "utf8"));
  const update = async (change: (item: any) => void) => {
    const item = await read();
    change(item);
    await writeFile(receipt, JSON.stringify(item));
    return item;
  };
  return {
    parent,
    root,
    state,
    receipt,
    read,
    update,
    options,
    create,
    current: create(),
    protect: (value: string | null) => {
      protectedPath = value;
    },
    restart: () => {
      invocationId = randomUUID().replace(/-/g, "");
      return create();
    },
    preserved: async () =>
      expect(await readFile(path.join(root, "private-draft.txt"), "utf8")).toBe(
        "Preserved private fixture",
      ),
  };
}

it("records ownership before use and refuses a second candidate or same-service takeover", async () => {
  const f = await fixture(),
    directory = await f.current.create();
  const receipt = await f.read(),
    info = await lstat(directory);
  expect(receipt).toMatchObject({
    phase: "running",
    directory: { dev: info.dev, ino: info.ino },
    owner: { processId: process.pid },
  });
  expect(path.basename(directory)).toBe("checkout-" + receipt.id);
  expect((await lstat(f.receipt)).mode & 0o777).toBe(0o600);
  expect(await f.current.prune()).toBe(false);
  await expect(f.current.create()).rejects.toThrow("still owned");
  await expect(f.create().stopped(directory)).rejects.toThrow("still owned");
  // A different or missing PID is not service-manager proof of stopped work.
  await f.update((item) => {
    item.owner.processId = 2147483647;
  });
  expect(await f.create().prune()).toBe(false);
  expect(await readdir(path.join(f.state, "candidates"))).toHaveLength(1);
  await f.preserved();
});

it("reclaims only its stopped candidate and never follows its external links or removes unrecorded directories", async () => {
  const f = await fixture(),
    directory = await f.current.create();
  await writeFile(path.join(directory, "generated.txt"), "Generated");
  const outside = path.join(f.root, "private-draft.txt");
  await symlink(outside, path.join(directory, "external-link"));
  await link(outside, path.join(directory, "git-object-link"));
  const unknown = path.join(f.state, "candidates", "checkout-legacy");
  await mkdir(unknown, { mode: 0o700 });
  await writeFile(path.join(unknown, "keep.txt"), "Unknown retained files");
  await f.current.stopped(directory);
  expect(await f.create().prune()).toBe(true);
  expect(await lstat(directory).catch(() => null)).toBeNull();
  expect(await lstat(f.receipt).catch(() => null)).toBeNull();
  expect(await readFile(path.join(unknown, "keep.txt"), "utf8")).toBe(
    "Unknown retained files",
  );
  await f.preserved();
});

it("protects checkout recovery even after processes stopped and permits cleanup when the receipt is finished", async () => {
  const f = await fixture(),
    directory = await f.current.create();
  await writeFile(
    path.join(directory, "candidate-source"),
    "Recoverable source",
  );
  f.protect(directory);
  const next = f.restart();
  expect(await next.prune()).toBe(false);
  expect(await readFile(path.join(directory, "candidate-source"), "utf8")).toBe(
    "Recoverable source",
  );
  f.protect(null);
  expect(await next.prune()).toBe(true);
  expect(await lstat(directory).catch(() => null)).toBeNull();
});

it.each(["missing", "empty", "first-link"])(
  "reconciles an allocation interrupted at %s before any Git command",
  async (phase) => {
    const f = await fixture(),
      directory = await f.current.create();
    const item = await f.update((item) => {
      item.phase = "allocating";
      delete item.directory;
    });
    if (phase === "missing") await rm(directory, { recursive: true });
    if (phase === "first-link")
      await link(
        f.receipt,
        path.join(f.state, "candidate-" + item.id + ".json.tmp"),
      );
    expect(await f.restart().prune()).toBe(true);
    expect(await lstat(directory).catch(() => null)).toBeNull();
    expect(await lstat(f.receipt).catch(() => null)).toBeNull();
    expect(
      (await readdir(f.state)).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
    await expect(f.create().create()).resolves.toMatch(/checkout-/);
  },
);

it("preserves unexpected files in an allocation that never recorded its directory inode", async () => {
  const f = await fixture(),
    directory = await f.current.create();
  await f.update((item) => {
    item.phase = "allocating";
    delete item.directory;
  });
  await writeFile(path.join(directory, "unknown.txt"), "Preserved");
  await expect(f.restart().prune()).rejects.toThrow();
  expect(await readFile(path.join(directory, "unknown.txt"), "utf8")).toBe(
    "Preserved",
  );
  expect((await f.read()).phase).toBe("allocating");
});

it.each([false, true])(
  "resumes interrupted deletion without losing the receipt, already removed=%s",
  async (removed) => {
    const f = await fixture(),
      directory = await f.current.create();
    await writeFile(path.join(directory, "part-a"), "A");
    await writeFile(path.join(directory, "part-b"), "B");
    await f.current.stopped(directory);
    await f.update((item) => {
      item.phase = "removing";
    });
    if (removed) await rm(directory, { recursive: true });
    else await rm(path.join(directory, "part-a"));
    expect(await f.create().prune()).toBe(true);
    expect(await lstat(directory).catch(() => null)).toBeNull();
    expect(await lstat(f.receipt).catch(() => null)).toBeNull();
    await f.preserved();
  },
);

it.each(["directory", "symlink"])(
  "refuses a candidate root replaced with a different %s",
  async (replacement) => {
    const f = await fixture(),
      directory = await f.current.create();
    await f.current.stopped(directory);
    await rename(directory, directory + "-original");
    if (replacement === "symlink") await symlink(f.root, directory);
    else {
      await mkdir(directory, { mode: 0o700 });
      await writeFile(path.join(directory, "keep"), "Operator file");
    }
    await expect(f.create().prune()).rejects.toThrow();
    expect(await lstat(f.receipt)).toBeTruthy();
    if (replacement === "directory")
      expect(await readFile(path.join(directory, "keep"), "utf8")).toBe(
        "Operator file",
      );
    await f.preserved();
  },
);

it("refuses malformed, linked, oversized or foreign ownership records without deleting candidates", async () => {
  for (const change of [
    (item: any) => {
      item.root += "-changed";
    },
    (item: any) => {
      item.owner.configuration = "d".repeat(64);
    },
    (item: any) => {
      item.owner.workerId = "foreign";
    },
    (item: any) => {
      item.id = "../foreign";
    },
    (item: any) => {
      item.directory = null;
    },
  ]) {
    const f = await fixture(),
      directory = await f.current.create();
    await f.current.stopped(directory);
    await f.update(change);
    await expect(f.create().prune()).rejects.toThrow();
    expect((await lstat(directory)).isDirectory()).toBe(true);
  }
  for (const kind of ["symlink", "hardlink", "large", "json"]) {
    const f = await fixture(),
      directory = await f.current.create();
    await f.current.stopped(directory);
    if (kind === "symlink") {
      await rename(f.receipt, f.receipt + ".saved");
      await symlink(f.receipt + ".saved", f.receipt);
    }
    if (kind === "hardlink") await link(f.receipt, f.receipt + ".foreign");
    if (kind === "large") await writeFile(f.receipt, " ".repeat(16385));
    if (kind === "json") await writeFile(f.receipt, "{");
    await expect(f.create().prune()).rejects.toThrow();
    expect((await lstat(directory)).isDirectory()).toBe(true);
    await f.preserved();
  }
});

it("bounds unknown retained directories without deleting or adopting them", async () => {
  const f = await fixture();
  await mkdir(path.join(f.state, "candidates"), { mode: 0o700 });
  for (let i = 0; i < 64; i++)
    await mkdir(path.join(f.state, "candidates", "legacy-" + i));
  await expect(f.current.create()).rejects.toThrow();
  expect(await readdir(path.join(f.state, "candidates"))).toHaveLength(64);
  expect(await lstat(f.receipt).catch(() => null)).toBeNull();
});

it.each(["root", "nested"])(
  "refuses a reported %s mount without deleting retained contents",
  async (kind) => {
    const f = await fixture(),
      directory = await f.current.create();
    const nested = path.join(directory, "bind mount");
    await mkdir(nested);
    await writeFile(path.join(nested, "keep.txt"), "Mounted fixture content");
    await f.current.stopped(directory);
    const target = (kind === "root" ? directory : nested).replace(
      / /g,
      "\\040",
    );
    mounts.extra = `123 1 0:1 / ${target} rw - ext4 /dev/fixture rw\n`;
    await expect(f.create().prune()).rejects.toThrow("still owned or changed");
    expect(await readFile(path.join(nested, "keep.txt"), "utf8")).toBe(
      "Mounted fixture content",
    );
    expect(await lstat(f.receipt)).toBeTruthy();
  },
);
