/** Disposable service proof with real Git, pnpm and delegated command groups.
 * The native database connection uses fixture receipts; no live project RPC. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { nativeServiceController } from "../../scripts/builder-native-controller";
import { isolatedBuildCommand } from "../../scripts/builder-build-sandbox";
import { prepareNativeCheckout } from "../../scripts/builder-native-deploy";
import { runControlledCommand } from "../../scripts/builder-controlled-build";
import { NativePackageCache } from "../../scripts/builder-native-package-cache";
import { verifyNativePackageCache } from "./native-package-cache-fixture";

const root = process.env.KAIZEN_APP_DIR!;
const state = process.env.BUILDER_NATIVE_STATE_DIRECTORY!;
const mode = process.env.FIXTURE_RECOVERY_MODE || "normal";
assert.ok(
  [
    "normal",
    "hold",
    "recover",
    "candidate-hold",
    "candidate-recover",
    "cache-hold",
    "cache-recover",
  ].includes(mode),
);
const recovering =
  mode === "recover" ||
  mode === "candidate-recover" ||
  mode === "cache-recover";
assert.equal(process.cwd(), root);
const source = path.join(state, "fixture-source");
const environment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.test",
  ...(mode === "candidate-recover"
    ? {
        BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
        BUILDER_NATIVE_MIN_FREE_BYTES: "0",
      }
    : {}),
};
const exec = promisify(execFile);
const git = (directory: string, ...args: string[]) =>
  exec(
    "/usr/bin/git",
    ["-C", directory, "-c", "core.hooksPath=/dev/null", ...args],
    { env: environment },
  );
let before: string, commit: string;
if (!recovering) {
  await mkdir(source, { mode: 0o700 });
  await git(source, "init", "--initial-branch=main");
  await writeFile(
    path.join(source, ".gitignore"),
    ".env\nnode_modules\ninstall-proof.json\n",
  );
  await writeFile(path.join(source, "page.txt"), "Original");
  await writeFile(
    path.join(source, "package.json"),
    JSON.stringify({
      name: "native-deployment-fixture",
      private: true,
      packageManager: "pnpm@10.32.1",
      scripts: {
        postinstall: "node install.cjs",
      },
    }),
  );
  await writeFile(
    path.join(source, "install.cjs"),
    `
    const fs=require('node:fs'), path=require('node:path');
    fs.writeFileSync('install-proof.json', JSON.stringify({cgroup:fs.readFileSync('/proc/self/cgroup','utf8')}));
    if(process.env.FIXTURE_DISK_GROW==='1') {
      const state=process.env.BUILDER_NATIVE_STATE_DIRECTORY;
      const file=path.join(state,'dependencies','oversized-package');
      const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'ignore'});
      fs.writeFileSync(path.join(state,'disk-processes.json'),JSON.stringify([process.pid,child.pid]));
      fs.writeFileSync(file,''); fs.truncateSync(file,513*1024*1024);
      setInterval(()=>{},100);
    }
  `,
  );
  await writeFile(
    path.join(source, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n",
  );
  // Generate the pinned manager's canonical lockfile before committing the
  // fixture. Its first install otherwise reformats our hand-written YAML.
  await exec(
    process.execPath,
    [
      process.env.FIXTURE_PACKAGE_MANAGER!,
      "install",
      "--lockfile-only",
      "--ignore-scripts",
      "--store-dir",
      path.join(state, "fixture-lock-store"),
    ],
    { cwd: source, env: environment },
  );
  await git(source, "add", ".");
  await git(source, "commit", "-m", "Baseline");
  await git(root, "clone", source, ".");
  before = (await git(root, "rev-parse", "HEAD")).stdout.trim();
  await writeFile(path.join(root, ".env"), "FIXTURE_PRIVATE=preserved\n");
  await writeFile(path.join(root, "draft.txt"), "Private fixture draft");
  await writeFile(path.join(source, "page.txt"), "Reviewed replacement");
  await git(source, "add", "page.txt");
  await git(source, "commit", "-m", "Reviewed candidate");
  commit = (await git(source, "rev-parse", "HEAD")).stdout.trim();
  await writeFile(
    path.join(state, "fixture-case.json"),
    JSON.stringify({ before, commit }),
    { mode: 0o600 },
  );
} else {
  ({ before, commit } = JSON.parse(
    await readFile(path.join(state, "fixture-case.json"), "utf8"),
  ));
  assert.match(before, /^[a-f0-9]{40}$/);
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(
    (await git(root, "rev-parse", "HEAD")).stdout.trim(),
    mode === "cache-recover" ? commit : before,
  );
  assert.equal(
    await readFile(path.join(root, "page.txt"), "utf8"),
    mode === "recover" || mode === "cache-recover"
      ? "Reviewed replacement"
      : "Original",
  );
}
let abandoned: { candidate: string; processes: number[] } | undefined;
if (mode === "candidate-recover") {
  abandoned = JSON.parse(
    await readFile(path.join(state, "ready.json"), "utf8"),
  );
  assert.equal(
    (await lstat(path.join(abandoned!.candidate, "unfinished.bin"))).size,
    600 * 1024 ** 2,
  );
  for (const pid of abandoned!.processes) {
    const status = await readFile(`/proc/${pid}/stat`, "utf8").catch(
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      },
    );
    assert.ok(
      status === null ||
        status.slice(status.lastIndexOf(")") + 2).startsWith("Z "),
    );
  }
}
const active = new Set<string>();
const serviceController = await nativeServiceController();
const journal = new NativeOperationJournal({
  directory: path.join(state, "operations"),
  workerId: "fixture-native-deployment",
  configuration: "a".repeat(64),
  controller: serviceController,
  connection: {
    async nativeOperation(_token, input) {
      const { action, afterKey, ...identity } = input;
      if (action === "native-operation-assets")
        return {
          id: input.id,
          assets: [
            {
              projectId: "kaizen",
              assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              url: "https://fixture.example.test/retired.png",
            },
          ],
          cursor: null,
        };
      if (action === "native-operation-begin") active.add(input.id);
      else active.delete(input.id);
      return {
        ...identity,
        phase: action === "native-operation-begin" ? "active" : "complete",
      };
    },
  },
});
let commands = 0,
  installGroup = "";
const command = await isolatedBuildCommand(
  process.env.FIXTURE_PACKAGE_MANAGER || "",
);
if (recovering)
  assert.deepEqual(await journal.recover(), { completed: 1, deferred: 0 });
const result = await journal.run("", "kaizen", (files) =>
  prepareNativeCheckout(
    {
      root,
      state,
      repository: source,
      branch: "main",
      commit,
      environment,
      command,
      signal: new AbortController().signal,
      files,
      controller: serviceController,
      log: () => {},
    },
    {
      async run(input) {
        assert.equal(active.size, 1);
        commands++;
        if (input.args.includes("install")) installGroup = "build-" + input.id;
        const code = await runControlledCommand(input);
        if (mode === "candidate-hold" && input.args.includes("clone")) {
          assert.equal(code, 0);
          await runControlledCommand({
            ...input,
            id: randomUUID(),
            executable: process.execPath,
            args: [
              "-e",
              `
              const fs=require('node:fs'), childProcess=require('node:child_process');
              const file=${JSON.stringify(path.join(input.root, "unfinished.bin"))};
              fs.writeFileSync(file,'');fs.truncateSync(file,600*1024*1024);
              const child=childProcess.spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'ignore'});
              fs.writeFileSync(${JSON.stringify(path.join(state, "ready.json"))},JSON.stringify({candidate:${JSON.stringify(input.root)},processes:[process.pid,child.pid]}));
              setInterval(()=>{},100);
            `,
            ],
          });
          throw new Error(
            "The candidate fixture must be stopped by its service manager.",
          );
        }
        if (mode === "hold" && input.args.includes("read-tree")) {
          assert.equal(code, 0);
          await writeFile(
            path.join(state, "ready.json"),
            JSON.stringify({ pid: process.pid }),
            { mode: 0o600 },
          );
          await new Promise(() => setInterval(() => {}, 1000));
        }
        return code;
      },
    },
  ),
);
assert.deepEqual(result, {
  commit,
  previousCommit:
    mode === "recover" || mode === "cache-recover" ? commit : before,
});
assert.equal((await git(root, "rev-parse", "HEAD")).stdout.trim(), commit);
assert.equal(
  await readFile(path.join(root, ".env"), "utf8"),
  "FIXTURE_PRIVATE=preserved\n",
);
assert.equal(
  await readFile(path.join(root, "draft.txt"), "utf8"),
  "Private fixture draft",
);
const proof = JSON.parse(
  await readFile(path.join(root, "install-proof.json"), "utf8"),
);
assert.ok(proof.cgroup.trim().endsWith("/" + installGroup));
const membership = (await readFile("/proc/self/cgroup", "utf8"))
  .trim()
  .split("::")[1];
const groups = await readdir(path.dirname("/sys/fs/cgroup" + membership));
assert.equal(
  groups.some((name) => name.startsWith("build-")),
  false,
);
assert.equal(active.size, 0);
assert.deepEqual(await readdir(path.join(state, "operations")), []);
assert.deepEqual(await readdir(path.join(state, "candidates")), []);
assert.ok(commands > 10);
console.log("NATIVE_DEPLOYMENT_REAL_GIT_PNPM_CONTROLLER=PASS");
if (["normal", "cache-hold", "cache-recover"].includes(mode)) {
  const directory = path.join(state, "fixture-package-cache");
  await journal.run("", "kaizen", async () => {
    const execute = async (
      cwd: string,
      executable: string,
      args: string[],
      env: NodeJS.ProcessEnv,
    ) => {
      assert.equal(active.size, 1);
      const input = {
        id: randomUUID(),
        root: cwd,
        executable,
        args,
        environment: env,
        signal: new AbortController().signal,
        log: () => {},
      };
      if (mode === "cache-hold" && args.includes("prune")) {
        // Execute real pruning, then interrupt before its controlled command
        // can acknowledge completion. The restart must safely repeat it.
        input.executable = process.execPath;
        input.args = [
          "-e",
          `
          const fs=require('node:fs'), cp=require('node:child_process');
          const result=cp.spawnSync(${JSON.stringify(executable)},${JSON.stringify(args)},{stdio:'ignore'});
          if(result.status!==0) process.exit(19);
          const child=cp.spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:'ignore'});
          fs.writeFileSync(${JSON.stringify(path.join(state, "ready.json"))},JSON.stringify({processes:[process.pid,child.pid]}));
          setInterval(()=>{},100);
        `,
        ];
      }
      assert.equal(await runControlledCommand(input), 0);
    };
    if (mode === "cache-recover") {
      const ready = JSON.parse(
        await readFile(path.join(state, "ready.json"), "utf8"),
      );
      for (const pid of ready.processes) {
        const status = await readFile(`/proc/${pid}/stat`, "utf8").catch(
          (error) => {
            if (error.code !== "ENOENT") throw error;
            return null;
          },
        );
        assert.ok(
          status === null ||
            status.slice(status.lastIndexOf(")") + 2).startsWith("Z "),
        );
      }
      const fixtureRoot = path.join(directory, "checkout"),
        fixtureState = path.join(directory, "state");
      const cache = new NativePackageCache(fixtureRoot, fixtureState, {
        BUILDER_NATIVE_CACHE_PRUNE_BYTES: "1",
      });
      assert.equal(
        await cache.prune({
          signal: new AbortController().signal,
          pressured: true,
          log: () => {},
          run: (args, env) =>
            execute(
              fixtureState,
              process.execPath,
              [command.cli, ...args],
              env,
            ),
        }),
        true,
      );
      await execute(
        fixtureRoot,
        process.execPath,
        [
          "-e",
          "require('node:assert/strict').equal(require('fixture-active'),'installed package still works')",
        ],
        { PATH: process.env.PATH },
      );
      assert.equal(
        await readFile(path.join(fixtureRoot, "private-draft.txt"), "utf8"),
        "Preserved private draft",
      );
    } else {
      await verifyNativePackageCache({ directory, cli: command.cli, execute });
    }
  });
  assert.equal(active.size, 0);
  assert.deepEqual(await readdir(path.join(state, "operations")), []);
  assert.equal(
    (await readdir(path.dirname("/sys/fs/cgroup" + membership))).some((name) =>
      name.startsWith("build-"),
    ),
    false,
  );
  console.log(
    mode === "cache-recover"
      ? "NATIVE_PACKAGE_CACHE_STOPPED_SERVICE_RETRY=PASS"
      : "NATIVE_PACKAGE_CACHE_REAL_PNPM_CGROUPS=PASS",
  );
}
if (mode === "recover")
  console.log("NATIVE_DEPLOYMENT_KILLED_SERVICE_RECOVERY=PASS");
if (mode === "candidate-recover") {
  assert.equal(await lstat(abandoned!.candidate).catch(() => null), null);
  assert.equal(
    await lstat(path.join(state, "candidate.json")).catch(() => null),
    null,
  );
  console.log("NATIVE_CANDIDATE_STOPPED_SERVICE_RECLAMATION=PASS");
}
if (mode === "normal") {
  assert.equal(
    (
      await git(root, "status", "--porcelain", "--untracked-files=no")
    ).stdout.trim(),
    "",
    "Fixture installation must leave its pinned package/lock files unchanged",
  );
  const attemptCommands: string[][] = [];
  const prepare = () =>
    journal.run("", "kaizen", (files) =>
      prepareNativeCheckout(
        {
          root,
          state,
          repository: source,
          branch: "main",
          commit,
          command,
          environment: {
            ...environment,
            FIXTURE_DISK_GROW: "1",
            BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
            BUILDER_NATIVE_MIN_FREE_BYTES: "0",
            BUILDER_NATIVE_DISK_CHECK_MS: "100",
          },
          signal: new AbortController().signal,
          files,
          controller: serviceController,
          log: () => {},
        },
        {
          async run(input) {
            commands++;
            attemptCommands.push([...input.args]);
            return runControlledCommand(input);
          },
        },
      ),
    );
  await assert.rejects(prepare, /storage limit/);
  const stopped: number[] = JSON.parse(
    await readFile(path.join(state, "disk-processes.json"), "utf8"),
  );
  assert.equal(stopped.length, 2);
  for (const pid of stopped) {
    // The entire cgroup must be empty, including the detached descendant.
    const status = await readFile(`/proc/${pid}/stat`, "utf8").catch(
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      },
    );
    // Reparented zombies have stopped and cannot hold or mutate files.
    assert.ok(
      status === null ||
        status.slice(status.lastIndexOf(")") + 2).startsWith("Z "),
    );
  }
  assert.equal(
    (await readdir(path.dirname("/sys/fs/cgroup" + membership))).some((name) =>
      name.startsWith("build-"),
    ),
    false,
  );
  assert.equal(active.size, 0);
  assert.deepEqual(await readdir(path.join(state, "operations")), []);
  assert.deepEqual(await readdir(path.join(state, "candidates")), []);
  assert.equal(
    (await lstat(path.join(state, "dependencies", "oversized-package"))).size,
    513 * 1024 ** 2,
  );
  const previousCommands = commands;
  attemptCommands.length = 0;
  await assert.rejects(prepare, /storage limit/);
  assert.equal(commands, previousCommands + 1);
  assert.equal(attemptCommands.length, 1);
  assert.ok(
    attemptCommands[0].includes("store") &&
      attemptCommands[0].includes("prune"),
  );
  assert.equal((await git(root, "rev-parse", "HEAD")).stdout.trim(), commit);
  assert.equal(
    await readFile(path.join(root, ".env"), "utf8"),
    "FIXTURE_PRIVATE=preserved\n",
  );
  assert.equal(
    await readFile(path.join(root, "draft.txt"), "utf8"),
    "Private fixture draft",
  );
  console.log("NATIVE_DEPLOYMENT_DISK_REFUSAL_AND_ALL_CHILDREN_STOPPED=PASS");
}
