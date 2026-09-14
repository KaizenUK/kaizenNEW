/** Linux client builds: private namespaces, read-only inputs, memory-backed
 * writes and one delegated cgroup. No network or writable host filesystem. */
import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SandboxCommand = { cli: string; manager: "pnpm" | "npm" };
export type SandboxBuild = {
  id: string;
  root: string;
  command: SandboxCommand;
  signal: AbortSignal;
  log: (value: Buffer | string) => void;
};
export type BuildLimits = {
  memoryBytes: number;
  processes: number;
  cpuPercent: number;
};
export const defaultBuildLimits: Readonly<BuildLimits> = Object.freeze({
  memoryBytes: 2 * 1024 ** 3,
  processes: 128,
  cpuPercent: 200,
});
const sourceExclusions = new Set([
  "node_modules",
  "dist",
  ".git",
  ".kaizen",
  ".kaizen-builder",
  ".sanity",
  ".astro",
  ".vite",
  ".ssh",
  ".aws",
  ".config",
  ".cache",
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  "coverage",
  "test-results",
]);
const fail = () =>
  new Error(
    "The isolated build is unavailable. Ask the operator to check its Linux runtime and resource limits.",
  );
function contained(root: string, value: string) {
  const relative = path.relative(root, value);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
async function directory(value: string) {
  const resolved = await realpath(value);
  if (
    resolved !== path.resolve(value) ||
    !(await lstat(resolved)).isDirectory()
  )
    throw fail();
  return resolved;
}
async function copyInputs(
  root: string,
  destination: string,
  signal: AbortSignal,
) {
  let bytes = 0,
    files = 0;
  async function walk(relative: string) {
    signal.throwIfAborted();
    for (const item of await readdir(path.join(root, relative), {
      withFileTypes: true,
    })) {
      if (
        sourceExclusions.has(item.name) ||
        item.name.startsWith(".env") ||
        /\.(?:pem|key)$/i.test(item.name)
      )
        continue;
      signal.throwIfAborted();
      const name = path.join(relative, item.name);
      const source = path.join(root, name),
        target = path.join(destination, name);
      const info = await lstat(source);
      if (++files > 10000 || info.isSymbolicLink())
        throw new Error(
          "Build inputs must be regular files within this website.",
        );
      if (info.isDirectory()) {
        await mkdir(target, { mode: 0o700 });
        await walk(name);
      } else {
        bytes += info.size;
        if (!info.isFile() || bytes > 200 * 1024 ** 2)
          throw new Error("Build inputs exceed the 200 MB source limit.");
        await copyFile(source, target, constants.COPYFILE_EXCL);
      }
    }
  }
  await walk("");
}
async function dependencies(root: string, signal: AbortSignal) {
  const folder = path.join(root, "node_modules");
  const exists = await lstat(folder).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!exists) return undefined;
  await directory(folder);
  let files = 0;
  async function walk(current: string) {
    signal.throwIfAborted();
    for (const item of await readdir(current, { withFileTypes: true })) {
      if (++files > 200000)
        throw new Error(
          "Installed dependencies exceed the supported file limit.",
        );
      const name = path.join(current, item.name);
      if (item.isSymbolicLink()) {
        if (
          path.isAbsolute(await readlink(name)) ||
          !contained(folder, await realpath(name))
        )
          throw new Error(
            "Installed dependency links must be relative and remain inside node_modules.",
          );
      } else if (item.isDirectory()) await walk(name);
      else if (!item.isFile())
        throw new Error(
          "Installed dependencies must contain only regular files and internal links.",
        );
    }
  }
  await walk(folder);
  return folder;
}

