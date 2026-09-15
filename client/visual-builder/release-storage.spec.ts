import { afterEach, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  checkReleaseStorage,
  measureReleaseStorage,
  releaseStorageLimits,
  copyReleaseFile,
} from "../../scripts/release-storage.mjs";
import {
  activateRelease,
  initialiseStore,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

const roots: string[] = [];
afterEach(async () => {
  for (const directory of roots.splice(0))
    await rm(directory, { recursive: true, force: true });
});
const limits = (bytes: number) => ({
  storeBytes: bytes,
  immutableBytes: bytes,
  freeBytes: 0,
});
const adapters = {
  validateConfig: async () => {},
  reload: async () => {},
  checkLive: async () => {},
};
async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kaizen-release-capacity-"),
  );
  roots.push(directory);
  const store = path.join(directory, "store");
  const source = async (name: string) => {
    const root = path.join(directory, name);
    await mkdir(path.join(root, "builder"), { recursive: true });
    await mkdir(path.join(root, "_astro"));
    await writeFile(path.join(root, "index.html"), `<h1>${name}</h1>`);
    await writeFile(path.join(root, "builder/index.html"), `<p>${name}</p>`);
    await writeFile(
      path.join(root, "_astro", `${name}.js`),
      `console.log('${name}');`,
    );
    return root;
  };
  const first = await source("first");
  await stageRelease({ source: first, store, id: "first" });
  await initialiseStore({ store, id: "first" });
  return { directory, store, first, source };
}
it("counts sparse, hard-linked, incomplete and unknown files without following outside links", async () => {
  const f = await fixture();
  const before = await measureReleaseStorage(f.store);
  const retained = path.join(f.store, "unknown-retained-file");
  await writeFile(retained, "");
  await truncate(retained, 100 * 1024 ** 2);
  await link(retained, path.join(f.store, "another-retained-name"));
  const outside = path.join(f.directory, "private.txt");
  await writeFile(outside, "private content");
  await symlink(outside, path.join(f.store, "outside-link"));
  await mkdir(path.join(f.store, ".staging-interrupted"));
  await writeFile(
    path.join(f.store, ".staging-interrupted/partial"),
    "unfinished bytes",
  );
  const after = await measureReleaseStorage(f.store);
  expect(after.bytes - before.bytes).toBeGreaterThanOrEqual(200 * 1024 ** 2);
  expect(after.bytes - before.bytes).toBeLessThan(201 * 1024 ** 2);
  await expect(
    checkReleaseStorage(f.store, limits(before.bytes + 100 * 1024 ** 2)),
  ).rejects.toThrow("storage limit");
  expect(await readFile(outside, "utf8")).toBe("private content");
});
it("refuses new staging before materialization while preserving serving and incomplete releases", async () => {
  const f = await fixture();
  const next = await f.source("next");
  await mkdir(path.join(f.store, ".staging-unknown"));
  await writeFile(
    path.join(f.store, ".staging-unknown/kept"),
    "not this operation",
  );
  const before = await readFile(path.join(f.store, "active.conf"));
  const sample = await measureReleaseStorage(f.store);
  let copied = false;
  await expect(
    stageRelease({
      source: next,
      store: f.store,
      id: "next",
      storageLimits: limits(sample.bytes + 1),
      report: () => {
        copied = true;
      },
    }),
  ).rejects.toThrow("storage limit");
  expect(copied).toBe(false);
  expect(await readdir(path.join(f.store, "releases"))).toEqual(["first"]);
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(before);
  expect(
    await readFile(path.join(f.store, ".staging-unknown/kept"), "utf8"),
  ).toBe("not this operation");
  expect((await verifyRelease(f.store, "first")).id).toBe("first");
});
it("staging and activation share one operation lock, then release it for the next operation", async () => {
  const f = await fixture();
  const next = await f.source("next"),
    later = await f.source("later");
  let competingStage: Promise<unknown> | undefined,
    competingActivation: Promise<unknown> | undefined;
  await stageRelease({
    source: next,
    store: f.store,
    id: "next",
    report: (event) => {
      if (event.status === "staging") {
        competingStage = expect(
          stageRelease({ source: later, store: f.store, id: "later" }),
        ).rejects.toThrow("owns the lock");
        competingActivation = expect(
          activateRelease(
            { store: f.store, id: "first", origin: "http://127.0.0.1" },
            adapters,
          ),
        ).rejects.toThrow("owns the lock");
      }
    },
  });
  await competingStage;
  await competingActivation;
  expect(await readdir(path.join(f.store, "releases"))).toEqual([
    "first",
    "next",
  ]);
  await stageRelease({ source: later, store: f.store, id: "later" });
  await expect(
    lstat(path.join(f.store, ".activation-lock")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});
it("refuses immutable growth before copying or switching, and still allows rollback using retained assets", async () => {
  const f = await fixture();
  await stageRelease({
    source: await f.source("next"),
    store: f.store,
    id: "next",
  });
  const before = await readFile(path.join(f.store, "active.conf"));
  const sample = await measureReleaseStorage(f.store);
  await expect(
    activateRelease(
      {
        store: f.store,
        id: "next",
        origin: "http://127.0.0.1",
        storageLimits: {
          ...limits(8 * 1024 ** 3),
          immutableBytes: sample.immutableBytes + 1,
        },
      },
      adapters,
    ),
  ).rejects.toThrow("assets have reached");
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(before);
  await expect(
    lstat(path.join(f.store, "immutable/_astro/next.js")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  await activateRelease(
    { store: f.store, id: "next", origin: "http://127.0.0.1" },
    adapters,
  );
  await activateRelease(
    {
      store: f.store,
      id: "first",
      origin: "http://127.0.0.1",
      storageLimits: limits(1),
    },
    adapters,
  );
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(before);
});
it("rejects output that grows or is replaced after admission and removes only its own temporary copy", async () => {
  const f = await fixture();
  const next = await f.source("next");
  await expect(
    stageRelease({
      source: next,
      store: f.store,
      id: "next",
      report: (event) => {
        if (event.status === "staging") {
          writeFileSync(
            path.join(next, "_astro/next.js"),
            "changed after observation",
          );
        }
      },
    }),
  ).rejects.toThrow("source changed");
  expect(
    (await readdir(f.store)).filter((name) => name.startsWith(".staging-")),
  ).toEqual([]);
  expect(await readdir(path.join(f.store, "releases"))).toEqual(["first"]);
});
it("bounds direct copies against their observed source and refuses symbolic replacements", async () => {
  const f = await fixture();
  const source = path.join(f.first, "index.html"),
    observed = await lstat(source),
    target = path.join(f.directory, "copy");
  await writeFile(source, "changed");
  await expect(copyReleaseFile(source, target, observed)).rejects.toThrow(
    "source changed",
  );
  await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
  await rm(source);
  await symlink(path.join(f.first, "builder/index.html"), source);
  await expect(copyReleaseFile(source, target, observed)).rejects.toThrow(
    "source changed",
  );
});
it("applies the existing client output envelope to native artifacts too", async () => {
  const f = await fixture();
  const next = await f.source("next");
  await truncate(path.join(next, "_astro/next.js"), 33 * 1024 ** 2);
  await expect(
    stageRelease({ source: next, store: f.store, id: "next" }),
  ).rejects.toThrow("32 MB");
  expect(await readdir(path.join(f.store, "releases"))).toEqual(["first"]);
});
it("does not accept matching immutable bytes through a linked parent", async () => {
  const f = await fixture();
  const source = await f.source("next");
  await mkdir(path.join(source, "_astro/nested"));
  await writeFile(
    path.join(source, "_astro/nested/asset.js"),
    "matching bytes",
  );
  await stageRelease({ source, store: f.store, id: "next" });
  const outside = path.join(f.directory, "outside-assets");
  await mkdir(outside);
  await writeFile(path.join(outside, "asset.js"), "matching bytes");
  await symlink(outside, path.join(f.store, "immutable/_astro/nested"));
  const before = await readFile(path.join(f.store, "active.conf"));
  await expect(
    activateRelease(
      { store: f.store, id: "next", origin: "http://127.0.0.1" },
      adapters,
    ),
  ).rejects.toThrow("ordinary directory");
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(before);
  expect(await readFile(path.join(outside, "asset.js"), "utf8")).toBe(
    "matching bytes",
  );
});
it("validates operator limits and cannot spend the same retained capacity again after restart", async () => {
  const f = await fixture();
  for (const value of ["-1", "1.5", "no-limit"])
    expect(() =>
      releaseStorageLimits({ BUILDER_RELEASE_STORAGE_MAX_BYTES: value }),
    ).toThrow("capacity limits");
  const sample = await measureReleaseStorage(f.store);
  const allowance = limits(sample.bytes + 100);
  await checkReleaseStorage(f.store, allowance, { bytes: 99 });
  await writeFile(
    path.join(f.store, "interrupted-materialization"),
    Buffer.alloc(1000),
  );
  await expect(checkReleaseStorage(f.store, allowance)).rejects.toThrow(
    "storage limit",
  );
});
