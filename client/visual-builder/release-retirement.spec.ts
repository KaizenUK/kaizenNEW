import { afterEach, expect, it } from "vitest";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { retireRelease } from "../../scripts/builder-release-retention";
import {
  nativeReleaseAction,
  runNativeReleaseTask,
} from "../../scripts/builder-native-release";
import { maintainNativeReleases } from "../../scripts/builder-native-release-maintenance";
import {
  NativeFileProtection,
  NativeOperationJournal,
} from "../../scripts/builder-native-operations";
import { ReleaseRetirementState } from "../../scripts/release-retirement-state.mjs";
import {
  activateRelease,
  checkLive,
  initialiseStore,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

async function workerFixture() {
  const f = await fixture();
  f.options.workerId = "native-fixture";
  const nativeRows = new Map<string, any>();
  const events: string[] = [];
  const env = {
    KAIZEN_APP_DIR: f.source,
    KAIZEN_RELEASE_STORE: f.store,
    KAIZEN_PUBLIC_DOMAIN: "fixture.example.test",
    KAIZEN_DEPLOY_BRANCH: "main",
    BUILDER_RELEASE_PROJECT_ID: "kaizen",
    BUILDER_NATIVE_WORKER_ID: "native-fixture",
    BUILDER_NATIVE_CONFIGURATION: "a".repeat(64),
    BUILDER_NATIVE_STATE_DIRECTORY: path.join(f.root, "worker"),
    BUILDER_RELEASE_RETENTION_ENABLED: "1",
    BUILDER_RELEASE_KEEP_COUNT: "2",
  };
  const run = (
    action: "maintain" | "deploy" | "reconcile" = "maintain",
    extra: any = {},
  ) => {
    const journal = new NativeOperationJournal({
      directory: path.join(f.root, "worker/operations"),
      workerId: "native-fixture",
      configuration: "a".repeat(64),
      controller: f.options.controller,
      connection: {
        async nativeOperation(_token, input) {
          if (input.action === "native-operation-assets")
            return { id: input.id, assets: [], cursor: null };
          const { action: operationAction, ...identity } = input;
          const phase =
            operationAction === "native-operation-begin"
              ? "active"
              : "complete";
          nativeRows.set(input.id, { ...identity, phase });
          events.push(phase);
          return { ...identity, phase };
        },
      },
    });
    return runNativeReleaseTask(
      {
        environment: env,
        action,
        root: f.source,
        native: journal,
        controller: f.options.controller,
        client: f.options.connection,
        command: { manager: "pnpm", cli: "/fixture/pnpm.cjs" },
        signal: new AbortController().signal,
        log: () => {},
        preflight: async () => {
          events.push("preflight");
        },
        build: async () => {
          throw Error("Maintenance must not build");
        },
      },
      {
        recoverCheckout: async () => {
          events.push("checkout-recovery");
          return null;
        },
        prepareCheckout: async () => {
          events.push("prepare");
          return {} as any;
        },
        release: async () => {
          events.push("release");
        },
        maintenance: { ...quiet, now: () => f.now },
        ...extra,
      },
    );
  };
  return { ...f, env, runWorker: run, nativeRows, events };
}

it("runs idle native maintenance without preparing or building another publication", async () => {
  const f = await workerFixture();
  expect(await f.runWorker()).toMatchObject({
    phase: "removed",
    artifactId: "r1",
  });
  expect(f.events).toEqual([
    "active",
    "preflight",
    "checkout-recovery",
    "complete",
  ]);
  expect(
    [...f.nativeRows.values()].every((item) => item.phase === "complete"),
  ).toBe(true);
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(f.active);
  expect(await f.runWorker()).toEqual({ phase: "idle" });
  expect(await readdir(path.join(f.root, "worker/operations"))).toEqual([]);
});

it("retires before native preparation under the same live operation", async () => {
  const f = await workerFixture();
  await f.runWorker("deploy", {
    prepareCheckout: async () => {
      expect(f.rows.get("r1").phase).toBe("removed");
      expect(
        [...f.nativeRows.values()].filter((item) => item.phase === "active"),
      ).toHaveLength(1);
      f.events.push("prepare");
    },
  });
  expect(f.events).toEqual([
    "active",
    "preflight",
    "checkout-recovery",
    "prepare",
    "release",
    "complete",
  ]);
});

it("recovers a lost finish response through the worker even when new cleanup is disabled", async () => {
  const f = await workerFixture();
  let lost = false;
  f.hook(async (action, _input, normal) => {
    const result = await normal();
    if (action === "finish" && !lost) {
      lost = true;
      throw Error("Lost finish reply");
    }
    return result;
  });
  await expect(f.runWorker()).rejects.toThrow();
  expect(f.rows.get("r1").phase).toBe("removed");
  expect(
    [...f.nativeRows.values()].some((item) => item.phase === "active"),
  ).toBe(true);
  f.restart();
  f.env.BUILDER_RELEASE_RETENTION_ENABLED = "0";
  expect(await f.runWorker()).toMatchObject({
    phase: "removed",
    recovered: true,
  });
  expect(
    [...f.nativeRows.values()].every((item) => item.phase === "complete"),
  ).toBe(true);
  expect(await f.runWorker()).toEqual({ phase: "disabled" });
  expect(f.events).not.toContain("prepare");
  expect(f.events).not.toContain("release");
});

it("refuses maintenance before preflight when previous native descendants are unproven", async () => {
  const f = await workerFixture();
  await expect(
    f.runWorker("maintain", {
      maintenance: {
        ...quiet,
        now: () => f.now,
        afterRemove: async () => {
          throw Error("interrupted");
        },
      },
    }),
  ).rejects.toThrow();
  const calls = f.calls.length;
  f.events.length = 0;
  f.restart(false);
  await expect(f.runWorker()).rejects.toThrow(/not proven stopped/);
  expect(f.events).toEqual([]);
  expect(f.calls).toHaveLength(calls);
});

it("preserves a foreign activation lock instead of clearing it for retirement", async () => {
  const f = await workerFixture();
  await expect(
    f.runWorker("maintain", {
      maintenance: {
        ...quiet,
        now: () => f.now,
        afterRemove: async () => {
          throw Error("interrupted");
        },
      },
    }),
  ).rejects.toThrow();
  const lock = path.join(f.store, ".activation-lock");
  await mkdir(lock);
  const owner = JSON.stringify({ pid: process.pid + 1, host: os.hostname() });
  await writeFile(path.join(lock, "owner.json"), owner);
  f.restart();
  await expect(f.runWorker()).rejects.toThrow();
  expect(await readFile(path.join(lock, "owner.json"), "utf8")).toBe(owner);
  expect(f.rows.get("r1").phase).toBe("removing");
});

it("completes explicit publication recovery before starting new retirement", async () => {
  const f = await workerFixture();
  await f.runWorker("reconcile", {
    release: async () => {
      expect(f.calls).toEqual([]);
      f.events.push("publication-recovered");
    },
  });
  expect(f.rows.get("r1").phase).toBe("removed");
  expect(f.events).toEqual([
    "active",
    "preflight",
    "checkout-recovery",
    "publication-recovered",
    "complete",
  ]);
});

it("peeks exact metadata publication pairs without mutating before lock recovery", async () => {
  const f = await workerFixture();
  f.hook(async (action, _input, normal) => {
    if (action === "claim") throw Error("lost claim before execution");
    return normal();
  });
  await expect(f.runWorker()).rejects.toThrow();
  const pairs: string[] = [];
  for (const name of ["binding.json", "attempt.json"]) {
    const sibling = path.join(
      f.store,
      ".retirement",
      ".write-" + randomUUID() + ".tmp",
    );
    await link(path.join(f.store, ".retirement", name), sibling);
    pairs.push(sibling);
  }
  const state = new ReleaseRetirementState(f.store);
  expect((await state.peek())?.attempt.artifactId).toBe("r1");
  for (const sibling of pairs) expect((await lstat(sibling)).nlink).toBe(2);
  f.hook(undefined);
  f.restart();
  expect(await f.runWorker()).toMatchObject({
    phase: "abandoned",
    artifactId: "r1",
  });
  for (const sibling of pairs)
    await expect(lstat(sibling)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await verifyRelease(f.store, "r1")).id).toBe("r1");
});

