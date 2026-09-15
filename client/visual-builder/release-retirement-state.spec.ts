import { afterEach, expect, it } from "vitest";
import { constants } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import {
  ReleaseRetirementState,
  assertReleaseIdNotRetired,
} from "../../scripts/release-retirement-state.mjs";
import { stageRelease } from "../../scripts/kaizen-releases.mjs";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const identity = (s: any) => ({
  dev: s.dev,
  ino: s.ino,
  uid: s.uid,
  gid: s.gid,
  mode: s.mode,
  nlink: s.nlink,
  size: s.size,
  mtimeMs: s.mtimeMs,
  ctimeMs: s.ctimeMs,
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-retirement-state-"));
  roots.push(root);
  const store = path.join(root, "store"),
    source = path.join(root, "source");
  await mkdir(source);
  await writeFile(path.join(source, "index.html"), "<h1>Retained fixture</h1>");
  await mkdir(path.join(source, "builder"));
  await writeFile(
    path.join(source, "builder/index.html"),
    "<h1>Builder fixture</h1>",
  );
  await stageRelease({ store, source, id: "old" });
  const base = await lstat(store);
  const options = {
    projectId: "kaizen",
    scope: "repository:production",
    workerId: "release-fixture",
    origin: "https://example.test",
  };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: 1,
        ...Object.fromEntries(
          Object.entries(options).filter(([key]) => key !== "origin"),
        ),
        root: store,
        dev: base.dev,
        ino: base.ino,
        uid: base.uid,
        gid: base.gid,
      }),
    )
    .digest("hex");
  const state = new ReleaseRetirementState(store);
  const bind = () => state.bind({ ...options, storeFingerprint: fingerprint });
  const entries: any[] = [];
  async function walk(relative = "") {
    const target = path.join(store, "releases/old", relative),
      info = await lstat(target);
    entries.push({
      path: relative,
      type: info.isDirectory() ? "directory" : "file",
      identity: identity(info),
    });
    if (info.isDirectory())
      for (const child of await readdir(target))
        await walk(relative ? `${relative}/${child}` : child);
  }
  await walk();
  const attempt = {
    version: 1,
    token: randomUUID(),
    generation: 0,
    artifactId: "old",
    manifestSha256: createHash("sha256")
      .update(await readFile(path.join(store, "releases/old/release.json")))
      .digest("hex"),
    bytes: entries.reduce((total, item) => total + item.identity.size, 0),
    fingerprint,
    owner: {
      operation: {
        id: randomUUID(),
        workerId: "native-fixture",
        configuration: "a".repeat(64),
        projectId: "kaizen",
        processId: process.pid,
        host: hostname(),
        instanceId: randomUUID(),
      },
      controller: {
        kind: "systemd",
        unit: "kaizen-fixture.service",
        invocationId: "b".repeat(32),
      },
    },
    entries,
  };
  const receipt = {
    phase: "removed",
    owner_token: attempt.token,
    attempt_generation: attempt.generation,
    project_id: options.projectId,
    scope: options.scope,
    worker_id: options.workerId,
    artifact_id: attempt.artifactId,
    store_fingerprint: fingerprint,
    manifest_sha256: attempt.manifestSha256,
    bytes: attempt.bytes,
  };
  return {
    root,
    store,
    source,
    state,
    bind,
    options,
    fingerprint,
    attempt,
    receipt,
  };
}
it("binds the physical store once, preserves private records, and refuses configuration reassignment", async () => {
  const f = await fixture();
  const first = await f.bind();
  expect(await f.bind()).toEqual(first);
  const bytes = await readFile(path.join(f.store, ".retirement/binding.json"));
  expect((await lstat(path.join(f.store, ".retirement"))).mode & 0o777).toBe(
    0o700,
  );
  expect(
    (await lstat(path.join(f.store, ".retirement/binding.json"))).mode & 0o777,
  ).toBe(0o600);
  for (const changed of [
    { origin: "https://other.test" },
    { scope: "repository:staging" },
    { workerId: "other" },
    { projectId: randomUUID() },
  ])
    await expect(
      f.state.bind({
        ...f.options,
        storeFingerprint: f.fingerprint,
        ...changed,
      }),
    ).rejects.toThrow(/ownership/);
  expect(
    await readFile(path.join(f.store, ".retirement/binding.json")),
  ).toEqual(bytes);
});
it("refuses a copied binding in a different inode and an exchanged releases directory", async () => {
  const f = await fixture();
  await f.bind();
  await rename(
    path.join(f.store, "releases"),
    path.join(f.store, "preserved-releases"),
  );
  await mkdir(path.join(f.store, "releases"));
  await expect(
    new ReleaseRetirementState(f.store).loadBinding(),
  ).rejects.toThrow(/ownership/);
  expect(
    await readFile(
      path.join(f.store, "preserved-releases/old/site/index.html"),
      "utf8",
    ),
  ).toContain("Retained fixture");
  const other = path.join(f.root, "other-store");
  await mkdir(other);
  await mkdir(path.join(other, "releases"));
  await mkdir(path.join(other, ".retirement"), { mode: 0o700 });
  await writeFile(
    path.join(other, ".retirement/binding.json"),
    await readFile(path.join(f.store, ".retirement/binding.json")),
    { mode: 0o600 },
  );
  await expect(new ReleaseRetirementState(other).loadBinding()).rejects.toThrow(
    /ownership/,
  );
});
it("keeps an immutable attempt and token across a lost acknowledgement; direct staging cannot reuse it", async () => {
  const f = await fixture();
  await f.bind();
  await f.state.begin(f.attempt);
  const recovered = new ReleaseRetirementState(f.store);
  await recovered.loadBinding();
  expect(await recovered.attempt()).toEqual(f.attempt);
  await expect(
    f.state.begin({ ...f.attempt, token: randomUUID() }),
  ).rejects.toThrow(/ownership/);
  await expect(
    stageRelease({ store: f.store, source: f.source, id: "old" }),
  ).rejects.toThrow(/unfinished retirement/);
  await stageRelease({ store: f.store, source: f.source, id: "new" });
  expect(await f.state.attempt()).toEqual(f.attempt);
});
it("requires actual absence and exact completion before releasing the attempt, retaining a permanent ID fence", async () => {
  const f = await fixture();
  await f.bind();
  await f.state.begin(f.attempt);
  await f.state.fence(f.attempt);
  await expect(f.state.forget(f.attempt, f.receipt)).rejects.toThrow(
    /ownership/,
  );
  // Simulate the future coordinator's completed physical removal in this
  // disposable store. This fixture does not claim coordinator/restart proof.
  await rm(path.join(f.store, "releases/old"), { recursive: true });
  for (const changed of [
    { owner_token: randomUUID() },
    { phase: "removing" },
    { bytes: 0 },
    { worker_id: "other" },
    { scope: "repository:staging" },
  ])
    await expect(
      f.state.forget(f.attempt, { ...f.receipt, ...changed }),
    ).rejects.toThrow(/ownership/);
  expect(await f.state.attempt()).toEqual(f.attempt);
  await f.state.forget(f.attempt, f.receipt);
  await f.state.forget(f.attempt, f.receipt);
  expect(await f.state.attempt()).toBeNull();
  await expect(
    stageRelease({ store: f.store, source: f.source, id: "old" }),
  ).rejects.toThrow(/has been retired/);
  await expect(f.state.begin(f.attempt)).rejects.toThrow(/ownership/);
  await stageRelease({ store: f.store, source: f.source, id: "new" });
});
it("recovers only the exact first-publication inode pair, preserving unrelated temporary records", async () => {
  const f = await fixture();
  await f.bind();
  await f.state.begin(f.attempt);
  const saved = path.join(f.store, ".retirement/attempt.json"),
    paired = path.join(f.store, `.retirement/.write-${randomUUID()}.tmp`);
  const foreign = path.join(f.store, `.retirement/.write-${randomUUID()}.tmp`);
  await link(saved, paired);
  await writeFile(foreign, "uncommitted private fixture", { mode: 0o600 });
  await expect(assertReleaseIdNotRetired(f.store, "new")).rejects.toThrow(
    /ownership/,
  );
  expect(await f.state.attempt()).toEqual(f.attempt);
  await expect(lstat(paired)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(foreign, "utf8")).toBe("uncommitted private fixture");
  expect((await lstat(saved)).nlink).toBe(1);
  await link(saved, path.join(f.root, "outside-link"));
  await expect(f.state.attempt()).rejects.toThrow(/ownership/);
  expect((await lstat(saved)).nlink).toBe(2);
});
it("recovers a binding/fence publication pair and preserves the fence across a lost local completion", async () => {
  const f = await fixture();
  await f.bind();
  const binding = path.join(f.store, ".retirement/binding.json");
  await link(
    binding,
    path.join(f.store, `.retirement/.write-${randomUUID()}.tmp`),
  );
  await f.bind();
  await f.state.begin(f.attempt);
  await f.state.fence(f.attempt);
  const fence = path.join(f.store, ".retirement/retired/old.json");
  await link(
    fence,
    path.join(f.store, `.retirement/retired/.write-${randomUUID()}.tmp`),
  );
  await f.state.fence(f.attempt);
  expect((await lstat(fence)).nlink).toBe(1);
  await expect(assertReleaseIdNotRetired(f.store, "old")).rejects.toThrow(
    /retired/,
  );
});
it("refuses malformed, sparse oversized, linked and publicly readable state without altering it", async () => {
  const f = await fixture();
  await f.bind();
  const file = path.join(f.store, ".retirement/attempt.json");
  await writeFile(file, "{partial", { mode: 0o600 });
  await expect(f.state.attempt()).rejects.toThrow(/ownership/);
  expect(await readFile(file, "utf8")).toBe("{partial");
  await truncate(file, 9 * 1024 ** 2);
  await expect(f.state.attempt()).rejects.toThrow(/metadata/);
  expect((await lstat(file)).size).toBe(9 * 1024 ** 2);
  await rm(file);
  await f.state.begin(f.attempt);
  await chmod(file, 0o644);
  await expect(f.state.attempt()).rejects.toThrow(/ownership/);
  await chmod(file, 0o600);
  await rename(file, path.join(f.root, "outside-attempt"));
  await symlink(path.join(f.root, "outside-attempt"), file);
  await expect(f.state.attempt()).rejects.toThrow(/ownership/);
  expect(
    JSON.parse(await readFile(path.join(f.root, "outside-attempt"), "utf8")),
  ).toEqual(f.attempt);
});
it("rejects unsafe, incomplete or cross-owner file inventories before making an attempt", async () => {
  const f = await fixture();
  await f.bind();
  const variants = [
    { ...f.attempt, entries: [...f.attempt.entries, f.attempt.entries[0]] },
    {
      ...f.attempt,
      entries: f.attempt.entries.filter((e) => e.path !== "site"),
    },
    { ...f.attempt, bytes: f.attempt.bytes + 1 },
    {
      ...f.attempt,
      entries: f.attempt.entries.map((e) =>
        e.path === "site/index.html" ? { ...e, path: "../outside" } : e,
      ),
    },
    {
      ...f.attempt,
      entries: f.attempt.entries.map((e) =>
        e.path === "site/index.html"
          ? {
              ...e,
              identity: { ...e.identity, mode: constants.S_IFLNK | 0o777 },
            }
          : e,
      ),
    },
    {
      ...f.attempt,
      owner: {
        ...f.attempt.owner,
        operation: { ...f.attempt.owner.operation, projectId: randomUUID() },
      },
    },
    {
      ...f.attempt,
      owner: {
        ...f.attempt.owner,
        operation: { ...f.attempt.owner.operation, processId: process.pid + 1 },
      },
    },
  ];
  for (const value of variants)
    await expect(f.state.begin(value)).rejects.toThrow(/ownership/);
  expect(await f.state.attempt()).toBeNull();
});
it("keeps ambiguous state and other attempt ownership when a completion is retried", async () => {
  const f = await fixture();
  await f.bind();
  await f.state.begin(f.attempt);
  await f.state.fence(f.attempt);
  await rm(path.join(f.store, "releases/old"), { recursive: true });
  const file = path.join(f.store, ".retirement/attempt.json"),
    replacement = { ...f.attempt, token: randomUUID() };
  await writeFile(file, JSON.stringify(replacement), { mode: 0o600 });
  await expect(f.state.forget(f.attempt, f.receipt)).rejects.toThrow(
    /ownership/,
  );
  expect(await f.state.attempt()).toEqual(replacement);
});
it("does not adopt populated unknown metadata or follow a linked private state directory", async () => {
  const f = await fixture();
  await mkdir(path.join(f.store, ".retirement"), { mode: 0o700 });
  const note = path.join(f.store, ".retirement/operator-note");
  await writeFile(note, "keep me");
  await expect(f.bind()).rejects.toThrow(/ownership/);
  expect(await readFile(note, "utf8")).toBe("keep me");
  await rename(path.join(f.store, ".retirement"), path.join(f.root, "outside"));
  await symlink(
    path.join(f.root, "outside"),
    path.join(f.store, ".retirement"),
  );
  await expect(f.bind()).rejects.toThrow(/ownership/);
  expect(await readdir(path.join(f.root, "outside"))).toEqual([
    "operator-note",
  ]);
});

