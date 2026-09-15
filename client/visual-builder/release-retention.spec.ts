import { afterEach, expect, it } from "vitest";
import {
  chmod,
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
import { createHash, randomUUID } from "node:crypto";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import {
  activateRelease,
  bindClientStore,
  checkLive,
  initialiseStore,
  nginxConfig,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";
import {
  inspectReleaseRetention,
  withReleaseRetentionStore,
  releaseRetentionPolicy,
  validateReleaseMounts,
} from "../../scripts/release-retention.mjs";
import { ReleaseRetirementState } from "../../scripts/release-retirement-state.mjs";
import { hashReleaseFile } from "../../scripts/release-storage.mjs";

const roots: string[] = [],
  children: ChildProcess[] = [];
const day = 86400000;
const quiet = {
  validateConfig: async () => {},
  reload: async () => {},
  checkLive: async () => {},
};
afterEach(async () => {
  for (const child of children.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill("SIGTERM");
      await closed;
    }
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture(clientMode = false) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "kaizen-release-retention-"),
  );
  roots.push(root);
  const store = path.join(root, "store"),
    source = path.join(root, "source");
  const now = Date.now() + 120 * day;
  const client = clientMode
    ? {
        projectId: randomUUID(),
        destinationId: randomUUID(),
        environment: "production",
        origin: "https://retention.example",
      }
    : null;
  if (client) await bindClientStore({ store, client });
  await mkdir(path.join(source, "builder"), { recursive: true });
  await mkdir(path.join(source, "_astro"));
  await writeFile(
    path.join(source, "_astro/shared.js"),
    "console.log('shared');",
  );
  if (client) {
    await mkdir(path.join(source, "assets"));
    await writeFile(
      path.join(source, "assets/shared.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
  }
  for (let n = 0; n < 8; n++) {
    await writeFile(path.join(source, "index.html"), `<h1>Release r${n}</h1>`);
    await writeFile(
      path.join(source, "builder/index.html"),
      `<h1>Builder r${n}</h1>`,
    );
    await stageRelease({ store, source, id: `r${n}`, client });
    const file = path.join(store, `releases/r${n}/release.json`);
    const manifest = JSON.parse(await readFile(file, "utf8"));
    // Seed retained age in the fixture; the inspection clock is later than all
    // actual file ctimes. No production metadata or system clock is changed.
    manifest.createdAt = new Date(now - (90 - n) * day).toISOString();
    await writeFile(file, JSON.stringify(manifest, null, 2));
  }
  await initialiseStore({ store, id: "r0" });
  const activation = await activateRelease(
    { store, id: "r7", origin: client?.origin || "http://127.0.0.1" },
    quiet,
  );
  const calls: any[] = [],
    held = new Set<string>(),
    receipts = new Map<string, any>();
  const connection = {
    async rpc(name: string, input: any) {
      expect(name).toBe("builder_release_retention_observe");
      calls.push(input);
      if (held.has(input.artifact))
        return { phase: "protected", artifact_id: input.artifact };
      if (!receipts.has(input.artifact))
        receipts.set(input.artifact, {
          project_id: input.target,
          scope: input.release_scope,
          artifact_id: input.artifact,
          worker_id: input.worker,
          store_fingerprint: input.fingerprint,
          manifest_sha256: input.manifest,
          bytes: input.stored_bytes,
          phase: "pending",
          attempt_generation: 0,
          owner_token: null,
          created_at: new Date(now).toISOString(),
          eligible_at: new Date(now + 7 * day).toISOString(),
        });
      return receipts.get(input.artifact);
    },
  };
  const options = {
    store,
    origin: client?.origin || "http://127.0.0.1",
    projectId: client?.projectId || "kaizen",
    scope: client ? `client:${client.destinationId}` : "repository:production",
    workerId: "retention-fixture",
    connection,
  };
  const inspect = (adapters: any = {}, overrides: any = {}) =>
    inspectReleaseRetention(
      { ...options, ...overrides },
      { now: () => now, checkLive: quiet.checkLive, ...adapters },
    );
  return {
    root,
    store,
    source,
    now,
    client,
    options,
    inspect,
    calls,
    held,
    receipts,
    activation,
  };
}
const ids = (rows: { artifactId: string }[]) =>
  rows.map((row) => row.artifactId).sort();
async function journal(
  f: Awaited<ReturnType<typeof fixture>>,
  values: Record<string, unknown>,
) {
  const id = randomUUID();
  await writeFile(
    path.join(f.store, "transactions", `${id}.json`),
    JSON.stringify({
      schemaVersion: 1,
      id,
      releaseId: "r1",
      previousReleaseId: "r2",
      startedAt: new Date(f.now - 60 * day).toISOString(),
      updatedAt: new Date(f.now - 60 * day).toISOString(),
      status: "live",
      ...values,
    }),
  );
}

it("retains the selected release, immediate rollback and newest five; database queues can protect older candidates", async () => {
  const f = await fixture();
  f.held.add("r1");
  const before = await readFile(path.join(f.store, "active.conf"));
  const result = await f.inspect();
  expect(ids(result.candidates)).toEqual(["r2"]);
  expect(
    result.retained.find((item: any) => item.artifactId === "r0")?.reasons,
  ).toContain("rollback");
  expect(
    result.retained.find((item: any) => item.artifactId === "r7")?.reasons,
  ).toContain("selected");
  expect(
    result.retained.find((item: any) => item.artifactId === "r1")?.reasons,
  ).toEqual(["publication"]);
  expect(f.calls.map((call) => call.artifact)).toEqual(["r1", "r2"]);
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(before);
  expect((await readdir(path.join(f.store, "releases"))).length).toBe(8);
  const candidate = result.candidates[0],
    file = path.join(f.store, "releases/r2/release.json");
  expect(candidate.manifestSha256).toBe(
    createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  );
  expect(candidate.bytes).toBeGreaterThan((await lstat(file)).size);
  expect(() => JSON.stringify(result)).not.toThrow();
  expect((await f.inspect()).candidates[0].receipt).toEqual(candidate.receipt);
});

it("keeps shared immutable references for every retained manifest, including candidates and client assets", async () => {
  const f = await fixture(true),
    result = await f.inspect();
  expect(
    result.immutableReferences.map((item: any) => item.path).sort(),
  ).toEqual(["_astro/shared.js", "assets/shared.svg"]);
  for (const item of result.immutableReferences)
    expect(ids(item.references)).toEqual([
      "r0",
      "r1",
      "r2",
      "r3",
      "r4",
      "r5",
      "r6",
      "r7",
    ]);
  await expect(f.inspect({}, { projectId: randomUUID() })).rejects.toThrow(
    /binding/,
  );
  await expect(
    f.inspect({}, { scope: `client:${randomUUID()}` }),
  ).rejects.toThrow(/binding/);
});

it("counts and preserves unknown root files and abandoned staging without treating them as owned cleanup targets", async () => {
  const f = await fixture(),
    before = await f.inspect();
  await writeFile(
    path.join(f.store, "private-operator-file"),
    "private canary",
  );
  await mkdir(path.join(f.store, ".staging-unowned"));
  await writeFile(
    path.join(f.store, ".staging-unowned/partial"),
    "unowned bytes",
  );
  const result = await f.inspect();
  expect(result.storage.bytes).toBeGreaterThan(before.storage.bytes);
  expect(result.ignoredEntries).toContain("private-operator-file");
  expect(result.ignoredEntries).toContain(".staging-unowned");
  expect(
    await readFile(path.join(f.store, "private-operator-file"), "utf8"),
  ).toBe("private canary");
  expect(ids(result.candidates)).toEqual(["r1", "r2"]);
});

it("protects every incomplete activation/recovery target, regardless of age", async () => {
  const f = await fixture();
  await journal(f, {
    status: "recovery_required",
    previousSelectedReleaseId: "r3",
  });
  const result = await f.inspect();
  expect(result.candidates).toEqual([]);
  for (const id of ["r1", "r2", "r3"])
    expect(
      result.retained.find((row: any) => row.artifactId === id)?.reasons,
    ).toContain("recovery");
  expect(f.calls).toHaveLength(0);
});

it("a terminal transition restarts last-use age and visitor grace, including an older rollback target", async () => {
  const f = await fixture();
  await journal(f, {
    status: "rolled_back",
    startedAt: new Date(f.now - 3 * day).toISOString(),
    updatedAt: new Date(f.now - 2 * day).toISOString(),
  });
  const result = await f.inspect(
    {},
    { retention: { keepCount: 2, minAgeDays: 1, visitorGraceDays: 7 } },
  );
  for (const id of ["r1", "r2"])
    expect(
      result.retained.find((row: any) => row.artifactId === id)?.reasons,
    ).toContain("visitor-grace");
  expect(ids(result.candidates)).toEqual(["r3", "r4", "r5"]);
});

it("uses actual filesystem age as well as manifest dates, so backdating metadata cannot create immediate eligibility", async () => {
  const f = await fixture();
  for (const id of await readdir(path.join(f.store, "releases"))) {
    const file = path.join(f.store, "releases", id, "release.json"),
      value = JSON.parse(await readFile(file, "utf8"));
    value.createdAt = "2000-01-01T00:00:00.000Z";
    await writeFile(file, JSON.stringify(value));
  }
  const result = await f.inspect({ now: Date.now });
  expect(result.candidates).toEqual([]);
  expect(f.calls).toHaveLength(0);
});

it("keeps both possible rollback baselines when journal timestamps cannot establish their order", async () => {
  const f = await fixture();
  for (const previousReleaseId of ["r1", "r2"])
    await journal(f, {
      releaseId: "r7",
      previousReleaseId,
      startedAt: new Date(f.now - 40 * day).toISOString(),
      updatedAt: new Date(f.now - 40 * day).toISOString(),
    });
  const result = await f.inspect();
  // Both newer journals supersede the original r0 baseline, but their own
  // ordering is unknown. r1 and r2 must both remain protected.
  expect(ids(result.candidates)).toEqual(["r0"]);
  for (const id of ["r1", "r2"])
    expect(
      result.retained.find((item: any) => item.artifactId === id)?.reasons,
    ).toContain("rollback");
});

it("refuses same-device bind mounts and decodes escaped mount paths", () => {
  const table = "1 0 8:1 / / rw - ext4 /dev/fixture rw\n";
  expect(() => validateReleaseMounts("/fixture/store", table)).not.toThrow();
  expect(() =>
    validateReleaseMounts(
      "/fixture/store",
      table +
        "2 1 8:1 /private /fixture/store/releases/r1 rw - ext4 /dev/fixture rw\n",
    ),
  ).toThrow(/bind mount/);
  expect(() =>
    validateReleaseMounts(
      "/fixture/store with space",
      table +
        "2 1 8:1 /private /fixture/store\\040with\\040space/releases/r1 rw - ext4 /dev/fixture rw\n",
    ),
  ).toThrow(/bind mount/);
  expect(() => validateReleaseMounts("/fixture/store", "incomplete")).toThrow(
    /mount inventory/,
  );
});

it("joins the staging/activation lock for the entire serving check and database observation", async () => {
  const f = await fixture();
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
  const inspection = f.inspect({
    checkLive: async () => {
      entered();
      await waiting;
    },
  });
  await ready;
  try {
    await expect(
      stageRelease({ store: f.store, source: f.source, id: "competing" }),
    ).rejects.toThrow(/owns the lock/);
    await expect(
      activateRelease(
        { store: f.store, id: "r0", origin: f.options.origin },
        quiet,
      ),
    ).rejects.toThrow(/owns the lock/);
  } finally {
    release();
  }
  await inspection;
  await expect(
    lstat(path.join(f.store, ".activation-lock")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not start database grace if serving verification fails", async () => {
  const f = await fixture();
  await expect(
    f.inspect({
      checkLive: async () => {
        throw new Error("Still serving another release");
      },
    }),
  ).rejects.toThrow(/Still serving/);
  expect(f.calls).toHaveLength(0);
  expect((await readdir(path.join(f.store, "releases"))).length).toBe(8);
});

it("refuses incomplete, unknown or missing recovery evidence before observing candidates", async () => {
  const f = await fixture();
  await writeFile(
    path.join(f.store, "transactions/partial.tmp"),
    "private incomplete journal",
  );
  await expect(f.inspect()).rejects.toThrow(
    /unknown or incomplete activation journal/,
  );
  await rm(path.join(f.store, "transactions/partial.tmp"));
  await journal(f, { status: "reconciling", previousReleaseId: "missing" });
  await expect(f.inspect()).rejects.toThrow(/recoverable release is missing/);
  expect(f.calls).toHaveLength(0);
});

it("refuses unknown release contents, edited serving configuration and a separate recovery guard", async () => {
  const f = await fixture();
  await writeFile(
    path.join(f.store, "releases/r1/private.txt"),
    "not generated",
  );
  await expect(f.inspect()).rejects.toThrow(
    /unexpected retained release contents/,
  );
  await rm(path.join(f.store, "releases/r1/private.txt"));
  const active = await readFile(path.join(f.store, "active.conf"));
  await writeFile(
    path.join(f.store, "active.conf"),
    Buffer.concat([active, Buffer.from("# manually edited\n")]),
  );
  await expect(f.inspect()).rejects.toThrow(/edited outside/);
  await writeFile(path.join(f.store, "active.conf"), active);
  await mkdir(path.join(f.store, ".activation-lock.recovery"));
  await expect(f.inspect()).rejects.toThrow(/recovery is unfinished/);
  expect(f.calls).toHaveLength(0);
});

it("preserves linked files and outside data, and rejects world-writable release paths", async () => {
  const f = await fixture(),
    outside = path.join(f.root, "private.txt"),
    target = path.join(f.store, "releases/r1/release.json");
  const original = await readFile(target);
  await writeFile(outside, original);
  await rm(target);
  await symlink(outside, target);
  await expect(f.inspect()).rejects.toThrow(/linked, mounted, foreign/);
  await rm(target);
  await link(outside, target);
  await expect(f.inspect()).rejects.toThrow(/linked, mounted, foreign/);
  await rm(target);
  await writeFile(target, original);
  await chmod(target, 0o666);
  await expect(f.inspect()).rejects.toThrow(/linked, mounted, foreign/);
  expect(await readFile(outside)).toEqual(original);
  expect(f.calls).toHaveLength(0);
});

it("bounds malformed metadata without allocating its advertised size or reading unknown private journal content", async () => {
  const f = await fixture(),
    file = path.join(f.store, "releases/r1/release.json");
  await truncate(file, 64 * 1024 ** 2 + 1);
  await expect(f.inspect()).rejects.toThrow(/metadata exceeds/);
  expect(f.calls).toHaveLength(0);
});

it("rejects a stale provider identity and changed files after an observation reply", async () => {
  const f = await fixture(),
    original = f.options.connection.rpc.bind(f.options.connection);
  f.options.connection.rpc = async (name, input) => ({
    ...(await original(name, input)),
    store_fingerprint: "f".repeat(64),
  });
  await expect(f.inspect()).rejects.toThrow(/retirement identity differs/);
  f.options.connection.rpc = async (name, input) => {
    const response = await original(name, input);
    await writeFile(
      path.join(f.store, "releases/r1/site/index.html"),
      "Changed after inventory",
    );
    return response;
  };
  await expect(f.inspect()).rejects.toThrow(/changed during inspection/);
  expect((await readdir(path.join(f.store, "releases"))).length).toBe(8);
});

it("routes previously claimed receipts to recovery and refuses reappeared completed artifacts", async () => {
  const f = await fixture();
  await f.inspect();
  f.receipts.get("r1").phase = "removing";
  f.receipts.get("r1").owner_token = randomUUID();
  const result = await f.inspect();
  expect(ids(result.recovery)).toEqual(["r1"]);
  expect(ids(result.candidates)).toEqual(["r2"]);
  f.receipts.get("r1").phase = "removed";
  await expect(f.inspect()).rejects.toThrow(/already retired/);
});

it("validates retention limits and hashes only the observed ordinary file", async () => {
  expect(releaseRetentionPolicy({})).toEqual({
    keepCount: 5,
    minAgeDays: 30,
    visitorGraceDays: 7,
  });
  for (const value of ["0", "1", "-1", "1.5", "1001"])
    expect(() =>
      releaseRetentionPolicy({ BUILDER_RELEASE_KEEP_COUNT: value }),
    ).toThrow(/retention limits/);
  const f = await fixture(),
    file = path.join(f.root, "hash.txt");
  await writeFile(file, "observed");
  const info = await lstat(file);
  expect(await hashReleaseFile(file, info)).toBe(
    createHash("sha256").update("observed").digest("hex"),
  );
  await writeFile(file, "changed after observation");
  await expect(hashReleaseFile(file, info)).rejects.toThrow(
    /changed before hashing/,
  );
});

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}
it.runIf(Boolean(process.env.KAIZEN_NGINX_BINARY))(
  "requires actual Nginx serving evidence and leaves activation and rollback usable after inventory",
  async () => {
    const f = await fixture(),
      port = await freePort(),
      origin = `http://127.0.0.1:${port}`;
    const binary = process.env.KAIZEN_NGINX_BINARY!,
      run = promisify(execFile),
      configuration = path.join(f.root, "nginx.conf");
    await mkdir(path.join(f.root, "logs"));
    await mkdir(path.join(f.root, "temp"));
    await writeFile(
      configuration,
      `daemon off; master_process on; worker_processes 1; pid logs/nginx.pid; error_log logs/error.log; events {worker_connections 128;} http {access_log off; keepalive_timeout 0; client_body_temp_path temp/body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server {listen 127.0.0.1:${port}; include "${f.store}/active.conf";}}`,
    );
    await run(binary, ["-p", f.root + "/", "-c", configuration, "-t"]);
    const child = spawn(binary, ["-p", f.root + "/", "-c", configuration], {
      stdio: "ignore",
    });
    children.push(child);
    await expect
      .poll(async () => (await fetch(origin).catch(() => null))?.status)
      .toBe(200);
    const result = await f.inspect({ checkLive }, { origin });
    expect(ids(result.candidates)).toEqual(["r1", "r2"]);
    // The include alone can change while a running Nginx worker still serves the
    // prior config. A byte/identity check must reject that selection before RPC.
    await writeFile(
      path.join(f.store, "active.conf"),
      nginxConfig(f.store, "r6"),
    );
    f.calls.length = 0;
    await expect(f.inspect({ checkLive }, { origin })).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
    await writeFile(
      path.join(f.store, "active.conf"),
      nginxConfig(f.store, "r7"),
    );
    await activateRelease(
      { store: f.store, id: "r0", origin },
      {
        validateConfig: async () => {
          await run(binary, ["-p", f.root + "/", "-c", configuration, "-t"]);
        },
        reload: async () => {
          child.kill("SIGHUP");
        },
      },
    );
    await checkLive(origin, await verifyRelease(f.store, "r0"));
    expect((await readdir(path.join(f.store, "releases"))).length).toBe(8);
  },
  30000,
);

it("keeps capture and durable store binding inside one activation lock and expires the session", async () => {
  const f = await fixture();
  let retainedSession: any;
  await withReleaseRetentionStore(
    f.options,
    async (session) => {
      retainedSession = session;
      const plan = await session.inspect();
      const candidate = plan.candidates[0];
      const state = new ReleaseRetirementState(f.store);
      await state.bind(session);
      const entries = await session.capture(candidate);
      expect(
        entries.reduce((bytes, entry) => bytes + entry.identity.size, 0),
      ).toBe(candidate.bytes);
      expect(entries.find((entry) => entry.path === "")?.identity).toEqual(
        candidate.identity,
      );
      await expect(
        stageRelease({ store: f.store, source: f.source, id: "r9" }),
      ).rejects.toThrow(/owns the lock/);
      await session.assertUnchanged();
    },
    { now: () => f.now, checkLive: quiet.checkLive },
  );
  await expect(retainedSession.inspect()).rejects.toThrow(/lock has ended/);
  await expect(retainedSession.capture({ artifactId: "r1" })).rejects.toThrow(
    /lock has ended/,
  );
  await f.inspect();
  const calls = f.calls.length;
  await expect(f.inspect({}, { scope: "repository:staging" })).rejects.toThrow(
    /persistent retirement binding/,
  );
  expect(f.calls).toHaveLength(calls);
});

it("refuses altered candidates and files changed between inspection and the durable snapshot", async () => {
  const f = await fixture();
  await withReleaseRetentionStore(
    f.options,
    async (session) => {
      const plan = await session.inspect();
      const candidate = plan.candidates[0];
      await expect(session.capture({ ...candidate })).rejects.toThrow(
        /not from this locked inspection/,
      );
      const original = candidate.artifactId;
      candidate.artifactId = "r7";
      await expect(session.capture(candidate)).rejects.toThrow(
        /not from this locked inspection/,
      );
      candidate.artifactId = original;
      await writeFile(
        path.join(f.store, "releases", original, "site/index.html"),
        "Changed after inspection",
      );
      await expect(session.capture(candidate)).rejects.toThrow(
        /changed after inspection/,
      );
    },
    { now: () => f.now, checkLive: quiet.checkLive },
  );
});

it("refuses a mismatched client assignment before a held-lock callback can write permanent metadata", async () => {
  const f = await fixture(true);
  let called = false;
  await expect(
    withReleaseRetentionStore(
      { ...f.options, projectId: randomUUID() },
      async (session) => {
        called = true;
        await new ReleaseRetirementState(f.store).bind(session);
      },
      { now: () => f.now, checkLive: quiet.checkLive },
    ),
  ).rejects.toThrow(/configured destination/);
  expect(called).toBe(false);
  await expect(lstat(path.join(f.store, ".retirement"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

async function reclaim(f: Awaited<ReturnType<typeof fixture>>, now: number) {
  return withReleaseRetentionStore(
    f.options,
    async (session: any) => {
      await new ReleaseRetirementState(f.store).bind(session);
      return session.reclaimGenerated();
    },
    { now: () => now, checkLive: quiet.checkLive },
  );
}

it("reclaims abandoned staging, unpublished records, orphaned journals and old unreferenced immutable files only", async () => {
  const f = await fixture(true),
    actual = Date.now();
  const staging = `.staging-r9-${randomUUID()}`;
  await mkdir(path.join(f.store, staging, "site/nested"), { recursive: true });
  await writeFile(path.join(f.store, staging, "site/nested/partial.html"), "x");
  await writeFile(path.join(f.store, "private-operator-file"), "canary");
  await mkdir(path.join(f.store, ".retirement"), { mode: 0o700 });
  const finishedJournal = async (days: number, releaseId: string) => {
    const id = randomUUID(),
      at = new Date(actual - days * day).toISOString();
    await writeFile(
      path.join(f.store, "transactions", `${id}.json`),
      JSON.stringify({
        schemaVersion: 1,
        id,
        releaseId,
        startedAt: at,
        updatedAt: at,
        status: "live",
      }),
    );
    return id;
  };
  // Both journals name releases that no longer exist; only age separates them.
  const old = await finishedJournal(60, "gone-1"),
    recent = await finishedJournal(10, "gone-2");
  const journalFile = (id: string) =>
    path.join(f.store, "transactions", `${id}.json`);
  const immutable = path.join(f.store, "immutable");
  await writeFile(path.join(immutable, "_astro/orphan.js"), "old chunk");
  await writeFile(
    path.join(immutable, `_astro/shared.js.${randomUUID()}.tmp`),
    "partial copy",
  );
  await writeFile(path.join(immutable, "assets/orphan.svg"), "<svg/>");
  await mkdir(path.join(immutable, "operator"));
  await writeFile(path.join(immutable, "operator/unknown.txt"), "unknown");
  const shared = await readFile(
    path.join(immutable, "_astro/shared.js"),
    "utf8",
  );

  // The actual clock: staging and the old orphaned journal are abandoned now,
  // but new unreferenced visitor assets and the recent journal are in grace.
  expect(await reclaim(f, actual)).toMatchObject({
    staging: 1,
    journals: 1,
    immutable: 0,
  });
  await writeFile(
    path.join(f.store, ".retirement", `.write-${randomUUID()}.tmp`),
    "{}",
    { mode: 0o600 },
  );
  expect(await reclaim(f, actual)).toMatchObject({ records: 1, immutable: 0 });
  await expect(lstat(path.join(f.store, staging))).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(lstat(journalFile(old))).rejects.toMatchObject({
    code: "ENOENT",
  });
  await lstat(journalFile(recent));
  await lstat(path.join(immutable, "_astro/orphan.js"));

  expect(await reclaim(f, f.now)).toMatchObject({ immutable: 3, journals: 1 });
  for (const name of ["_astro/orphan.js", "assets/orphan.svg"])
    await expect(lstat(path.join(immutable, name))).rejects.toMatchObject({
      code: "ENOENT",
    });
  await expect(lstat(journalFile(recent))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(
    (await readdir(path.join(immutable, "_astro"))).some((name) =>
      name.endsWith(".tmp"),
    ),
  ).toBe(false);
  expect(await readFile(path.join(immutable, "_astro/shared.js"), "utf8")).toBe(
    shared,
  );
  expect(
    await readFile(path.join(immutable, "assets/shared.svg"), "utf8"),
  ).toContain("svg");
  expect(
    await readFile(path.join(immutable, "operator/unknown.txt"), "utf8"),
  ).toBe("unknown");
  expect(
    await readFile(path.join(f.store, "private-operator-file"), "utf8"),
  ).toBe("canary");
  expect((await readdir(path.join(f.store, "releases"))).length).toBe(8);
  await verifyRelease(f.store, "r7");
  await activateRelease(
    { store: f.store, id: "r0", origin: f.client!.origin },
    quiet,
  );
  expect(await reclaim(f, f.now)).toMatchObject({ removedEntries: 0 });
});

it("refuses to reclaim a linked or changed generated path and preserves every byte", async () => {
  const f = await fixture();
  const staging = `.staging-r9-${randomUUID()}`;
  await mkdir(path.join(f.store, staging));
  await writeFile(path.join(f.root, "outside.txt"), "outside");
  await link(
    path.join(f.root, "outside.txt"),
    path.join(f.store, staging, "linked"),
  );
  await mkdir(path.join(f.store, ".retirement"), { mode: 0o700 });
  await expect(reclaim(f, f.now)).rejects.toThrow(/linked/);
  expect(await readFile(path.join(f.store, staging, "linked"), "utf8")).toBe(
    "outside",
  );
  expect(await readFile(path.join(f.root, "outside.txt"), "utf8")).toBe(
    "outside",
  );
});

it("finishes an interrupted generated-state removal on the next locked run", async () => {
  const f = await fixture();
  const staging = `.staging-r9-${randomUUID()}`;
  await mkdir(path.join(f.store, staging, "site"), { recursive: true });
  for (const name of ["a.html", "b.html", "c.html"])
    await writeFile(path.join(f.store, staging, "site", name), name);
  await mkdir(path.join(f.store, ".retirement"), { mode: 0o700 });
  let removed = 0;
  await expect(
    withReleaseRetentionStore(
      f.options,
      async (session: any) => {
        await new ReleaseRetirementState(f.store).bind(session);
        return session.reclaimGenerated({
          afterRemove: async () => {
            if (++removed === 2) throw new Error("service stopped");
          },
        });
      },
      { now: () => f.now, checkLive: quiet.checkLive },
    ),
  ).rejects.toThrow("service stopped");
  expect((await readdir(path.join(f.store, staging, "site"))).length).toBe(1);
  expect(await reclaim(f, f.now)).toMatchObject({ staging: 1 });
  await expect(lstat(path.join(f.store, staging))).rejects.toMatchObject({
    code: "ENOENT",
  });
  await lstat(path.join(f.store, ".activation-lock")).then(
    () => {
      throw new Error("The store lock was left behind.");
    },
    (error) => expect(error.code).toBe("ENOENT"),
  );
});