async function createBuildGroup(id: string, limits: BuildLimits) {
  if (process.platform !== "linux" || !/^[a-f0-9-]{36}$/.test(id)) throw fail();
  if (
    !Number.isInteger(limits.memoryBytes) ||
    limits.memoryBytes < 64 * 1024 ** 2 ||
    limits.memoryBytes > 2 * 1024 ** 3 ||
    !Number.isInteger(limits.processes) ||
    limits.processes < 8 ||
    limits.processes > 128 ||
    !Number.isInteger(limits.cpuPercent) ||
    limits.cpuPercent < 10 ||
    limits.cpuPercent > 200
  )
    throw fail();
  const membership = (await readFile("/proc/self/cgroup", "utf8")).trim();
  const match = /^0::(\/[^\n]+\/supervisor)$/.exec(membership);
  if (!match || match[1].split("/").some((segment) => segment === ".."))
    throw fail();
  const root = await directory(path.dirname(`/sys/fs/cgroup${match[1]}`));
  const info = await lstat(root);
  if (info.uid !== process.getuid()) throw fail();
  const controllers = (
    await readFile(path.join(root, "cgroup.controllers"), "utf8")
  ).split(/\s+/);
  if (!["cpu", "memory", "pids"].every((name) => controllers.includes(name)))
    throw fail();
  await writeFile(
    path.join(root, "cgroup.subtree_control"),
    "+cpu +memory +pids",
  );
  const group = path.join(root, `build-${id}`);
  await mkdir(group);
  try {
    for (const [file, value] of Object.entries({
      "memory.max": limits.memoryBytes,
      "memory.swap.max": 0,
      "memory.oom.group": 1,
      "pids.max": limits.processes,
      "cpu.max": `${limits.cpuPercent * 1000} 100000`,
    })) {
      await writeFile(path.join(group, file), String(value));
      if (
        (await readFile(path.join(group, file), "utf8")).trim() !==
        String(value)
      )
        throw fail();
    }
  } catch (error) {
    await rmdir(group);
    throw error;
  }
  return {
    path: group,
    async memoryExceeded() {
      return /(?:^|\n)oom_kill [1-9]\d*(?:\n|$)/.test(
        await readFile(path.join(group, "memory.events"), "utf8"),
      );
    },
    async stop() {
      await writeFile(path.join(group, "cgroup.kill"), "1");
    },
    async dispose() {
      await writeFile(path.join(group, "cgroup.kill"), "1");
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          !(await readFile(path.join(group, "cgroup.events"), "utf8")).includes(
            "populated 1",
          )
        ) {
          await rmdir(group);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(
        "The isolated build has processes awaiting cleanup. Ask the operator to check its cgroup.",
      );
    },
  };
}

/** Accept only a bounded regular-file protocol. Even a forged payload cannot
 * choose a host path, make links, exceed the snapshot cap or leave partial data. */
class OutputReader {
  private buffer = Buffer.alloc(0);
  private started = false;
  private ended = false;
  private current?: {
    name: string;
    size: number;
    received: number;
    chunks: Buffer[];
  };
  private total = 0;
  private received = 0;
  readonly files = new Map<string, Buffer>();
  push(chunk: Buffer) {
    this.received += chunk.length;
    if (this.received > 205 * 1024 ** 2)
      throw new Error("Static output exceeds its transfer limit.");
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.ended) {
        if (this.buffer.length)
          throw new Error("Static output continued after completion.");
        return;
      }
      if (this.current) {
        const take = Math.min(
          this.buffer.length,
          this.current.size - this.current.received,
        );
        if (take) this.current.chunks.push(this.buffer.subarray(0, take));
        this.current.received += take;
        this.buffer = this.buffer.subarray(take);
        if (this.current.received < this.current.size) return;
        this.files.set(
          this.current.name,
          Buffer.concat(this.current.chunks, this.current.size),
        );
        this.current = undefined;
        continue;
      }
      const end = this.buffer.indexOf(10);
      if (end > 4096 || (end < 0 && this.buffer.length > 4096))
        throw new Error("Invalid static output framing.");
      if (end < 0) return;
      const header = this.buffer.subarray(0, end).toString("utf8");
      this.buffer = this.buffer.subarray(end + 1);
      if (!this.started) {
        if (header !== "KAIZEN-DIST-1")
          throw new Error("Invalid static output format.");
        this.started = true;
        continue;
      }
      const value = JSON.parse(header);
      if (value?.end === true && Object.keys(value).length === 1) {
        this.ended = true;
        continue;
      }
      const name = value?.path,
        size = value?.bytes;
      if (
        typeof name !== "string" ||
        !name ||
        name.length > 1024 ||
        /[\\\x00-\x1f:]/.test(name) ||
        path.posix.isAbsolute(name) ||
        name
          .split("/")
          .some((segment) => !segment || segment === "." || segment === "..") ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        size > 32 * 1024 ** 2 ||
        this.files.has(`/${name}`) ||
        this.files.size >= 10000
      )
        throw new Error("Invalid static output file.");
      this.total += size;
      if (this.total > 200 * 1024 ** 2)
        throw new Error("Static output exceeds 200 MB.");
      this.current = { name: `/${name}`, size, received: 0, chunks: [] };
    }
  }
  finish() {
    if (
      !this.ended ||
      this.current ||
      this.buffer.length ||
      !this.files.has("/index.html")
    )
      throw new Error(
        "The isolated build did not return a complete static website.",
      );
    return this.files;
  }
}

// This wrapper is trusted and executes before the client's namespaces exist.
// It joins the configured cgroup before any package-manager/client code runs.
const enterGroup =
  "import os,sys; open(sys.argv[1]+'/cgroup.procs','w').write(str(os.getpid())); os.execv(sys.argv[2],sys.argv[2:])";

