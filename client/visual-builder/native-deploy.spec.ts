import { afterEach, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  link,
  readFile,
  readdir,
  rm,
  lstat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  prepareNativeCheckout,
  recoverNativeCheckout,
} from "../../scripts/builder-native-deploy";
import { NativeOperationJournal } from "../../scripts/builder-native-operations";
import { SandboxCleanupError } from "../../scripts/builder-build-sandbox";
import type { ControlledCommand } from "../../scripts/builder-controlled-build";
import type { NativeOperationController } from "../../scripts/builder-native-controller";
import type { NativeOperationInput } from "../../shared/builderNativeOperations";

const exec = promisify(execFile),
  roots: string[] = [];
const environment = {
  PATH: process.env.PATH,
  LANG: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.test",
  NODE_ENV: "production",
};
const git = (root: string, ...args: string[]) =>
  exec(
    "/usr/bin/git",
    ["-C", root, "-c", "core.hooksPath=/dev/null", ...args],
    { env: environment },
  );
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "kaizen-native-deploy-"));
  roots.push(directory);
  const source = path.join(directory, "source"),
    root = path.join(directory, "checkout");
  const state = path.join(directory, "state"),
    manager = path.join(directory, "manager.cjs");
  await mkdir(source);
  await git(source, "init", "--initial-branch=main");
  await writeFile(path.join(source, ".gitignore"), ".env\n");
  await writeFile(path.join(source, "page.txt"), "Original page");
  await writeFile(path.join(source, "package.json"), "{}");
  await git(source, "add", ".");
  await git(source, "commit", "-m", "Baseline");
  const before = (await git(source, "rev-parse", "HEAD")).stdout.trim();
  await git(directory, "clone", source, root);
  await writeFile(path.join(root, ".env"), "PRIVATE_FIXTURE=preserved\n");
  await writeFile(path.join(root, "personal-draft.txt"), "Untracked draft");
  await writeFile(
    manager,
    `const fs=require('node:fs'),path=require('node:path');
    if(process.argv.includes('store') && process.argv.includes('prune')) {
      const store=process.argv[process.argv.indexOf('--store-dir')+1];
      fs.unlinkSync(path.join(store,'v10/files/aa','b'.repeat(126)));
      process.exit(0);
    }
    if(!process.argv.includes('--frozen-lockfile') || !process.argv.includes('--prod=false')) process.exit(9);
    fs.appendFileSync(process.env.FIXTURE_INSTALL_LOG,JSON.stringify(process.argv.slice(2))+'\\n');
    if(process.env.FIXTURE_FAIL_INSTALL==='1') process.exit(7);
  `,
  );
  const asset = {
    projectId: "kaizen",
    assetId: randomUUID(),
    url: "https://fixture.example.test/retired.png",
  };
  let phase: "active" | "complete" | undefined;
  const calls: ControlledCommand[] = [];
  let invocationId = "a".repeat(32);
  const controller: NativeOperationController = {
    get identity() {
      return {
        kind: "systemd" as const,
        unit: "fixture-native-deploy.service",
        invocationId,
      };
    },
    async stopped(_operation, previous) {
      return (
        previous.unit === this.identity.unit &&
        previous.invocationId !== invocationId
      );
    },
  };
  const journal = new NativeOperationJournal({
    directory: path.join(state, "operations"),
    workerId: "fixture-native-deploy",
    configuration: "a".repeat(64),
    controller,
    connection: {
      async nativeOperation(_token: string, input: NativeOperationInput) {
        if (input.action === "native-operation-assets")
          return { id: input.id, assets: [asset], cursor: null };
        phase =
          input.action === "native-operation-begin" ? "active" : "complete";
        const { action, afterKey, ...identity } = input;
        return { ...identity, phase };
      },
    },
  });
  const abort = new AbortController();
  let beforeCommand:
    | ((command: ControlledCommand) => Promise<void>)
    | undefined;
  let afterCommand: typeof beforeCommand;
  const input = {
    root,
    state,
    repository: source,
    branch: "main" as const,
    commit: before,
    environment: {
      ...environment,
      FIXTURE_INSTALL_LOG: path.join(directory, "installs.jsonl"),
      FIXTURE_FAIL_INSTALL: "0",
    },
    command: { cli: manager, manager: "pnpm" as const },
    signal: abort.signal,
    controller,
    log: () => {},
  };
  const run = (recoverOnly = false) =>
    journal.run("", "kaizen", async (files) =>
      (recoverOnly ? recoverNativeCheckout : prepareNativeCheckout)(
        { ...input, files },
        {
          async run(command) {
            expect(phase).toBe("active");
            expect(await readdir(path.join(state, "operations"))).toHaveLength(
              1,
            );
            calls.push(command);
            await beforeCommand?.(command);
            command.signal.throwIfAborted();
            try {
              const { stdout, stderr } = await exec(
                command.executable,
                [...command.args],
                {
                  cwd: command.root,
                  env: command.environment,
                  signal: command.signal,
                },
              );
              (command.stdout || command.log)(stdout);
              command.log(stderr);
              await afterCommand?.(command);
              return 0;
            } catch (error) {
              if (typeof (error as { code?: unknown }).code === "number")
                return (error as unknown as { code: number }).code;
              throw error;
            }
          },
        },
      ),
    );
  const commit = async () => {
    await git(source, "add", "-A");
    await git(source, "commit", "-m", "Candidate");
    input.commit = (await git(source, "rev-parse", "HEAD")).stdout.trim();
  };
  const preserved = async (head = before) => {
    expect((await git(root, "rev-parse", "HEAD")).stdout.trim()).toBe(head);
    expect(await readFile(path.join(root, ".env"), "utf8")).toBe(
      "PRIVATE_FIXTURE=preserved\n",
    );
    expect(await readFile(path.join(root, "personal-draft.txt"), "utf8")).toBe(
      "Untracked draft",
    );
  };
  return {
    source,
    root,
    state,
    asset,
    input,
    before,
    commit,
    run,
    preserved,
    abort,
    calls,
    restart: async () => {
      invocationId = randomUUID().replace(/-/g, "");
      return journal.recover();
    },
    phase: () => phase,
    beforeCommand: (callback: typeof beforeCommand) => {
      beforeCommand = callback;
    },
    afterCommand: (callback: typeof afterCommand) => {
      afterCommand = callback;
    },
  };
}

