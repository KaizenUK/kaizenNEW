/** Disposable Linux namespace proof for retained-release ownership and mounts.
 * Database replies and HTTP checks are fixtures; real Nginx has its own suite. */
import assert from "node:assert/strict";
import {
  chown,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  activateRelease,
  initialiseStore,
  stageRelease,
} from "../../scripts/kaizen-releases.mjs";
import {
  inspectReleaseRetention,
  withReleaseRetentionStore,
} from "../../scripts/release-retention.mjs";
import { ReleaseRetirementState } from "../../scripts/release-retirement-state.mjs";

const run = promisify(execFile);
const root = process.env.KAIZEN_RETENTION_FIXTURE_ROOT || "";
assert.equal(
  process.getuid?.(),
  0,
  "Run only in the disposable root mount namespace",
);
assert.match(root, /^\/var\/tmp\/kaizen-release-retention-[a-f0-9]{12}$/);
const store = path.join(root, "store"),
  source = path.join(root, "source"),
  outside = path.join(root, "outside");
const now = Date.now() + 120 * 86400000;
await mkdir(path.join(source, "builder"), { recursive: true });
await mkdir(outside);
await writeFile(path.join(outside, "private.txt"), "outside fixture canary");
for (let n = 0; n < 4; n++) {
  await writeFile(path.join(source, "index.html"), `<h1>r${n}</h1>`);
  await writeFile(
    path.join(source, "builder/index.html"),
    `<h1>Builder r${n}</h1>`,
  );
  await stageRelease({ source, store, id: `r${n}` });
}
await initialiseStore({ store, id: "r0" });
await activateRelease(
  { store, id: "r3", origin: "http://127.0.0.1" },
  {
    validateConfig: async () => {},
    reload: async () => {},
    checkLive: async () => {},
  },
);
let calls = 0;
const options = {
  store,
  origin: "http://127.0.0.1",
  projectId: "kaizen",
  scope: "repository:production",
  workerId: "retention-fixture",
  retention: { keepCount: 2, minAgeDays: 30, visitorGraceDays: 7 },
  connection: {
    async rpc(name: string, input: any) {
      assert.equal(name, "builder_release_retention_observe");
      calls++;
      return {
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
        eligible_at: new Date(now + 7 * 86400000).toISOString(),
      };
    },
  },
};
const adapters = { now: () => now, checkLive: async () => {} };
const inspect = () => inspectReleaseRetention(options, adapters);
assert.equal((await inspect()).candidates.length, 1);
const active = await readFile(path.join(store, "active.conf"));
const target = path.join(store, "releases/r1/site");
assert.equal((await lstat(target)).dev, (await lstat(outside)).dev);
await run("/usr/bin/mount", ["--bind", outside, target]);
try {
  calls = 0;
  await assert.rejects(inspect(), /contains a mount, including a bind mount/);
  assert.equal(calls, 0);
  assert.equal(
    await readFile(path.join(outside, "private.txt"), "utf8"),
    "outside fixture canary",
  );
  assert.deepEqual(await readFile(path.join(store, "active.conf")), active);
} finally {
  await run("/usr/bin/umount", [target]);
}
assert.equal((await inspect()).candidates.length, 1);
const metadata = path.join(store, "releases/r1/release.json");
await chown(metadata, 65534, 65534);
try {
  calls = 0;
  await assert.rejects(inspect(), /linked, mounted, foreign or not ordinary/);
  assert.equal(calls, 0);
} finally {
  await chown(metadata, 0, 0);
}
assert.equal((await inspect()).candidates.length, 1);
assert.equal((await readdir(path.join(store, "releases"))).length, 4);
assert.deepEqual(await readFile(path.join(store, "active.conf")), active);
console.log(
  "Real same-device bind mount and foreign-owner refusal pass; outside bytes, serving selection and all four releases are preserved.",
);

// The journal is not yet a removal coordinator. Exercise its private writes
// and direct staging fence against real mount/owner boundaries independently.
const state = new ReleaseRetirementState(store);
await withReleaseRetentionStore(
  options,
  (session) => state.bind(session),
  adapters,
);
const binding = path.join(store, ".retirement/binding.json");
const bindingBytes = await readFile(binding);
const privateRoot = path.join(store, ".retirement");
await run("/usr/bin/mount", ["--bind", outside, privateRoot]);
try {
  await assert.rejects(
    withReleaseRetentionStore(
      options,
      (session) => state.bind(session),
      adapters,
    ),
    /contains a mount/,
  );
  await assert.rejects(
    stageRelease({ source, store, id: "mount-refused" }),
    /contains a mount/,
  );
  assert.deepEqual(await readdir(outside), ["private.txt"]);
} finally {
  await run("/usr/bin/umount", [privateRoot]);
}
assert.deepEqual(await readFile(binding), bindingBytes);
await chown(binding, 65534, 65534);
try {
  await assert.rejects(
    stageRelease({ source, store, id: "owner-refused" }),
    /ownership/,
  );
  calls = 0;
  await assert.rejects(inspect(), /ownership/);
  assert.equal(calls, 0);
} finally {
  await chown(binding, 0, 0);
}
assert.equal((await inspect()).candidates.length, 1);
assert.deepEqual(await readFile(binding), bindingBytes);
assert.deepEqual(await readFile(path.join(store, "active.conf")), active);
assert.equal((await readdir(path.join(store, "releases"))).length, 4);
console.log(
  "Retirement metadata rejects real mounted/foreign-owned paths; no release is removed or added.",
);
