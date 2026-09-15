import { afterEach, expect, it } from "vitest";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  statfs,
  writeFile,
} from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { StorageAdmission } from "../../scripts/storage-admission.mjs";
import {
  currentProcessIdentity,
  processStart,
} from "../../scripts/process-identity.mjs";
import { HostedDiskGuard } from "../../scripts/builder-hosted-disk";
import { stageRelease } from "../../scripts/kaizen-releases.mjs";

const GiB = 1024 ** 3;
const roots: string[] = [],
  children: ChildProcess[] = [];
afterEach(async () => {
  for (const child of children.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill("SIGKILL");
      await closed;
    }
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "kaizen-admission-"));
  roots.push(root);
  const ledger = path.join(root, "admission");
  await mkdir(ledger, { mode: 0o770 });
  return { root, ledger };
}
const disk = (free: bigint) => async () => ({ bavail: free, bsize: 1n });
const records = async (ledger: string) =>
  (await readdir(ledger)).filter((name) => name.endsWith(".json"));

it("lets producers share headroom without both spending it, even concurrently", async () => {
  const f = await fixture();
  const open = (service: string, free: bigint, cap?: number) =>
    StorageAdmission.open(f.ledger, service, {
      statfs: disk(free),
      ...(cap ? { maximumReservationBytes: cap } : {}),
    });
  const website = await open("website-storage", BigInt(10 * GiB)),
    release = await open("release-store", BigInt(10 * GiB));
  const fixed = { minimum: 5 * GiB, maximum: 5 * GiB, floor: 2 * GiB };
  const first = await website.reserve(f.root, fixed);
  await expect(
    release.reserve(f.root, {
      minimum: 4 * GiB,
      maximum: 4 * GiB,
      floor: 2 * GiB,
    }),
  ).rejects.toMatchObject({ admissionRefused: true });
  expect(await records(f.ledger)).toHaveLength(1);
  // Open-ended work takes only what other reservations and the floor leave.
  const partial = await release.reserve(f.root, {
    minimum: 0,
    maximum: 8 * GiB,
    floor: 2 * GiB,
  });
  expect(partial.bytes).toBe(3 * GiB);
  await first.release();
  await partial.release();
  expect(await readdir(f.ledger)).toEqual([]);

  const settled = await Promise.allSettled([
    website.reserve(f.root, fixed),
    release.reserve(f.root, fixed),
  ]);
  expect(
    settled.filter((item) => item.status === "fulfilled").length,
  ).toBeLessThanOrEqual(1);
  for (const item of settled)
    if (item.status === "fulfilled") await item.value.release();
    else expect(item.reason.admissionRefused).toBe(true);
  expect(await readdir(f.ledger)).toEqual([]);

  // The cap limits open-ended reservations, never a required copy size.
  const capped = await open("release-store", BigInt(100 * GiB), GiB);
  const copy = await capped.reserve(f.root, {
    minimum: 3 * GiB,
    maximum: 3 * GiB,
    floor: 0,
  });
  expect(copy.bytes).toBe(3 * GiB);
  expect(
    (await capped.reserve(f.root, { minimum: 0, maximum: 50 * GiB, floor: 0 }))
      .bytes,
  ).toBe(GiB);
});