it("keeps disabled maintenance read-only and rejects mismatched worker configuration", async () => {
  const f = await workerFixture();
  f.env.BUILDER_RELEASE_RETENTION_ENABLED = "0";
  expect(await f.runWorker()).toEqual({ phase: "disabled" });
  expect(f.calls).toEqual([]);
  await expect(lstat(path.join(f.store, ".retirement"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(
    maintainNativeReleases({
      environment: { ...f.env, BUILDER_NATIVE_CONFIGURATION: "b".repeat(64) },
      nativeFiles: f.options.nativeFiles,
      controller: f.options.controller,
      connection: f.options.connection,
    }),
  ).rejects.toThrow(/configured native worker/);
  expect(nativeReleaseAction(["--maintain"])).toBe("maintain");
  expect(() => nativeReleaseAction(["--maintain", "--deploy"])).toThrow();
});

const roots: string[] = [];
const children: ChildProcess[] = [];
const day = 86400000;
const quiet = {
  validateConfig: async () => {},
  reload: async () => {},
  checkLive: async () => {},
};
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill("SIGTERM");
      await closed;
    }
  }
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "kaizen-retirement-coordinator-"),
  );
  roots.push(root);
  const store = path.join(root, "store"),
    source = path.join(root, "source"),
    now = Date.now() + 120 * day;
  await mkdir(path.join(source, "builder"), { recursive: true });
  await mkdir(path.join(source, "_astro"));
  await writeFile(
    path.join(source, "_astro/shared.js"),
    "console.log('retain shared visitor bytes');",
  );
  for (let n = 0; n < 4; n++) {
    await writeFile(path.join(source, "index.html"), `<h1>r${n}</h1>`);
    await writeFile(
      path.join(source, "builder/index.html"),
      `<h1>Builder r${n}</h1>`,
    );
    await stageRelease({ source, store, id: `r${n}` });
  }
  await initialiseStore({ store, id: "r0" });
  await activateRelease({ store, id: "r3", origin: "http://127.0.0.1" }, quiet);
  const active = await readFile(path.join(store, "active.conf"));
  const rows = new Map<string, any>(),
    calls: any[] = [];
  let hook:
    | ((action: string, input: any, normal: () => Promise<any>) => Promise<any>)
    | undefined;
  const connection = {
    async rpc(name: string, input: any) {
      const action = name.replace("builder_release_retention_", "");
      calls.push({ action, input: { ...input } });
      const normal = async () => {
        let row = rows.get(input.artifact);
        if (action === "observe") {
          if (!row) {
            row = {
              project_id: input.target,
              scope: input.release_scope,
              artifact_id: input.artifact,
              worker_id: input.worker,
              store_fingerprint: input.fingerprint,
              manifest_sha256: input.manifest,
              bytes: input.stored_bytes,
              phase: "pending",
              owner_token: null,
              attempt_generation: 0,
              eligible_at: new Date(now - day).toISOString(),
            };
            rows.set(input.artifact, row);
          }
        } else {
          if (!row) throw new Error("missing observation");
          if (action === "cancel" && row.attempt_generation > input.generation)
            return {
              ...row,
              phase: "cancelled",
              cancelled_token: input.token,
              cancelled_generation: input.generation,
            };
          if (row.attempt_generation !== input.generation)
            throw new Error("attempt cancelled");
          if (row.owner_token && row.owner_token !== input.token)
            throw new Error("different owner");
          if (action === "cancel" && !row.owner_token) {
            row.attempt_generation++;
            return {
              ...row,
              phase: "cancelled",
              cancelled_token: input.token,
              cancelled_generation: input.generation,
            };
          }
          if (
            action === "claim" &&
            !row.owner_token &&
            Date.parse(row.eligible_at) <= now
          ) {
            row.phase = "removing";
            row.owner_token = input.token;
          }
          if (action === "finish") {
            expect(input.proof).toEqual({
              artifactId: input.artifact,
              storeFingerprint: input.fingerprint,
              manifestSha256: input.manifest,
              artifactAbsent: true,
            });
            await expect(
              lstat(path.join(store, "releases", input.artifact)),
            ).rejects.toMatchObject({ code: "ENOENT" });
            row.phase = "removed";
          }
        }
        return { ...row };
      };
      return hook ? hook(action, input, normal) : normal();
    },
  };
  const options: any = {
    store,
    origin: "http://127.0.0.1",
    projectId: "kaizen",
    scope: "repository:production",
    workerId: "retirement-fixture",
    connection,
    retention: { keepCount: 2, minAgeDays: 30, visitorGraceDays: 7 },
  };
  const restart = (stopped = true) => {
    const controller = {
      identity: {
        kind: "systemd" as const,
        unit: "kaizen-retirement-fixture.service",
        invocationId: randomUUID().replace(/-/g, ""),
      },
      stopped: async () => stopped,
    };
    const operation = {
      id: randomUUID(),
      workerId: "native-fixture",
      configuration: "a".repeat(64),
      projectId: "kaizen",
      processId: process.pid,
      host: os.hostname(),
      instanceId: randomUUID(),
    };
    options.nativeFiles = new NativeFileProtection(
      [],
      operation,
      controller.identity,
    );
    options.controller = controller;
  };
  restart();
  const run = (extra: any = {}) =>
    retireRelease(options, {
      now: () => now,
      checkLive: quiet.checkLive,
      ...extra,
    });
  const saved = async () => {
    const state = new ReleaseRetirementState(store);
    await state.loadBinding();
    return state.attempt();
  };
  return {
    root,
    store,
    source,
    now,
    options,
    rows,
    calls,
    active,
    run,
    restart,
    saved,
    hook: (value: typeof hook) => {
      hook = value;
    },
  };
}

