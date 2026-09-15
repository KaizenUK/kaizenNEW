/** Operator-trusted website builds retain their normal files/environment and
 * network access. Their entire process tree still belongs to one build cgroup. */
import { spawn, type ChildProcess } from "node:child_process";
import {
  createBuildGroup,
  defaultBuildLimits,
  enterBuildGroup,
  SandboxCleanupError,
  type SandboxBuild,
  type BuildLimits,
} from "./builder-build-sandbox";

export type ControlledBuild = SandboxBuild & {
  environment: NodeJS.ProcessEnv;
};
export type ControlledCommand = Omit<ControlledBuild, "command"> & {
  executable: string;
  args: readonly string[];
  stdout?: (chunk: Buffer | string) => void;
};

export function runControlledBuild(
  input: ControlledBuild,
  limits: BuildLimits = defaultBuildLimits,
): Promise<number | null> {
  return runControlledCommand(
    {
      ...input,
      executable: process.execPath,
      args: [input.command.cli, "run", "build"],
    },
    limits,
  );
}

export async function runControlledCommand(
  input: ControlledCommand,
  limits: BuildLimits = defaultBuildLimits,
): Promise<number | null> {
  input.signal.throwIfAborted();
  const group = await createBuildGroup(input.id, limits);
  let child: ChildProcess | undefined;
  let stopError: unknown;
  const stops: Promise<void>[] = [];
  const stop = () => {
    // Also stop the trusted launcher if cancellation arrives before it joins.
    child?.kill("SIGKILL");
    stops.push(
      group.stop().catch((error) => {
        stopError = error;
      }),
    );
  };
  input.signal.addEventListener("abort", stop, { once: true });
  let closed: Promise<void> | undefined;
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child = spawn(
        "/usr/bin/python3",
        [
          "-I",
          "-c",
          enterBuildGroup,
          group.path,
          input.executable,
          ...input.args,
        ],
        {
          cwd: input.root,
          env: { ...input.environment, FORCE_COLOR: "0", CI: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      closed = new Promise<void>((done) => child!.once("close", () => done()));
      child.stdout?.on("data", input.stdout || input.log);
      child.stderr?.on("data", input.log);
      child.once("error", reject);
      // A detached descendant may keep stdout open after the manager exits.
      // Wait for exit first, then kill/drain the cgroup, then drain the pipes.
      child.once("exit", resolve);
      if (input.signal.aborted) stop();
    });
    await group.stop();
    await Promise.all(stops);
    if (stopError) throw stopError;
    input.signal.throwIfAborted();
    if (await group.memoryExceeded())
      throw new Error(
        "The build exceeded its memory limit. Reduce its memory use before building again.",
      );
    return code;
  } finally {
    input.signal.removeEventListener("abort", stop);
    await Promise.all(stops);
    try {
      await group.dispose();
    } catch {
      // Never wait forever for inherited pipes when child cleanup is unknown.
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      throw new SandboxCleanupError();
    }
    await closed;
  }
}