it("keeps protection through real candidate fetch, checkout and both dependency installs while preserving private files", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), "Reviewed page");
  await mkdir(path.join(f.source, "apps/studio"), { recursive: true });
  await writeFile(path.join(f.source, "apps/studio/package.json"), "{}");
  await f.commit();
  expect(await f.run()).toEqual({
    commit: f.input.commit,
    previousCommit: f.before,
  });
  await f.preserved(f.input.commit);
  expect(await readFile(path.join(f.root, "page.txt"), "utf8")).toBe(
    "Reviewed page",
  );
  const installs = f.calls.filter((c) => c.executable === process.execPath);
  expect(installs).toHaveLength(2);
  expect(installs[1].args).toContain("apps/studio");
  expect(
    installs.every((c) => c.args.includes(path.join(f.state, "dependencies"))),
  ).toBe(true);
  expect(f.phase()).toBe("complete");
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
});

it("prunes a recorded cache before storage admission and retains native protection when cleanup is uncertain", async () => {
  const f = await fixture();
  await f.run();
  const retained = path.join(
    f.state,
    "dependencies/v10/files/aa",
    "b".repeat(126),
  );
  await mkdir(path.dirname(retained), { recursive: true });
  await writeFile(retained, "");
  await truncate(retained, 600 * 1024 ** 2);
  Object.assign(f.input.environment, {
    BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
    BUILDER_NATIVE_MIN_FREE_BYTES: "0",
  });
  f.calls.length = 0;
  f.beforeCommand(async (command) => {
    if (command.args.includes("prune")) throw new SandboxCleanupError();
  });
  await expect(f.run()).rejects.toThrow("needs reconciliation");
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0].args).toContain("prune");
  expect(f.phase()).toBe("active");
  expect((await lstat(retained)).size).toBe(600 * 1024 ** 2);
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
  await f.preserved();
  expect(await f.restart()).toEqual({ completed: 1, deferred: 0 });
  f.beforeCommand(undefined);
  f.calls.length = 0;
  await f.run();
  expect(f.calls[0].args).toContain("prune");
  expect(f.calls.some((command) => command.args.includes("clone"))).toBe(true);
  await expect(lstat(retained)).rejects.toMatchObject({ code: "ENOENT" });
  expect(f.phase()).toBe("complete");
  await f.preserved();
});