it("claims and removes only an eligible owned release, preserving live, rollback and immutable files", async () => {
  const f = await fixture();
  expect(await f.run()).toMatchObject({
    phase: "removed",
    artifactId: "r1",
    recovered: false,
  });
  expect(await readdir(path.join(f.store, "releases"))).toEqual([
    "r0",
    "r2",
    "r3",
  ]);
  expect(await readFile(path.join(f.store, "active.conf"))).toEqual(f.active);
  expect(await f.saved()).toBeNull();
  expect(f.rows.get("r1").phase).toBe("removed");
  expect(
    await readFile(path.join(f.store, "immutable/_astro/shared.js"), "utf8"),
  ).toContain("visitor bytes");
  await expect(
    stageRelease({ store: f.store, source: f.source, id: "r1" }),
  ).rejects.toThrow(/retired/);
  expect(await f.run()).toEqual({ phase: "idle" });
  await activateRelease(
    { store: f.store, id: "r0", origin: f.options.origin },
    quiet,
  );
  expect((await verifyRelease(f.store, "r0")).id).toBe("r0");
});

it("waits for authoritative grace without allocating an attempt or claiming", async () => {
  const f = await fixture();
  f.hook(async (action, input, normal) => {
    const result = await normal();
    if (action === "observe")
      result.eligible_at = new Date(f.now + day).toISOString();
    return result;
  });
  expect(await f.run()).toEqual({ phase: "waiting" });
  expect(await f.saved()).toBeNull();
  expect(f.calls.map((call) => call.action)).toEqual(["observe"]);
});

