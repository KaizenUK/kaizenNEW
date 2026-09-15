/** Disposable Linux service fixture: the real hosted helper, journal, runner
 * and cgroup controller. Supabase/SSH are fixture boundaries; no live projects. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { runControlledBuild } from "../../scripts/builder-controlled-build";
import { nativeServiceController } from "../../scripts/builder-native-controller";
import { helperProject, hostedHelperFixture } from "./hosted-helper-fixture";

const script = `
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const home=process.env.HOME;
const mode=JSON.parse(await readFile(path.join(home,'mode.json'),'utf8'));
const child=spawn(process.execPath,['--input-type=module','-e',\`
  import {writeFileSync,readFileSync} from 'node:fs';
  import path from 'node:path';
  writeFileSync(path.join(process.env.HOME,'child.json'),JSON.stringify({pid:process.pid,cgroup:readFileSync('/proc/self/cgroup','utf8')}));
  setInterval(()=>{},20);
\`],{detached:true,stdio:mode==='inherited'?'inherit':'ignore'});
child.unref();
for(let n=0;;n++) {
  try { const ready=JSON.parse(await readFile(path.join(home,'child.json'),'utf8')); if(ready.pid===child.pid) break; } catch {}
  if(n>500) throw Error('Child readiness missing');
  await new Promise(r=>setTimeout(r,10));
}
await mkdir('dist',{recursive:true});
await writeFile('dist/index.html','<h1>'+mode+'</h1>');
if(mode==='cancel'||mode==='timeout') await new Promise(()=>{setInterval(()=>{},1000)});
if(mode==='failed') process.exit(7);
`;

const directory = await mkdtemp(
  path.join(tmpdir(), "kaizen-controlled-build-"),
);
const active = new Set<string>();
const membership = (await readFile("/proc/self/cgroup", "utf8"))
  .trim()
  .split("::")[1];
assert.match(membership, /\/supervisor$/);
const parent = path.dirname(`/sys/fs/cgroup${membership}`);
const groups = async () =>
  (await readdir(parent)).filter((n) => n.startsWith("build-")).sort();
const baseline = await groups();
const journal = new NativeOperationJournal({
  directory,
  workerId: "fixture-controlled-helper",
  configuration: "a".repeat(64),
  controller: await nativeServiceController(),
  connection: {
    async nativeOperation(_token, input) {
      const { action, afterKey, ...identity } = input;
      if (action === "native-operation-assets")
        return { id: input.id, assets: [], cursor: null };
      if (action === "native-operation-begin") active.add(input.id);
      else active.delete(input.id);
      return {
        ...identity,
        phase: action === "native-operation-begin" ? "active" : "complete",
      };
    },
  },
});
let api: Awaited<ReturnType<typeof hostedHelperFixture>> | undefined;
let checks = 0;
let controlledId = "";
try {
  api = await hostedHelperFixture(
    [helperProject],
    script,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    journal,
    async (input) => {
      controlledId = input.id;
      const mode = JSON.parse(
        await readFile(path.join(input.environment.HOME!, "mode.json"), "utf8"),
      );
      const controller = new AbortController();
      const abort = () => controller.abort(input.signal.reason);
      input.signal.addEventListener("abort", abort, { once: true });
      const timer =
        mode === "timeout"
          ? setTimeout(
              () => controller.abort(new Error("Fixture deadline")),
              1500,
            )
          : undefined;
      try {
        return await runControlledBuild({
          ...input,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
        input.signal.removeEventListener("abort", abort);
      }
    },
  );
  const request = async (input: Record<string, unknown>) => {
    const reply = await api!.send(input);
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body;
  };
  await request({ action: "repository-connect" });
  const home = (await api.folders.buildEnvironment(helperProject)).HOME!;
  const root = api.folders.root(helperProject);
  let previous = "";
  for (const mode of ["detached", "inherited", "failed", "cancel", "timeout"]) {
    await rm(path.join(home, "child.json"), { force: true });
    await writeFile(path.join(home, "mode.json"), JSON.stringify(mode));
    const plan = await request({ action: "repository-build-review" });
    const job = await request({
      action: "repository-build-start",
      planId: plan.id,
    });
    const deadline = Date.now() + 25000;
    let report: { pid: number; cgroup: string } | undefined;
    while (!report && Date.now() < deadline) {
      try {
        report = JSON.parse(
          await readFile(path.join(home, "child.json"), "utf8"),
        );
      } catch {}
      if (!report) await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(report, `${mode}: actual detached child started`);
    assert.match(report.cgroup, new RegExp(`/build-${controlledId}\\s*$`));
    if (mode === "cancel") {
      assert.ok(active.size > 0);
      await request({ action: "repository-build-stop", jobId: job.id });
    }
    let status = await request({
      action: "repository-build-status",
      jobId: job.id,
    });
    while (
      ["queued", "building"].includes(status.status) &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 20));
      status = await request({
        action: "repository-build-status",
        jobId: job.id,
      });
    }
    const expected = ["detached", "inherited"].includes(mode)
      ? "succeeded"
      : mode === "cancel"
        ? "cancelled"
        : "failed";
    assert.equal(status.status, expected, JSON.stringify(status));
    assert.deepEqual(await groups(), baseline);
    assert.equal(active.size, 0);
    assert.deepEqual(await readdir(directory), []);
    // cgroup absence is authoritative for descendants; a reparented zombie may
    // temporarily retain a /proc entry, but it cannot run or write anything.
    const state = await readFile(`/proc/${report.pid}/stat`, "utf8").catch(
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return "";
      },
    );
    assert.ok(
      !state || /\) [ZX] /.test(state),
      "Detached child must no longer run",
    );
    if (expected === "succeeded") previous = `<h1>${mode}</h1>`;
    assert.equal(
      await readFile(path.join(root, "dist/index.html"), "utf8"),
      previous,
    );
    checks++;
    console.info(`Controlled hosted build ${mode}: passed`);
  }
  console.info(`CONTROLLED_HOSTED_BUILD_CHECKS=${checks}`);
} finally {
  await api?.close();
  await rm(directory, { recursive: true, force: true });
  assert.deepEqual(await groups(), baseline);
}