it("refuses new preparation before Git or package commands when retained worker files consume its allowance", async () => {
  const f = await fixture();
  await mkdir(path.join(f.state, "dependencies"), {
    recursive: true,
    mode: 0o700,
  });
  const retained = path.join(f.state, "dependencies", "retained-package");
  await writeFile(retained, "");
  await truncate(retained, 400 * 1024 ** 2);
  Object.assign(f.input.environment, {
    BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
    BUILDER_NATIVE_MIN_FREE_BYTES: "0",
  });
  await expect(f.run()).rejects.toThrow("storage limit");
  expect(f.calls).toHaveLength(0);
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
  expect((await lstat(retained)).size).toBe(400 * 1024 ** 2);
  await f.preserved();
  // Refusal does not make explicit recovery inaccessible or run a new build.
  await expect(f.run(true)).resolves.toBe(null);
  expect(f.calls).toHaveLength(0);
});

it("cancels an actual growing dependency command and retains its files for accounted retry", async () => {
  const f = await fixture();
  Object.assign(f.input.environment, {
    BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
    BUILDER_NATIVE_MIN_FREE_BYTES: "0",
    BUILDER_NATIVE_DISK_CHECK_MS: "100",
  });
  const output = path.join(f.state, "dependencies", "oversized-package");
  const pidFile = path.join(f.state, "install.pid");
  await writeFile(
    f.input.command.cli,
    `
    const fs=require('node:fs');
    fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
    fs.writeFileSync(${JSON.stringify(output)}, '');
    fs.truncateSync(${JSON.stringify(output)}, 513*1024*1024);
    setInterval(()=>{},100);
  `,
  );
  await expect(f.run()).rejects.toThrow("storage limit");
  const pid = Number(await readFile(pidFile, "utf8"));
  await expect
    .poll(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ESRCH";
      }
    })
    .toBe(true);
  expect((await lstat(output)).size).toBe(513 * 1024 ** 2);
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
  await f.preserved();
  const previousCommands = f.calls.length;
  await expect(f.run()).rejects.toThrow("storage limit");
  expect(f.calls).toHaveLength(previousCommands);
  expect((await lstat(output)).size).toBe(513 * 1024 ** 2);
});

it("rejects a retired reference in candidate Git history before changing authoritative source", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), f.asset.url);
  await f.commit();
  await writeFile(
    path.join(f.source, "page.txt"),
    "Reference removed from current source",
  );
  await f.commit();
  await expect(f.run()).rejects.toThrow("no longer available");
  await f.preserved();
  expect(
    f.calls.some((c) => c.root === f.root && c.args.includes("fetch")),
  ).toBe(false);
  expect(f.phase()).toBe("complete");
});

