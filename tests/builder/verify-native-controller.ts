/** Run twice as the same disposable systemd unit: stop the hold invocation
 * after ready.json appears, then run recover against the same private fixture. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { nativeServiceController } from "../../scripts/builder-native-controller";
import { runControlledBuild } from "../../scripts/builder-controlled-build";
import type { NativeOperationIdentity } from "../../shared/builderNativeOperations";

const [mode, root] = process.argv.slice(2);
assert.ok(
  ["hold", "recover", "refuse"].includes(mode) && path.isAbsolute(root),
);
if (mode === "refuse") {
  await assert.rejects(nativeServiceController(), /configured systemd service/);
  console.info(
    "SYSTEMD_NATIVE_REFUSAL: incomplete service process cleanup refused",
  );
  process.exit(0);
}
const controller = await nativeServiceController();
const invocation = process.env.INVOCATION_ID;
process.env.INVOCATION_ID = "0".repeat(32);
await assert.rejects(nativeServiceController(), /configured systemd service/);
process.env.INVOCATION_ID = invocation;
const directory = path.join(root, "journal");
const stateFile = path.join(root, "states.json");
const states: Record<
  string,
  { identity: NativeOperationIdentity; phase: string }
> = mode === "hold" ? {} : JSON.parse(await readFile(stateFile, "utf8"));
const journal = new NativeOperationJournal({
  directory,
  workerId: "fixture-restart-helper",
  configuration: "c".repeat(64),
  controller,
  connection: {
    async nativeOperation(_token, input) {
      const { action, afterKey, ...identity } = input;
      if (action === "native-operation-assets")
        return { id: input.id, assets: [], cursor: null };
      const state = states[input.id];
      if (state) assert.deepEqual(state.identity, identity);
      const phase = action === "native-operation-begin" ? "active" : "complete";
      states[input.id] = { identity, phase };
      await writeFile(stateFile, JSON.stringify(states), { mode: 0o600 });
      return { ...identity, phase };
    },
  },
});
if (mode === "hold") {
  await assert.rejects(
    journal.run("fixture-token", "kaizen", async (protection) => {
      protection.retainOperation();
    }),
    /reconciliation/,
  );
  assert.deepEqual(await journal.recover(), { completed: 0, deferred: 1 });
  const checkout = path.join(root, "checkout");
  await mkdir(checkout);
  await writeFile(
    path.join(checkout, "package.json"),
    JSON.stringify({ type: "module", scripts: { build: "node hold.mjs" } }),
  );
  await writeFile(
    path.join(checkout, "hold.mjs"),
    `
    import {spawn} from 'node:child_process';
    const child=spawn(process.execPath,['--input-type=module','-e',\`
      import {writeFileSync,readFileSync} from 'node:fs';
      writeFileSync(process.env.FIXTURE_READY,JSON.stringify({pid:process.pid,cgroup:readFileSync('/proc/self/cgroup','utf8'),invocationId:process.env.INVOCATION_ID}));
      setInterval(()=>{},20);
    \`],{detached:true,stdio:'ignore'});
    child.unref();setInterval(()=>{},20);
  `,
  );
  await journal.run("fixture-token", "kaizen", async () =>
    runControlledBuild({
      id: randomUUID(),
      root: checkout,
      command: { cli: process.env.npm_execpath!, manager: "pnpm" },
      signal: new AbortController().signal,
      log: () => {},
      environment: {
        ...process.env,
        FIXTURE_READY: path.join(root, "ready.json"),
      },
    }),
  );
  throw Error("Hold invocation should have been stopped by the fixture driver");
} else {
  const ready = JSON.parse(
    await readFile(path.join(root, "ready.json"), "utf8"),
  );
  assert.notEqual(ready.invocationId, controller.identity.invocationId);
  assert.match(ready.cgroup, /\/build-[a-f0-9-]{36}\s*$/);
  const oldGroup = `/sys/fs/cgroup${ready.cgroup.trim().split("::")[1]}`;
  await assert.rejects(readFile(path.join(oldGroup, "cgroup.events"), "utf8"), {
    code: "ENOENT",
  });
  const processState = await readFile(`/proc/${ready.pid}/stat`, "utf8").catch(
    (error) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    },
  );
  assert.ok(!processState || /\) [ZX] /.test(processState));
  assert.equal(
    Object.values(states).filter((s) => s.phase === "active").length,
    2,
  );
  assert.equal((await readdir(directory)).length, 2);
  assert.deepEqual(await journal.recover(), { completed: 2, deferred: 0 });
  assert.ok(Object.values(states).every((s) => s.phase === "complete"));
  assert.deepEqual(await readdir(directory), []);
  assert.deepEqual(await journal.recover(), { completed: 0, deferred: 0 });
  console.info(
    "SYSTEMD_NATIVE_RESTART: two old intents reconciled after actual service stop; same-invocation refusal, descendant removal and idempotent recovery verified",
  );
}
