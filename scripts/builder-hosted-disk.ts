import { execFile } from "node:child_process";
import { lstat, realpath, statfs } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validProjectId } from "../shared/builderProjects";
import { HostedHelperError } from "./builder-hosted-auth";

const exec = promisify(execFile);
const GiB = 1024 ** 3;
export type HostedDiskLimits = {
  projectBytes: number;
  freeBytes: number;
  intervalMs: number;
};
export const defaultHostedDiskLimits: HostedDiskLimits = {
  projectBytes: 8 * GiB,
  freeBytes: 2 * GiB,
  intervalMs: 2000,
};
const unavailable = () =>
  new HostedHelperError(
    503,
    "The helper could not check website storage. Ask the operator to check it before adding files.",
  );

export function hostedDiskLimits(env: NodeJS.ProcessEnv): HostedDiskLimits {
  const values = {
    projectBytes: env.BUILDER_HOSTED_PROJECT_MAX_BYTES,
    freeBytes: env.BUILDER_HOSTED_MIN_FREE_BYTES,
    intervalMs: env.BUILDER_HOSTED_DISK_CHECK_MS,
  };
  const result = { ...defaultHostedDiskLimits };
  for (const key of Object.keys(values) as (keyof HostedDiskLimits)[]) {
    const value = values[key];
    if (value === undefined) continue;
    if (!/^(0|[1-9][0-9]*)$/.test(value)) throw unavailable();
    result[key] = Number(value);
  }
  validateLimits(result);
  return result;
}
function validateLimits(value: HostedDiskLimits) {
  if (
    !Object.values(value).every(Number.isSafeInteger) ||
    value.projectBytes < 1 ||
    value.projectBytes > 1024 * GiB ||
    value.freeBytes < 0 ||
    value.freeBytes > 1024 * GiB ||
    value.intervalMs < 100 ||
    value.intervalMs > 30_000
  )
    throw unavailable();
}

/** Operational bounds for trusted hosted builds, not an isolation boundary or hard filesystem quota. */
export class HostedDiskGuard {
  readonly limits: Readonly<HostedDiskLimits>;
  constructor(
    private directory: string,
    limits: HostedDiskLimits = defaultHostedDiskLimits,
  ) {
    validateLimits(limits);
    if (!path.isAbsolute(directory) || path.resolve(directory) !== directory)
      throw unavailable();
    this.limits = Object.freeze({ ...limits });
  }
  async sample(projectId: string) {
    if (!validProjectId(projectId)) throw unavailable();
    const project = path.join(this.directory, "projects", projectId);
    try {
      // The service validates private parents before work. Recheck their resolved
      // identity here so measurement cannot silently follow a replaced root.
      if ((await realpath(this.directory)) !== this.directory)
        throw unavailable();
      const info = await lstat(project).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      let bytes = 0;
      if (info) {
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          (await realpath(project)) !== project
        )
          throw unavailable();
        // GNU du does not follow symlinks and stays on this filesystem. Count
        // apparent bytes too, so sparse build output cannot evade the limit.
        const result = await exec(
          "du",
          [
            "--summarize",
            "--bytes",
            "--one-file-system",
            "--no-dereference",
            "--",
            project,
          ],
          {
            timeout: 10_000,
            maxBuffer: 4096,
            env: { PATH: process.env.PATH, LANG: "C", LC_ALL: "C" },
          },
        );
        const match = /^(\d+)\t/.exec(result.stdout);
        if (!match) throw unavailable();
        bytes = Number(match[1]);
        if (!Number.isSafeInteger(bytes)) throw unavailable();
      }
      const disk = await statfs(this.directory, { bigint: true });
      const free = disk.bavail * disk.bsize;
      return { bytes, freeBytes: free };
    } catch {
      // Never expose du stderr, filesystem names, or private environment data.
      throw unavailable();
    }
  }
  async check(projectId: string, reserveBytes = 0) {
    if (!Number.isSafeInteger(reserveBytes) || reserveBytes < 0)
      throw unavailable();
    const sample = await this.sample(projectId);
    if (sample.bytes + reserveBytes > this.limits.projectBytes)
      throw new HostedHelperError(
        409,
        "This website has reached its storage limit. Existing files are kept. Ask the operator to free generated output before building or adding files.",
      );
    if (sample.freeBytes < BigInt(this.limits.freeBytes) + BigInt(reserveBytes))
      throw new HostedHelperError(
        409,
        "The helper is short of free disk space. Existing files are kept. Ask the operator to free storage before building or adding files.",
      );
    return sample;
  }
  /** Serial samples; stop() waits for an outstanding check before reporting completion. */
  async watch(
    projectId: string,
    stop: (error: HostedHelperError) => Promise<void>,
  ) {
    await this.check(projectId);
    let pending: Promise<void> | undefined;
    let failure: HostedHelperError | undefined;
    let closed = false;
    const timer = setInterval(() => {
      if (closed || pending || failure) return;
      pending = this.check(projectId)
        .then(() => {})
        .catch(async (error) => {
          failure = error instanceof HostedHelperError ? error : unavailable();
          await stop(failure);
        })
        .catch(() => {
          failure ??= unavailable();
        })
        .finally(() => {
          pending = undefined;
        });
    }, this.limits.intervalMs);
    timer.unref();
    return async () => {
      closed = true;
      clearInterval(timer);
      await pending;
      if (failure) throw failure;
      await this.check(projectId);
    };
  }
  async run<T>(projectId: string, work: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController();
    let failure: HostedHelperError | undefined;
    const stop = await this.watch(projectId, async (error) => {
      failure = error;
      controller.abort();
    });
    try {
      const value = await work(controller.signal);
      await stop();
      return value;
    } catch (error) {
      await stop().catch((checkError) => {
        failure ??= checkError;
      });
      throw failure || error;
    }
  }
}