it("rejects a commit outside the requested branch and refuses dirty tracked source", async () => {
  const f = await fixture();
  await git(f.source, "checkout", "-b", "unreviewed");
  await writeFile(path.join(f.source, "page.txt"), "Other branch");
  await f.commit();
  await expect(f.run()).rejects.toThrow("checked command failed");
  await f.preserved();
  const next = await fixture();
  await writeFile(path.join(next.root, "page.txt"), "Pending personal edit");
  await expect(next.run()).rejects.toThrow("local edits");
  expect(await readFile(path.join(next.root, "page.txt"), "utf8")).toBe(
    "Pending personal edit",
  );
  expect(next.calls.some((c) => c.args.includes("clone"))).toBe(false);
});

it("refuses ignored-file and directory collisions without overwriting private data", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, ".env"), "Candidate overwrite");
  await git(f.source, "add", "-f", ".env");
  await f.commit();
  await expect(f.run()).rejects.toThrow("private or untracked");
  await f.preserved();
  const next = await fixture();
  await mkdir(path.join(next.root, "new-file"));
  await writeFile(
    path.join(next.root, "new-file/private.txt"),
    "Private draft",
  );
  await writeFile(path.join(next.source, "new-file"), "New file");
  await next.commit();
  await expect(next.run()).rejects.toThrow("private or untracked");
  expect(
    await readFile(path.join(next.root, "new-file/private.txt"), "utf8"),
  ).toBe("Private draft");
});

it("supports tracked file-to-directory and directory-to-file changes without discarding unrelated files", async () => {
  const f = await fixture();
  await rm(path.join(f.source, "page.txt"));
  await mkdir(path.join(f.source, "page.txt"));
  await writeFile(path.join(f.source, "page.txt/child.txt"), "Nested page");
  await f.commit();
  await f.run();
  await f.preserved(f.input.commit);
  await rm(path.join(f.source, "page.txt"), { recursive: true });
  await writeFile(path.join(f.source, "page.txt"), "Single page again");
  await f.commit();
  await f.run();
  await f.preserved(f.input.commit);
  expect(await readFile(path.join(f.root, "page.txt"), "utf8")).toBe(
    "Single page again",
  );
});

it("rechecks authoritative edits after candidate review and stops before reset", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), "Candidate page");
  await f.commit();
  f.beforeCommand(async (command) => {
    if (command.args.includes("ls-tree"))
      await writeFile(path.join(f.root, "page.txt"), "New personal edit");
  });
  await expect(f.run()).rejects.toThrow("changed during candidate review");
  await f.preserved();
  expect(await readFile(path.join(f.root, "page.txt"), "utf8")).toBe(
    "New personal edit",
  );
});

it("admits recovery without a new source commit while deployment still requires one", async () => {
  const f = await fixture();
  f.input.commit = "";
  await expect(f.run(true)).resolves.toBeNull();
  expect(f.calls).toEqual([]);
  await f.preserved();
  await expect(f.run()).rejects.toThrow(/source commit/);
  f.input.commit = "not-a-commit";
  await expect(f.run(true)).rejects.toThrow(/source commit/);
  await f.preserved();
});

it("retains the candidate and durable operation when process cleanup is uncertain", async () => {
  const f = await fixture();
  f.beforeCommand(async (command) => {
    if (command.args.includes("clone")) throw new SandboxCleanupError();
  });
  await expect(f.run()).rejects.toThrow();
  await f.preserved();
  expect(f.phase()).toBe("active");
  expect(await readdir(path.join(f.state, "candidates"))).toHaveLength(1);
  expect(await readdir(path.join(f.state, "operations"))).toHaveLength(1);
});