it("cancels a newly protected pending attempt and can later use a new generation", async () => {
  const f = await fixture();
  f.hook(async (action, input, normal) => {
    if (action === "claim")
      f.rows.get(input.artifact).eligible_at = new Date(
        f.now + day,
      ).toISOString();
    return normal();
  });
  expect(await f.run()).toMatchObject({ phase: "abandoned", artifactId: "r1" });
  expect(await f.saved()).toBeNull();
  expect(f.rows.get("r1").attempt_generation).toBe(1);
  expect(await readdir(path.join(f.store, "releases"))).toHaveLength(4);
  f.hook(undefined);
  f.rows.get("r1").eligible_at = new Date(f.now - day).toISOString();
  expect(await f.run()).toMatchObject({ phase: "removed" });
  expect(f.rows.get("r1").attempt_generation).toBe(1);
});

it.each(["claim", "finish"])(
  "recovers a lost %s response with the exact saved token and actual remaining files",
  async (boundary) => {
    const f = await fixture();
    let once = true;
    f.hook(async (action, _input, normal) => {
      const result = await normal();
      if (action === boundary && once) {
        once = false;
        throw new Error("fixture lost response");
      }
      return result;
    });
    await expect(f.run()).rejects.toThrow(/lost response/);
    expect(f.options.nativeFiles.recoveryRequired).toBe(true);
    const pending = await f.saved();
    f.restart();
    f.hook(undefined);
    expect(await f.run()).toMatchObject({
      phase: "removed",
      artifactId: "r1",
      recovered: true,
    });
    expect(f.rows.get("r1").owner_token).toBe(pending.token);
    expect(await f.saved()).toBeNull();
  },
);

it("recovers lost cancellation without permitting its delayed old claim", async () => {
  const f = await fixture();
  let once = true;
  f.hook(async (action, input, normal) => {
    if (action === "claim")
      f.rows.get(input.artifact).eligible_at = new Date(
        f.now + day,
      ).toISOString();
    const result = await normal();
    if (action === "cancel" && once) {
      once = false;
      throw new Error("lost cancellation");
    }
    return result;
  });
  await expect(f.run()).rejects.toThrow(/lost cancellation/);
  const pending = await f.saved();
  f.restart();
  f.hook(undefined);
  expect(await f.run()).toMatchObject({ phase: "abandoned" });
  expect(f.rows.get("r1").attempt_generation).toBeGreaterThan(
    pending.generation,
  );
  expect(await readdir(path.join(f.store, "releases"))).toHaveLength(4);
});

