/** Prepare only the dedicated deployment checkout. Candidate Git data is
 * validated before authoritative files change; the caller owns build.lock
 * and holds one native operation across this function and release work. */
import { randomUUID } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import {
  runControlledCommand,
  type ControlledCommand,
} from "./builder-controlled-build";
import { privateDirectory, unlinkedPath } from "./builder-hosted-folders";
import type { NativeFileProtection } from "./builder-native-operations";
import type { SandboxCommand } from "./builder-build-sandbox";
import { NativeCheckoutRecovery } from "./builder-native-checkout-recovery";
import type { NativeOperationController } from "./builder-native-controller";
import { nativeDiskGuard } from "./builder-hosted-disk";
import { NativeCandidates } from "./builder-native-candidates";
import { NativePackageCache } from "./builder-native-package-cache";

export type NativeCheckoutInput = {
  root: string;
  state: string;
  repository: string;
  branch: "main" | "stage";
  commit: string;
  environment: NodeJS.ProcessEnv;
  command: SandboxCommand;
  signal: AbortSignal;
  files: NativeFileProtection;
  controller?: NativeOperationController;
  log: (chunk: Buffer | string) => void;
};
const fail = (message: string) =>
  new Error(`Deployment preparation: ${message}`);
const gone = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";

type CommandAdapter = {
  run?: (input: ControlledCommand) => Promise<number | null>;
};
export function prepareNativeCheckout(
  input: NativeCheckoutInput,
  adapters: CommandAdapter = {},
) {
  return updateNativeCheckout(input, adapters, false);
}
export function recoverNativeCheckout(
  input: NativeCheckoutInput,
  adapters: CommandAdapter = {},
) {
  return updateNativeCheckout(input, adapters, true);
}
async function updateNativeCheckout(
  input: NativeCheckoutInput,
  adapters: CommandAdapter,
  recoverOnly: boolean,
) {
  if (
    (!(recoverOnly && input.commit === "") &&
      !/^[a-f0-9]{40}$/.test(input.commit)) ||
    !["main", "stage"].includes(input.branch) ||
    !path.isAbsolute(input.root) ||
    !path.isAbsolute(input.state) ||
    !input.repository ||
    input.command.manager !== "pnpm"
  )
    throw fail("Invalid fixed destination or source commit.");
  await unlinkedPath(input.root);
  if (
    (await realpath(input.root)) !== input.root ||
    !(await lstat(path.join(input.root, ".git"))).isDirectory()
  )
    throw fail("Use the existing dedicated Git checkout.");
  const relative = path.relative(input.root, input.state);
  const inverse = path.relative(input.state, input.root);
  const outside = (value: string) =>
    value === ".." ||
    value.startsWith(`..${path.sep}`) ||
    path.isAbsolute(value);
  if (!outside(relative) || !outside(inverse))
    throw fail("Keep worker state outside the website checkout.");
  await privateDirectory(input.state);
  const candidates = path.join(input.state, "candidates");
  await privateDirectory(candidates);
  const run = async (
    root: string,
    executable: string,
    args: string[],
    capture = false,
    index?: string,
    commandEnvironment = input.environment,
  ) => {
    input.signal.throwIfAborted();
    const abort = new AbortController();
    const stop = () => abort.abort(input.signal.reason);
    input.signal.addEventListener("abort", stop, { once: true });
    let output = "",
      oversized = false;
    try {
      const code = await (adapters.run || runControlledCommand)({
        id: randomUUID(),
        root,
        executable,
        args,
        signal: abort.signal,
        environment: {
          ...commandEnvironment,
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
          GIT_OPTIONAL_LOCKS: "0",
          GIT_CONFIG_COUNT: undefined,
          GIT_CONFIG_PARAMETERS: undefined,
          GIT_DIR: undefined,
          GIT_WORK_TREE: undefined,
          GIT_INDEX_FILE: index,
          GIT_OBJECT_DIRECTORY: undefined,
          GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
        },
        log: input.log,
        ...(capture
          ? {
              stdout: (chunk: Buffer | string) => {
                if (oversized) return;
                output += chunk.toString();
                if (Buffer.byteLength(output) > 2 * 1024 ** 2) {
                  oversized = true;
                  abort.abort(
                    fail("Git output exceeded its bounded response."),
                  );
                }
              },
            }
          : {}),
      });
      if (oversized || code !== 0)
        throw fail(
          "The checked command failed. Existing releases are preserved.",
        );
      return output;
    } finally {
      input.signal.removeEventListener("abort", stop);
    }
  };
  const git = (
    root: string,
    args: string[],
    capture = false,
    local = false,
    index?: string,
  ) =>
    run(
      root,
      "/usr/bin/git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        "-c",
        `safe.directory=${root}`,
        "-c",
        `protocol.file.allow=${local ? "always" : "never"}`,
        ...args,
      ],
      capture,
      index,
    );
  const recovery = new NativeCheckoutRecovery({
    ...input,
    git: (args, index) => git(input.root, args, true, false, index),
  });
  const recovered = await recovery.recover();
  const retained = new NativeCandidates({
    ...input,
    protectedCandidate: () => recovery.protectedCandidate(),
  });
  if (!(await retained.prune()))
    throw fail(
      "The previous deployment candidate still has running work. Its files are preserved.",
    );
  if (recoverOnly) return recovered;
  // Finish a known checkout transaction even when retained storage is full.
  // Admission to new Git/dependency work follows that recovery boundary.
  const disk = nativeDiskGuard(input.root, input.state, input.environment);
  const projectId = input.files.operation?.projectId;
  if (!projectId) throw fail("A coordinated native operation is required.");
  const cache = new NativePackageCache(
    input.root,
    input.state,
    input.environment,
  );
  const reserve = 200 * 1024 ** 2;
  const sample = await disk.sample(projectId);
  try {
    // Maintenance can release capacity before admission to growing commands.
    // The enclosing native journal and deployment lock also cover this command.
    await cache.prune({
      signal: input.signal,
      pressured:
        sample.bytes + reserve > disk.limits.projectBytes ||
        sample.freeBytes < BigInt(disk.limits.freeBytes + reserve),
      run: async (args, environment) => {
        await run(
          input.state,
          process.execPath,
          [input.command.cli, ...args],
          false,
          undefined,
          environment,
        );
      },
      log: input.log,
    });
  } catch (error) {
    if ((error as { nativeRecoveryRequired?: boolean })?.nativeRecoveryRequired)
      input.files.retainOperation();
    throw error;
  }
  const signal = input.signal;
  return disk.run(projectId, async (storageSignal) => {
    input = { ...input, signal: AbortSignal.any([signal, storageSignal]) };
    // A complete supported source tree can add 200 MiB while the prior checkout
    // remains recoverable. Unknown Git/dependency growth is monitored throughout.
    await disk.check(projectId, reserve);
    await cache.prepare();
    // Preserve pending tracked edits and every unrelated untracked/ignored file.
    if (
      (
        await git(
          input.root,
          ["status", "--porcelain", "--untracked-files=no"],
          true,
        )
      ).trim()
    )
      throw fail(
        "The deployment checkout has local edits. They have been preserved.",
      );
    const before = (await git(input.root, ["rev-parse", "HEAD"], true)).trim();
    const tracked = new Set(
      (await git(input.root, ["ls-files", "-z"], true))
        .split("\0")
        .filter(Boolean),
    );
    const candidate = await retained.create();
    let cleanup = true;
    try {
      await git(
        candidate,
        [
          "clone",
          "--no-checkout",
          "--single-branch",
          "--branch",
          input.branch,
          "--",
          input.repository,
          candidate,
        ],
        false,
        path.isAbsolute(input.repository),
      );
      await git(candidate, ["cat-file", "-e", `${input.commit}^{commit}`]);
      await git(candidate, [
        "merge-base",
        "--is-ancestor",
        input.commit,
        `refs/remotes/origin/${input.branch}`,
      ]);
      await git(candidate, ["checkout", "--detach", input.commit]);
      await input.files.assertRepository(candidate, input.signal);
      const names = (
        await git(
          candidate,
          ["ls-tree", "-r", "--name-only", "-z", input.commit],
          true,
        )
      )
        .split("\0")
        .filter(Boolean);
      if (names.length > 10000)
        throw fail("The candidate contains too many source files.");
      const privateCollision = () =>
        fail(
          "A candidate would replace a private or untracked file. It has been preserved.",
        );
      // Git may remove a directory when the new commit replaces it with a file.
      // Check the real directory, including ignored files and empty directories.
      const trackedDirectory = async (name: string): Promise<void> => {
        const entries = await readdir(path.join(input.root, name), {
          withFileTypes: true,
        });
        if (!entries.length) throw privateCollision();
        for (const entry of entries) {
          const relative = `${name}/${entry.name}`;
          if (entry.isDirectory()) await trackedDirectory(relative);
          else if (!tracked.has(relative)) throw privateCollision();
        }
      };
      for (const name of names) {
        if (
          name.startsWith("/") ||
          name.split("/").some((part) => !part || part === "." || part === "..")
        )
          throw fail("Invalid candidate path.");
        let prefix = "";
        for (const part of name.split("/")) {
          prefix = prefix ? `${prefix}/${part}` : part;
          const info = await lstat(path.join(input.root, prefix)).catch(
            (error) => {
              if (!gone(error)) throw error;
              return null;
            },
          );
          if (!info) break;
          if (info.isDirectory()) {
            if (prefix === name) await trackedDirectory(prefix);
          } else {
            if (!tracked.has(prefix)) throw privateCollision();
            // A tracked file becomes a directory; its candidate children cannot
            // collide with existing files below this non-directory prefix.
            break;
          }
        }
      }
      if (
        (await git(input.root, ["rev-parse", "HEAD"], true)).trim() !==
          before ||
        (
          await git(
            input.root,
            ["status", "--porcelain", "--untracked-files=no"],
            true,
          )
        ).trim()
      )
        throw fail("The deployment checkout changed during candidate review.");
      await git(
        input.root,
        ["fetch", "--no-tags", candidate, input.commit],
        false,
        true,
      );
      if (before !== input.commit)
        await recovery.apply(before, input.commit, candidate);
      await input.files.assertRepository(input.root, input.signal);
      await run(input.root, process.execPath, [
        input.command.cli,
        "install",
        "--frozen-lockfile",
        "--prod=false",
        ...cache.arguments(),
      ]);
      const studio = path.join(input.root, "apps/studio/package.json");
      if (
        await lstat(studio).catch((error) => {
          if (!gone(error)) throw error;
          return null;
        })
      )
        await run(input.root, process.execPath, [
          input.command.cli,
          "--dir",
          "apps/studio",
          "install",
          "--frozen-lockfile",
          "--prod=false",
          ...cache.arguments(),
        ]);
      await input.files.assertRepository(input.root, input.signal);
      return { commit: input.commit, previousCommit: before };
    } catch (error) {
      if (
        (error as { nativeRecoveryRequired?: boolean })?.nativeRecoveryRequired
      ) {
        cleanup = false;
        input.files.retainOperation();
      }
      throw error;
    } finally {
      if (cleanup) {
        await retained.stopped(candidate);
        await retained.prune();
      }
    }
  });
}