it("reclaims an abandoned candidate before storage admission only after verified service restart, without fetching during reconciliation", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), "Later approved page");
  await f.commit();
  Object.assign(f.input.environment, {
    BUILDER_NATIVE_STORAGE_MAX_BYTES: String(512 * 1024 ** 2),
    BUILDER_NATIVE_MIN_FREE_BYTES: "0",
  });
  let abandoned = "";
  f.afterCommand(async (command) => {
    if (command.args.includes("clone")) {
      abandoned = command.root;
      await writeFile(path.join(abandoned, "unfinished.bin"), "");
      await truncate(path.join(abandoned, "unfinished.bin"), 600 * 1024 ** 2);
      throw new SandboxCleanupError();
    }
  });
  await expect(f.run()).rejects.toThrow("needs reconciliation");
  expect((await lstat(path.join(abandoned, "unfinished.bin"))).size).toBe(
    600 * 1024 ** 2,
  );
  expect(
    JSON.parse(await readFile(path.join(f.state, "candidate.json"), "utf8"))
      .phase,
  ).toBe("running");
  await expect(f.run(true)).rejects.toThrow("still has running work");
  await f.preserved();
  f.afterCommand(undefined);
  await f.restart();
  const beforeCommands = f.calls.length;
  await expect(f.run(true)).resolves.toBeNull();
  expect(f.calls).toHaveLength(beforeCommands);
  expect(await lstat(abandoned).catch(() => null)).toBeNull();
  expect(
    await lstat(path.join(f.state, "candidate.json")).catch(() => null),
  ).toBeNull();
  await f.preserved();
  await expect(f.run()).resolves.toMatchObject({ commit: f.input.commit });
  await f.preserved(f.input.commit);
});

it("stops cancelled preparation before mutation and can retry a completed failed dependency command", async () => {
  const f = await fixture();
  f.beforeCommand(async (command) => {
    if (command.args.includes("clone"))
      f.abort.abort(new Error("Fixture cancelled"));
  });
  await expect(f.run()).rejects.toThrow("Fixture cancelled");
  await f.preserved();
  expect(f.phase()).toBe("complete");
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
  const next = await fixture();
  await writeFile(path.join(next.source, "page.txt"), "Candidate page");
  await next.commit();
  next.input.environment.FIXTURE_FAIL_INSTALL = "1";
  await expect(next.run()).rejects.toThrow("checked command failed");
  await next.preserved(next.input.commit);
  next.input.environment.FIXTURE_FAIL_INSTALL = "0";
  await next.run();
  await next.preserved(next.input.commit);
  expect(next.phase()).toBe("complete");
});

it("resumes a verified partial checkout only after the old service invocation stopped", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), "Approved replacement");
  await f.commit();
  f.afterCommand(async (command) => {
    if (command.args.includes("read-tree")) throw new SandboxCleanupError();
  });
  await expect(f.run()).rejects.toThrow();
  await f.preserved();
  expect(await readFile(path.join(f.root, "page.txt"), "utf8")).toBe(
    "Approved replacement",
  );
  const receipt = JSON.parse(
    await readFile(path.join(f.state, "checkout/receipt.json"), "utf8"),
  );
  expect(receipt.stopped).toBe(false);
  expect(receipt.before).toBe(f.before);
  expect(receipt.after).toBe(f.input.commit);
  expect(JSON.stringify(receipt)).not.toContain("PRIVATE_FIXTURE");
  await link(
    path.join(f.state, "checkout/receipt.json"),
    path.join(f.state, "checkout", randomUUID() + ".json.tmp"),
  );
  await expect(f.run()).rejects.toThrow("still owned");
  f.afterCommand(undefined);
  expect(await f.restart()).toEqual({ completed: 1, deferred: 0 });
  await f.run();
  await f.preserved(f.input.commit);
  expect(await readdir(path.join(f.root, ".git"))).not.toContain("index.lock");
  expect(await readdir(f.state)).not.toContain("checkout");
  expect(
    (await git(f.root, "status", "--porcelain", "--untracked-files=no")).stdout,
  ).toBe("");
});