it("removes a reservation only when its owner process is proven gone, keeping other hosts", async () => {
  const f = await fixture(),
    me = await currentProcessIdentity();
  const child = spawn("/usr/bin/sleep", ["30"], { stdio: "ignore" });
  children.push(child);
  await once(child, "spawn");
  const started = await processStart(child.pid!);
  const dev = (await lstat(f.root)).dev;
  const record = async (owner: object, bytes: number) => {
    const id = randomUUID();
    await writeFile(
      path.join(f.ledger, `${id}.json`),
      JSON.stringify({
        version: 1,
        id,
        service: "native-deployment",
        dev,
        bytes,
        owner,
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o640 },
    );
    return id;
  };
  await record(
    { ...me, processId: child.pid!, startTime: started!.startTime },
    4 * GiB,
  );
  const remote = await record({ ...me, host: "another-host" }, 2 * GiB);
  const admission = await StorageAdmission.open(f.ledger, "website-storage", {
    statfs: disk(BigInt(100 * GiB)),
  });
  expect(await admission.reserved(f.root)).toBe(BigInt(6 * GiB));
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  expect(await admission.reserved(f.root)).toBe(BigInt(2 * GiB));
  expect(await readdir(f.ledger)).toEqual([`${remote}.json`]);
});

it("refuses malformed or unsafe admission state instead of discounting it", async () => {
  const f = await fixture();
  await writeFile(path.join(f.ledger, `${randomUUID()}.json`), "{not json");
  const admission = await StorageAdmission.open(f.ledger, "release-store", {
    statfs: disk(BigInt(10 * GiB)),
  });
  await expect(
    admission.reserve(f.root, { minimum: 1, maximum: 1, floor: 0 }),
  ).rejects.toThrow(/malformed/);
  expect(await readdir(f.ledger)).toHaveLength(1);
  await chmod(f.ledger, 0o777);
  await expect(
    StorageAdmission.open(f.ledger, "release-store"),
  ).rejects.toThrow(/world-writable/);
  await chmod(f.ledger, 0o770);
  expect(
    await StorageAdmission.fromEnvironment("release-store", {}),
  ).toBeNull();
  await expect(
    StorageAdmission.fromEnvironment("release-store", {
      KAIZEN_STORAGE_ADMISSION_DIRECTORY: f.ledger,
      KAIZEN_STORAGE_RESERVATION_MAX_BYTES: "-1",
    }),
  ).rejects.toThrow(/maximum/);
});

it("stops monitored work that outgrows its shared reservation and counts other reservations", async () => {
  const f = await fixture(),
    projectId = randomUUID();
  const project = path.join(f.root, "projects", projectId);
  await mkdir(project, { recursive: true });
  const admission = StorageAdmission.open(f.ledger, "website-storage", {
    maximumReservationBytes: 1024 * 1024,
  });
  const guard = new HostedDiskGuard(
    f.root,
    { projectBytes: GiB, freeBytes: 0, intervalMs: 100 },
    undefined,
    () => admission,
  );
  await expect(
    guard.run(projectId, async (signal) => {
      expect(await records(f.ledger)).toHaveLength(1);
      await writeFile(
        path.join(project, "large.bin"),
        Buffer.alloc(3 * 1024 ** 2),
      );
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("stopped"));
        });
      });
    }),
  ).rejects.toThrow(/more disk space than it could reserve/);
  expect(await readdir(f.ledger)).toEqual([]);

  const real = await statfs(f.root, { bigint: true });
  const crowded = new HostedDiskGuard(
    f.root,
    { projectBytes: GiB, freeBytes: 0, intervalMs: 100 },
    undefined,
    async () =>
      ({
        reserved: async () => real.bavail * real.bsize + BigInt(GiB),
      }) as any,
  );
  await expect(crowded.check(projectId, 1)).rejects.toThrow(
    /short of free disk space/,
  );
});

it("holds a release copy against shared space and refuses staging before copying when it is gone", async () => {
  const f = await fixture();
  const store = path.join(f.root, "store"),
    source = path.join(f.root, "source");
  await mkdir(path.join(source, "builder"), { recursive: true });
  await writeFile(path.join(source, "index.html"), "<h1>Shared</h1>");
  await writeFile(path.join(source, "builder/index.html"), "<h1>Builder</h1>");
  const saved = {
    directory: process.env.KAIZEN_STORAGE_ADMISSION_DIRECTORY,
    floor: process.env.BUILDER_RELEASE_MIN_FREE_BYTES,
  };
  process.env.KAIZEN_STORAGE_ADMISSION_DIRECTORY = f.ledger;
  try {
    await stageRelease({ store, source, id: "shared-one" });
    expect(await readdir(f.ledger)).toEqual([]);
    const me = await currentProcessIdentity(),
      id = randomUUID();
    await writeFile(
      path.join(f.ledger, `${id}.json`),
      JSON.stringify({
        version: 1,
        id,
        service: "website-storage",
        dev: (await lstat(store)).dev,
        bytes: 1024 * GiB,
        owner: { ...me, host: "another-host" },
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o640 },
    );
    process.env.BUILDER_RELEASE_MIN_FREE_BYTES = String(1024 * GiB);
    await expect(
      stageRelease({ store, source, id: "shared-two" }),
    ).rejects.toThrow(/short of free disk space/);
    expect(await readdir(path.join(store, "releases"))).toEqual(["shared-one"]);
    expect(
      (await readdir(store)).filter((name) => name.startsWith(".staging-")),
    ).toEqual([]);
  } finally {
    for (const [key, value] of [
      ["KAIZEN_STORAGE_ADMISSION_DIRECTORY", saved.directory],
      ["BUILDER_RELEASE_MIN_FREE_BYTES", saved.floor],
    ] as const)
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
