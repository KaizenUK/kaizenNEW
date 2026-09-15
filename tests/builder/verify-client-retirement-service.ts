/** Actual transient systemd check for client release retirement. `prepare`
 * builds a disposable store; `hold` runs as a service and waits after removing
 * the target manifest until it is killed; `recover` runs in a later service. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  clientRetirementWorker,
  maintainClientReleases,
  processStart,
} from "../../scripts/builder-client-release-maintenance";
import { ReleaseRetirementState } from "../../scripts/release-retirement-state.mjs";
import { listReleases, verifyRelease } from "../../scripts/kaizen-releases.mjs";
import {
  retirementAdapters,
  retirementClientStore,
  retirementDatabase,
} from "../../client/visual-builder/releaseRetirementFixture";

const [mode, root] = process.argv.slice(2);
assert.ok(["prepare", "hold", "recover"].includes(mode));
assert.match(root, /\/kaizen-client-retirement-service-[A-Za-z0-9]+$/);
const configFile = path.join(root, "config.json"),
  readyFile = path.join(root, "ready.json"),
  workerId = "client-service-check";
if (mode === "prepare") {
  const site = await retirementClientStore(root);
  await writeFile(
    configFile,
    JSON.stringify({ site, now: Date.now() + 120 * 86400000 }),
  );
  process.exit(0);
}
const { site, now } = JSON.parse(await readFile(configFile, "utf8"));
const connection = retirementDatabase(path.join(root, "database.json"), now, {
  [site.scope]: site.store,
});
const clientWorker = await clientRetirementWorker({
  workerId,
  destination: site.destination,
});
const run = (
  enabled: string,
  afterRemove?: (relative: string) => Promise<void>,
) =>
  maintainClientReleases(
    {
      environment: {
        BUILDER_RELEASE_RETENTION_ENABLED: enabled,
        BUILDER_RELEASE_KEEP_COUNT: "2",
      },
      destination: site.destination,
      workerId,
      connection,
      clientWorker,
    },
    { ...retirementAdapters, now: () => now, afterRemove },
  );

if (mode === "hold") {
  // Retirement starts no children; this one proves the unit stops descendants.
  const child = spawn("/usr/bin/sleep", ["600"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  await run("1", async (relative) => {
    if (relative !== "release.json") return;
    await writeFile(
      readyFile,
      JSON.stringify({
        pid: process.pid,
        invocation: process.env.INVOCATION_ID,
        descendant: child.pid,
        descendantStart: (await processStart(child.pid!))!.startTime,
      }),
    );
    // An unresolved promise alone lets Node exit; keep the service running.
    await new Promise(() => setInterval(() => {}, 60000));
  });
  throw new Error(
    "The held service must be killed before retirement completes.",
  );
}

const ready = JSON.parse(await readFile(readyFile, "utf8"));
assert.ok(process.env.INVOCATION_ID);
assert.notEqual(ready.invocation, process.env.INVOCATION_ID);
const descendant = await processStart(ready.descendant);
assert.ok(
  !descendant || descendant.startTime !== ready.descendantStart,
  "The killed service left its descendant running.",
);
const saved = await new ReleaseRetirementState(site.store).peek();
assert.equal(saved?.attempt?.owner.worker.processId, ready.pid);
const lock = JSON.parse(
  await readFile(path.join(site.store, ".activation-lock/owner.json"), "utf8"),
);
assert.equal(lock.pid, ready.pid);
assert.deepEqual(
  (await listReleases(site.store)).releases.map((item: any) => item.id).sort(),
  ["c0", "c2", "c3"],
);
const result: any = await run("0");
assert.equal(result.phase, "removed");
assert.equal(result.artifactId, "c1");
assert.equal(result.recovered, true);
for (const name of [
  ".activation-lock",
  ".activation-lock.recovery",
  "releases/c1",
])
  await assert.rejects(lstat(path.join(site.store, name)), { code: "ENOENT" });
assert.equal((await listReleases(site.store)).selectedReleaseId, "c3");
await verifyRelease(site.store, "c2");
assert.equal((await connection.row(site.scope, "c1")).phase, "removed");
console.log(
  JSON.stringify({
    result,
    killedPid: ready.pid,
    recoveryPid: process.pid,
    killedInvocation: ready.invocation,
    recoveryInvocation: process.env.INVOCATION_ID,
    descendantStopped: true,
  }),
);