it("recovers after installing the new index or committing HEAD without repeating a successful Git update", async () => {
  for (const afterHead of [false, true]) {
    const f = await fixture();
    await writeFile(path.join(f.source, "page.txt"), "Approved replacement");
    await f.commit();
    const interrupt = async (command: ControlledCommand) => {
      if (command.args.includes("update-ref")) throw new SandboxCleanupError();
    };
    if (afterHead) f.afterCommand(interrupt);
    else f.beforeCommand(interrupt);
    await expect(f.run()).rejects.toThrow();
    await f.preserved(afterHead ? f.input.commit : f.before);
    f.afterCommand(undefined);
    f.beforeCommand(undefined);
    await f.restart();
    const completedBefore = (await git(f.root, "reflog", "--format=%H")).stdout
      .split("\n")
      .filter((value) => value === f.input.commit).length;
    await f.run();
    await f.preserved(f.input.commit);
    const completedAfter = (await git(f.root, "reflog", "--format=%H")).stdout
      .split("\n")
      .filter((value) => value === f.input.commit).length;
    expect(completedAfter).toBe(
      afterHead ? completedBefore : completedBefore + 1,
    );
  }
});

it("preserves personal edits and foreign Git locks encountered during recovery", async () => {
  for (const foreignLock of [false, true]) {
    const f = await fixture();
    await writeFile(path.join(f.source, "page.txt"), "Approved replacement");
    await f.commit();
    f.afterCommand(async (command) => {
      if (command.args.includes("read-tree")) throw new SandboxCleanupError();
    });
    await expect(f.run()).rejects.toThrow();
    f.afterCommand(undefined);
    await f.restart();
    if (foreignLock) {
      await rm(path.join(f.root, ".git/index.lock"));
      await writeFile(
        path.join(f.root, ".git/index.lock"),
        "Another Git operation",
        { mode: 0o600 },
      );
    } else await writeFile(path.join(f.root, "page.txt"), "New personal edit");
    await expect(f.run()).rejects.toThrow("preserved");
    await f.preserved();
    expect(
      await readFile(
        path.join(f.root, foreignLock ? ".git/index.lock" : "page.txt"),
        "utf8",
      ),
    ).toBe(foreignLock ? "Another Git operation" : "New personal edit");
    expect(await readdir(f.state)).toContain("checkout");
  }
});

it("checks the recovered source against newly retired files before resuming any mutation", async () => {
  const f = await fixture();
  const newlyRetired = "https://fixture.example.test/retired-later.png";
  await writeFile(path.join(f.source, "page.txt"), newlyRetired);
  await f.commit();
  f.afterCommand(async (command) => {
    if (command.args.includes("read-tree")) throw new SandboxCleanupError();
  });
  await expect(f.run()).rejects.toThrow();
  f.afterCommand(undefined);
  await f.restart();
  f.asset.url = newlyRetired;
  const calls = f.calls.length;
  await expect(f.run()).rejects.toThrow("no longer available");
  expect(
    f.calls
      .slice(calls)
      .some(
        (command) =>
          command.args.includes("read-tree") ||
          command.args.includes("update-ref"),
      ),
  ).toBe(false);
  await f.preserved();
  expect(await readFile(path.join(f.root, "page.txt"), "utf8")).toBe(
    newlyRetired,
  );
});

it("repairs a pending checkout for release reconciliation without fetching a new candidate or installing dependencies", async () => {
  const f = await fixture();
  await writeFile(path.join(f.source, "page.txt"), "Approved replacement");
  await f.commit();
  f.afterCommand(async (command) => {
    if (command.args.includes("read-tree")) throw new SandboxCleanupError();
  });
  await expect(f.run()).rejects.toThrow();
  f.afterCommand(undefined);
  await f.restart();
  const count = f.calls.length;
  expect(await f.run(true)).toEqual({
    commit: f.input.commit,
    previousCommit: f.before,
  });
  expect(
    f.calls
      .slice(count)
      .some(
        (command) =>
          command.args.includes("clone") ||
          command.args.includes("fetch") ||
          command.args.includes("install"),
      ),
  ).toBe(false);
  await f.preserved(f.input.commit);
  expect(await readdir(path.join(f.state, "candidates"))).toEqual([]);
  expect(await f.run(true)).toBe(null);
});