it("resumes partial removal without needing the missing target manifest", async () => {
  const f = await fixture();
  await expect(
    f.run({
      afterRemove: async (relative: string) => {
        if (relative === "release.json")
          throw new Error("interrupted after manifest removal");
      },
    }),
  ).rejects.toThrow(/interrupted/);
  await expect(
    lstat(path.join(f.store, "releases/r1/release.json")),
  ).rejects.toMatchObject({ code: "ENOENT" });
  const attempt = await f.saved();
  expect(f.rows.get("r1").phase).toBe("removing");
  f.restart();
  expect(await f.run()).toMatchObject({ phase: "removed", recovered: true });
  expect(f.rows.get("r1").owner_token).toBe(attempt.token);
});

it("requires stopped-work proof before resuming and preserves the original owner record", async () => {
  const f = await fixture();
  await expect(
    f.run({
      afterRemove: async () => {
        throw new Error("interrupted");
      },
    }),
  ).rejects.toThrow(/interrupted/);
  const pending = await f.saved(),
    calls = f.calls.length;
  f.restart(false);
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(f.calls).toHaveLength(calls);
  expect(await f.saved()).toEqual(pending);
  f.restart(true);
  expect(await f.run()).toMatchObject({ phase: "removed" });
});

it.each(["unknown", "symlink", "hardlink"])(
  "preserves %s files introduced during an interrupted retirement",
  async (kind) => {
    const f = await fixture();
    await expect(
      f.run({
        afterRemove: async () => {
          throw new Error("interrupted");
        },
      }),
    ).rejects.toThrow(/interrupted/);
    const outside = path.join(f.root, "outside");
    await writeFile(outside, "preserve outside bytes");
    const extra = path.join(f.store, "releases/r1/new-entry");
    if (kind === "symlink") await symlink(outside, extra);
    else if (kind === "hardlink") await link(outside, extra);
    else await writeFile(extra, "unknown retained file");
    f.restart();
    await expect(f.run()).rejects.toThrow(/changed or remain protected/);
    expect(await readFile(outside, "utf8")).toBe("preserve outside bytes");
    expect(await lstat(extra)).toBeDefined();
    expect(f.rows.get("r1").phase).toBe("removing");
  },
);

it("rechecks actual serving and recovery controls after a claim, refusing a newly selected target", async () => {
  const f = await fixture();
  const original = f.active.toString();
  f.hook(async (action, _input, normal) => {
    const result = await normal();
    if (action === "claim")
      await writeFile(
        path.join(f.store, "active.conf"),
        original.replace(/r3/g, "r1"),
      );
    return result;
  });
  await expect(f.run()).rejects.toThrow(/protected/);
  expect(await readdir(path.join(f.store, "releases"))).toHaveLength(4);
  expect(f.rows.get("r1").phase).toBe("removing");
});

it("keeps the native operation journal active across uncertain removal", async () => {
  const f = await fixture(),
    events: string[] = [];
  const native = new NativeOperationJournal({
    directory: path.join(f.root, "native-operations"),
    workerId: "native-fixture",
    configuration: "a".repeat(64),
    controller: f.options.controller,
    connection: {
      nativeOperation: async (_token, input) => {
        events.push(input.action);
        if (input.action === "native-operation-assets")
          return { id: input.id, assets: [], cursor: null };
        const { action, ...identity } = input;
        return {
          ...identity,
          phase: action === "native-operation-begin" ? "active" : "complete",
        };
      },
    },
  });
  await expect(
    native.run("", "kaizen", async (files) => {
      f.options.nativeFiles = files;
      return f.run({
        afterRemove: async () => {
          throw new Error("interrupted");
        },
      });
    }),
  ).rejects.toThrow(/needs reconciliation/);
  expect(events).not.toContain("native-operation-end");
  expect(await readdir(path.join(f.root, "native-operations"))).toHaveLength(1);
});