it("abandons only after authoritative generation cancellation, leaving release bytes and newer work untouched", async () => {
  const f = await fixture();
  await f.bind();
  await f.state.begin(f.attempt);
  const receipt = {
    ...f.receipt,
    phase: "cancelled",
    owner_token: null,
    cancelled_token: f.attempt.token,
    cancelled_generation: 0,
    attempt_generation: 1,
  };
  for (const changed of [
    { phase: "pending" },
    { attempt_generation: 0 },
    { cancelled_generation: 1 },
    { cancelled_token: randomUUID() },
  ])
    await expect(
      f.state.abandon(f.attempt, { ...receipt, ...changed }),
    ).rejects.toThrow(/ownership/);
  await f.state.abandon(f.attempt, receipt);
  await f.state.abandon(f.attempt, receipt);
  expect(await f.state.attempt()).toBeNull();
  expect(
    await readFile(path.join(f.store, "releases/old/site/index.html"), "utf8"),
  ).toContain("Retained fixture");
  const newer = { ...f.attempt, generation: 1, token: randomUUID() };
  await f.state.begin(newer);
  await expect(f.state.abandon(f.attempt, receipt)).rejects.toThrow(
    /ownership/,
  );
  expect(await f.state.attempt()).toEqual(newer);
  await f.state.fence(newer);
  await expect(
    f.state.abandon(newer, {
      ...receipt,
      cancelled_token: newer.token,
      cancelled_generation: 1,
      attempt_generation: 2,
    }),
  ).rejects.toThrow(/ownership/);
});
