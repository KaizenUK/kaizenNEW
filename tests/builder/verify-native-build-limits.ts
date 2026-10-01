/** Run only in a disposable delegated Linux service, with no live project. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createBuildGroup } from "../../scripts/builder-build-sandbox";
import { runControlledCommand } from "../../scripts/builder-controlled-build";
import { nativeBuildLimits } from "../../scripts/builder-native-release";

const limits = nativeBuildLimits({
  BUILDER_NATIVE_BUILD_MEMORY_BYTES: String(6 * 1024 ** 3),
});
const membership = (await readFile("/proc/self/cgroup", "utf8"))
  .trim()
  .split("::")[1];
assert.match(membership, /\/supervisor$/);
const parent = path.dirname(`/sys/fs/cgroup${membership}`);
const groups = async () =>
  (await readdir(parent)).filter((name) => name.startsWith("build-")).sort();
const baseline = await groups();
try {
  await assert.rejects(
    createBuildGroup(randomUUID(), limits),
    /resource limits/,
  );
  let output = "";
  const code = await runControlledCommand(
    {
      id: randomUUID(),
      root: process.cwd(),
      executable: process.execPath,
      args: [
        "--input-type=module",
        "-e",
        `
      import {readFileSync} from 'node:fs';
      const group='/sys/fs/cgroup'+readFileSync('/proc/self/cgroup','utf8').trim().split('::')[1];
      console.log(JSON.stringify(Object.fromEntries(['memory.max','memory.swap.max','pids.max','cpu.max'].map(name=>[name,readFileSync(group+'/'+name,'utf8').trim()]))));
    `,
      ],
      environment: { PATH: process.env.PATH },
      signal: new AbortController().signal,
      log: (chunk) => {
        output += chunk.toString();
      },
    },
    limits,
  );
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(output), {
    "memory.max": "6442450944",
    "memory.swap.max": "0",
    "pids.max": "128",
    "cpu.max": "200000 100000",
  });
  console.info(
    "Native 6 GiB cgroup, unchanged CPU/process/swap bounds, isolated 2 GiB ceiling and cleanup: passed",
  );
} finally {
  assert.deepEqual(await groups(), baseline);
}