it("records each recovery executor before further removal and refuses reuse of uncertain native protection", async () => {
  const f = await fixture();
  const interrupt = {
    afterRemove: async () => {
      throw new Error("interrupted again");
    },
  };
  await expect(f.run(interrupt)).rejects.toThrow(/interrupted/);
  const first = await f.saved();
  const calls = f.calls.length;
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(f.calls).toHaveLength(calls);
  f.restart();
  await expect(f.run(interrupt)).rejects.toThrow(/interrupted/);
  const second = await f.saved();
  expect(second.token).toBe(first.token);
  expect(second.owner.operation).toEqual(f.options.nativeFiles.operation);
  expect(second.owner.operation.id).not.toBe(first.owner.operation.id);
  f.restart(false);
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(await f.saved()).toEqual(second);
  f.restart();
  expect(await f.run()).toMatchObject({ phase: "removed", recovered: true });
});

it.runIf(Boolean(process.env.KAIZEN_NGINX_BINARY))(
  "keeps actual Nginx serving and rollback working through physical retirement",
  async () => {
    const f = await fixture(),
      binary = process.env.KAIZEN_NGINX_BINARY!;
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as any).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const config = path.join(f.root, "nginx.conf");
    await mkdir(path.join(f.root, "logs"));
    await mkdir(path.join(f.root, "temp"));
    await writeFile(
      config,
      `daemon off; master_process on; worker_processes 1; pid logs/nginx.pid; error_log logs/error.log; events {worker_connections 128;} http {access_log off; keepalive_timeout 0; client_body_temp_path temp/body; proxy_temp_path temp/proxy; fastcgi_temp_path temp/fastcgi; uwsgi_temp_path temp/uwsgi; scgi_temp_path temp/scgi; server {listen 127.0.0.1:${port}; include "${f.store}/active.conf";}}`,
    );
    const execute = promisify(execFile);
    await execute(binary, ["-p", f.root + "/", "-c", config, "-t"]);
    const child = spawn(binary, ["-p", f.root + "/", "-c", config], {
      stdio: "ignore",
    });
    children.push(child);
    f.options.origin = `http://127.0.0.1:${port}`;
    for (let n = 0; n < 100; n++) {
      try {
        await checkLive(f.options.origin, await verifyRelease(f.store, "r3"));
        break;
      } catch (error) {
        if (n === 99) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    expect(await f.run({ checkLive })).toMatchObject({
      phase: "removed",
      artifactId: "r1",
    });
    await checkLive(f.options.origin, await verifyRelease(f.store, "r3"));
    await activateRelease(
      { store: f.store, id: "r0", origin: f.options.origin },
      {
        validateConfig: async () => {
          await execute(binary, ["-p", f.root + "/", "-c", config, "-t"]);
        },
        reload: async () => {
          child.kill("SIGHUP");
        },
        checkLive,
      },
    );
    await checkLive(f.options.origin, await verifyRelease(f.store, "r0"));
  },
);

it("finishes an interrupted retirement after the release root is already absent", async () => {
  const f = await fixture();
  await expect(
    f.run({
      afterRemove: async (relative: string) => {
        if (relative === "") throw new Error("lost before finish");
      },
    }),
  ).rejects.toThrow(/lost before finish/);
  expect(f.rows.get("r1").phase).toBe("removing");
  await expect(lstat(path.join(f.store, "releases/r1"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  f.restart();
  expect(await f.run()).toMatchObject({ phase: "removed", recovered: true });
  expect(await f.saved()).toBeNull();
});

it("preserves all release files when a claim receipt has the wrong identity", async () => {
  const f = await fixture();
  f.hook(async (action, _input, normal) => {
    const result = await normal();
    return action === "claim"
      ? { ...result, owner_token: randomUUID() }
      : result;
  });
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(await readdir(path.join(f.store, "releases"))).toHaveLength(4);
  expect((await verifyRelease(f.store, "r1")).id).toBe("r1");
  expect(await f.saved()).not.toBeNull();
});

it("refuses a changed native producer configuration before resuming its saved attempt", async () => {
  const f = await fixture();
  await expect(
    f.run({
      afterRemove: async () => {
        throw new Error("interrupted");
      },
    }),
  ).rejects.toThrow(/interrupted/);
  const pending = await f.saved(),
    calls = f.calls.length;
  f.restart();
  f.options.nativeFiles = new NativeFileProtection(
    [],
    { ...f.options.nativeFiles.operation, configuration: "d".repeat(64) },
    f.options.controller.identity,
  );
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(f.calls).toHaveLength(calls);
  expect(await f.saved()).toEqual(pending);
});
