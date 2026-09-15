/** Actual systemd retirement recovery; RPCs are a private durable fixture.
 * Kill hold and recover-hold after ready.json, then run recover in the same unit. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { nativeServiceController } from "../../scripts/builder-native-controller";
import { runControlledBuild } from "../../scripts/builder-controlled-build";
import { runNativeReleaseTask } from "../../scripts/builder-native-release";
import { ReleaseRetirementState } from "../../scripts/release-retirement-state.mjs";
import {
  activateRelease,
  initialiseStore,
  stageRelease,
  verifyRelease,
} from "../../scripts/kaizen-releases.mjs";

const [mode, root] = process.argv.slice(2);
assert.ok(["hold", "recover-hold", "recover"].includes(mode));
assert.match(root, /^\/var\/lib\/kaizen-retirement-check-[a-f0-9]{12}\/work$/);
const controller = await nativeServiceController(),
  store = path.join(root, "store"),
  source = path.join(root, "source"),
  state = path.join(root, "state");
const now = Date.now() + 120 * 86400000;
const quiet = {
  validateConfig: async () => {},
  reload: async () => {},
  checkLive: async () => {},
};
const databaseFile = path.join(root, "database.json");
const database: any =
  mode === "hold"
    ? { native: {}, rows: {} }
    : JSON.parse(await readFile(databaseFile, "utf8"));
async function save() {
  const temp = databaseFile + ".tmp";
  const handle = await open(temp, "w", 0o600);
  try {
    await handle.writeFile(JSON.stringify(database));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, databaseFile);
  const directory = await open(root, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
if (mode === "hold") {
  await mkdir(path.join(source, "builder"), { recursive: true });
  await mkdir(path.join(source, "_astro"));
  await writeFile(
    path.join(source, "_astro/shared.js"),
    "retain visitor assets",
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
  execFileSync("/usr/bin/git", ["init", "--quiet", source]);
  await writeFile(
    path.join(root, "original-active.conf"),
    await readFile(path.join(store, "active.conf")),
  );
} else {
  const previous = JSON.parse(
    await readFile(path.join(root, "previous-ready.json"), "utf8"),
  );
  assert.notEqual(previous.invocationId, controller.identity.invocationId);
  assert.notEqual(previous.parentPid, process.pid);
  const processState = await readFile(
    `/proc/${previous.pid}/stat`,
    "utf8",
  ).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "";
  });
  assert.ok(
    !processState || /\) [ZX] /.test(processState),
    "Old detached descendant must be stopped",
  );
  const group = "/sys/fs/cgroup" + previous.cgroup.trim().split("::")[1];
  assert.match(group, /\/build-[a-f0-9-]{36}$/);
  await assert.rejects(readFile(path.join(group, "cgroup.events")), {
    code: "ENOENT",
  });
  const records = new ReleaseRetirementState(store);
  await records.loadBinding();
  const pending = await records.attempt();
  assert.equal(pending.owner.operation.processId, previous.parentPid);
  assert.equal(pending.owner.controller.invocationId, previous.invocationId);
  assert.equal(database.rows.r1.phase, "removing");
  await assert.rejects(lstat(path.join(store, "releases/r1/release.json")), {
    code: "ENOENT",
  });
}
const journal = new NativeOperationJournal({
  directory: path.join(state, "operations"),
  workerId: "retirement-native-fixture",
  configuration: "c".repeat(64),
  controller,
  connection: {
    async nativeOperation(_token, input) {
      const { action, afterKey, ...identity } = input;
      if (action === "native-operation-assets")
        return { id: input.id, assets: [], cursor: null };
      const old = database.native[input.id];
      if (old) assert.deepEqual(old.identity, identity);
      const phase = action === "native-operation-begin" ? "active" : "complete";
      database.native[input.id] = { identity, phase };
      await save();
      return { ...identity, phase };
    },
  },
});
const connection = {
  async rpc(name: string, input: any) {
    const action = name.replace("builder_release_retention_", "");
    let item = database.rows[input.artifact];
    if (action === "observe") {
      if (!item)
        item = database.rows[input.artifact] = {
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
          eligible_at: new Date(now - 86400000).toISOString(),
        };
    } else {
      assert.ok(item);
      assert.equal(item.attempt_generation, input.generation);
      assert.ok(!item.owner_token || item.owner_token === input.token);
      if (action === "claim") {
        item.phase = "removing";
        item.owner_token = input.token;
      } else if (action === "finish") {
        await assert.rejects(
          lstat(path.join(store, "releases", input.artifact)),
          { code: "ENOENT" },
        );
        item.phase = "removed";
      } else if (action === "cancel") assert.equal(item.phase, "removing");
      else throw Error("Unexpected retirement fixture RPC");
    }
    await save();
    return { ...item };
  },
};
const holdBuild = path.join(root, "hold-build");
await mkdir(holdBuild, { recursive: true });
await writeFile(
  path.join(holdBuild, "package.json"),
  JSON.stringify({ type: "module", scripts: { build: "node hold.mjs" } }),
);
await writeFile(
  path.join(holdBuild, "hold.mjs"),
  `
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['--input-type=module','-e',\`
 import {writeFileSync,readFileSync} from 'node:fs';
 writeFileSync(process.env.RETIREMENT_READY,JSON.stringify({pid:process.pid,parentPid:Number(process.env.RETIREMENT_PARENT),cgroup:readFileSync('/proc/self/cgroup','utf8'),invocationId:process.env.INVOCATION_ID}));
 setInterval(()=>{},20);
\`],{detached:true,stdio:'ignore'});
child.unref();setInterval(()=>{},20);
`,
);
let held = false;
const result = await runNativeReleaseTask(
  {
    environment: {
      ...process.env,
      KAIZEN_APP_DIR: source,
      KAIZEN_RELEASE_STORE: store,
      KAIZEN_PUBLIC_DOMAIN: "fixture.example.test",
      KAIZEN_DEPLOY_BRANCH: "main",
      KAIZEN_NATIVE_REPOSITORY: "https://fixture.example.test/repository.git",
      KAIZEN_DEPLOY_SHA: "",
      BUILDER_RELEASE_PROJECT_ID: "kaizen",
      BUILDER_NATIVE_STATE_DIRECTORY: state,
      BUILDER_NATIVE_WORKER_ID: "retirement-native-fixture",
      BUILDER_NATIVE_CONFIGURATION: "c".repeat(64),
      BUILDER_RELEASE_RETENTION_ENABLED: mode === "hold" ? "1" : "0",
      BUILDER_RELEASE_KEEP_COUNT: "2",
    },
    action: "maintain",
    root: source,
    native: journal,
    controller,
    client: connection as any,
    command: { cli: process.env.npm_execpath!, manager: "pnpm" },
    signal: new AbortController().signal,
    log: () => {},
    preflight: async () => {},
    build: async () => {
      throw new Error("Idle maintenance must not start a publication build");
    },
  },
  {
    maintenance: {
      ...quiet,
      now: () => now,
      afterRemove: async (relative) => {
        if (
          held ||
          mode === "recover" ||
          (mode === "hold" && relative !== "release.json")
        )
          return;
        held = true;
        assert.ok(
          Object.values(database.native).some(
            (item: any) => item.phase === "active",
          ),
        );
        await runControlledBuild({
          id: randomUUID(),
          root: holdBuild,
          command: { cli: process.env.npm_execpath!, manager: "pnpm" },
          signal: new AbortController().signal,
          log: () => {},
          environment: {
            ...process.env,
            RETIREMENT_READY: path.join(root, "ready.json"),
            RETIREMENT_PARENT: String(process.pid),
          },
        });
      },
    },
  },
);
assert.equal(mode, "recover", "The driver must kill each hold invocation");
assert.ok(result && "phase" in result);
assert.equal(result.phase, "removed");
assert.equal(database.rows.r1.phase, "removed");
assert.ok(
  Object.values(database.native).every(
    (item: any) => item.phase === "complete",
  ),
);
assert.deepEqual(await readdir(path.join(state, "operations")), []);
assert.deepEqual(await readdir(path.join(store, "releases")), [
  "r0",
  "r2",
  "r3",
]);
assert.deepEqual(
  await readFile(path.join(store, "active.conf")),
  await readFile(path.join(root, "original-active.conf")),
);
assert.equal(
  await readFile(path.join(store, "immutable/_astro/shared.js"), "utf8"),
  "retain visitor assets",
);
await assert.rejects(stageRelease({ store, source, id: "r1" }), /retired/);
await activateRelease({ store, id: "r0", origin: "http://127.0.0.1" }, quiet);
assert.equal((await verifyRelease(store, "r0")).id, "r0");
console.info(
  "RETIREMENT_SERVICE_RECOVERED: actual native maintenance caller, two killed invocations, detached-child cleanup, last-owner tracking, partial-manifest recovery with cleanup disabled, completion and retained rollback passed",
);