export async function isolatedBuildCommand(
  cli: string,
): Promise<SandboxCommand> {
  const resolved = await realpath(cli).catch(() => {
    throw fail();
  });
  const manager = /\/bin\/pnpm\.cjs$/.test(resolved)
    ? "pnpm"
    : /\/bin\/npm-cli\.js$/.test(resolved)
      ? "npm"
      : undefined;
  const info = await lstat(resolved);
  if (
    !manager ||
    !info.isFile() ||
    info.mode & 0o022 ||
    ![0, process.getuid()].includes(info.uid)
  )
    throw fail();
  return { cli: resolved, manager };
}

export async function runIsolatedBuild(
  input: SandboxBuild,
  limits = defaultBuildLimits,
) {
  input.signal.throwIfAborted();
  const root = await directory(input.root);
  const command = await isolatedBuildCommand(input.command.cli);
  if (command.manager !== input.command.manager) throw fail();
  const managerRoot = await directory(path.dirname(path.dirname(command.cli)));
  const node = await realpath(process.execPath);
  const nodeRoot = await directory(path.dirname(path.dirname(node)));
  const payload = fileURLToPath(
    new URL("./builder-build-payload.py", import.meta.url),
  );
  const group = await createBuildGroup(input.id, limits);
  let temporary: string | undefined;
  let stopError: unknown;
  let child: ChildProcess | undefined;
  const stop = () => {
    // Kill the launcher too: cancellation may arrive just before it joins the
    // new cgroup. It must not join an already-killed empty group afterwards.
    child?.kill("SIGKILL");
    void group.stop().catch((error) => {
      stopError = error;
    });
  };
  input.signal.addEventListener("abort", stop, { once: true });
  try {
    temporary = await mkdtemp(
      path.join(path.dirname(root), ".build-isolation-"),
    );
    const source = path.join(temporary, "input");
    await mkdir(source, { mode: 0o700 });
    await copyInputs(root, source, input.signal);
    const modules = await dependencies(root, input.signal);
    input.signal.throwIfAborted();
    const args = [
      "--unshare-all",
      "--unshare-user",
      "--unshare-cgroup",
      "--die-with-parent",
      "--new-session",
      "--cap-drop",
      "ALL",
      "--disable-userns",
      "--assert-userns-disabled",
      "--uid",
      "65534",
      "--gid",
      "65534",
      "--hostname",
      "website-build",
      "--clearenv",
      "--ro-bind",
      "/usr",
      "/usr",
      "--symlink",
      "usr/bin",
      "/bin",
      "--symlink",
      "usr/lib",
      "/lib",
      "--symlink",
      "usr/lib64",
      "/lib64",
      "--proc",
      "/proc",
      "--remount-ro",
      "/proc",
      "--dev",
      "/dev",
      "--tmpfs",
      "/tmp",
      "--dir",
      "/tmp/home",
      "--tmpfs",
      "/work",
      "--ro-bind",
      source,
      "/input",
      "--ro-bind",
      payload,
      "/build.py",
      "--ro-bind",
      nodeRoot,
      "/tools/node",
      "--ro-bind",
      managerRoot,
      "/tools/manager",
    ];
    if (modules) args.push("--ro-bind", modules, "/dependencies");
    const environment = {
      PATH: "/tools/node/bin:/tools/manager/bin:/usr/bin:/bin",
      HOME: "/tmp/home",
      TMPDIR: "/tmp",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      CI: "1",
      FORCE_COLOR: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      npm_config_userconfig: "/tmp/npm-user-config",
      npm_config_globalconfig: "/tmp/npm-global-config",
    };
    for (const [key, value] of Object.entries(environment))
      args.push("--setenv", key, value);
    args.push(
      "--chdir",
      "/work",
      "--",
      "/usr/bin/python3",
      "-I",
      "/build.py",
      `/tools/node/bin/${path.basename(node)}`,
      `/tools/manager/bin/${path.basename(command.cli)}`,
    );
    const output = new OutputReader();
    let outputError: unknown;
    const code = await new Promise<number | null>((resolve, reject) => {
      child = spawn(
        "/usr/bin/python3",
        ["-I", "-c", enterGroup, group.path, "/usr/bin/bwrap", ...args],
        {
          cwd: temporary,
          env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => {
        if (outputError) return;
        try {
          output.push(chunk);
        } catch (error) {
          outputError = error;
          stop();
        }
      });
      child.stderr.on("data", input.log);
      child.once("error", reject);
      child.once("close", resolve);
      if (input.signal.aborted) stop();
    });
    // Stop remaining descendants before accepting any output from the build.
    await group.stop();
    input.signal.throwIfAborted();
    if (stopError) throw stopError;
    if (await group.memoryExceeded())
      throw new Error(
        "The isolated build exceeded its memory limit. Reduce its memory use before building again.",
      );
    if (code !== 0)
      throw new Error(
        `The isolated build stopped (code ${code ?? "unknown"}). Check its log or reduce its resource use.`,
      );
    if (outputError) throw outputError;
    return output.finish();
  } finally {
    input.signal.removeEventListener("abort", stop);
    await group.dispose();
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
