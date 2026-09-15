import { execFile } from "node:child_process";
import { lstat, realpath, statfs } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { validProjectId } from "../shared/builderProjects";
import { HostedHelperError } from "./builder-hosted-auth";
import { StorageAdmission } from "./storage-admission.mjs";

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
  private retainedRoots?: readonly string[];
  private admitted?: Promise<StorageAdmission | null>;
  constructor(
    private directory: string,
    limits: HostedDiskLimits = defaultHostedDiskLimits,
    retainedRoots?: readonly string[],
    private admission: () => Promise<StorageAdmission | null> = () =>
      StorageAdmission.fromEnvironment("website-storage"),
  ) {
    validateLimits(limits);
    if (!path.isAbsolute(directory) || path.resolve(directory) !== directory)
      throw unavailable();
    this.limits = Object.freeze({ ...limits });
    if (retainedRoots) {
      if (
        !retainedRoots.length ||
        retainedRoots.length > 8 ||
        retainedRoots.some(
          (root, index) =>
            !path.isAbsolute(root) ||
            path.resolve(root) !== root ||
            retainedRoots.some(
              (other, otherIndex) =>
                index !== otherIndex &&
                (root === other ||
                  root.startsWith(
                    other.endsWith(path.sep) ? other : other + path.sep,
                  )),
            ),
        )
      )
        throw unavailable();
      this.retainedRoots = Object.freeze([...retainedRoots]);
    }
  }
  async sample(projectId: string) {
    if (!validProjectId(projectId)) throw unavailable();
    try {
      // The service validates private parents before work. Recheck their resolved
      // identity here so measurement cannot silently follow a replaced root.
      if ((await realpath(this.directory)) !== this.directory)
        throw unavailable();
      let bytes = 0;
      let freeBytes: bigint | undefined;
      const roots = this.retainedRoots || [
        path.join(this.directory, "projects", projectId),
      ];
      for (const project of roots) {
        const info = await lstat(project).catch((error) => {
          // A new helper project may not exist yet. Installed native roots
          // must exist: a missing retained root is not evidence of zero usage.
          if (error.code === "ENOENT" && !this.retainedRoots) return null;
          throw error;
        });
        const disk = await statfs(info ? project : this.directory, {
          bigint: true,
        });
        const free = disk.bavail * disk.bsize;
        if (freeBytes === undefined || free < freeBytes) freeBytes = free;
        if (!info) continue;
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          (await realpath(project)) !== project
        )
          throw unavailable();
        // Count every retained root, including ignored files, dependencies,
        // caches, candidate history and recovery records. Never follow links.
        // Count hard links at each path, conservatively retaining capacity for
        // a later copy-on-write replacement by the package manager.
        const result = await exec(
          "du",
          [
            "--summarize",
            "--bytes",
            "--count-links",
            "--no-dereference",
            "--",
            project,
          ],
          {
            timeout: 10_000,
            // A tree being written by a package manager reports every file that
            // disappeared while it was walked. Keep that bounded instead of
            // turning an ordinary race into a refusal.
            maxBuffer: 1024 * 1024,
            env: { PATH: process.env.PATH, LANG: "C", LC_ALL: "C" },
          },
        ).catch((error: { stdout?: unknown; stderr?: unknown }) => {
          // Those vanished files also make du exit non-zero although it still
          // reports the total it measured. Accept only that fixed English
          // wording, so an unreadable directory still refuses the measurement.
          const stderr = typeof error.stderr === "string" ? error.stderr : "";
          const vanished = stderr
            .split("\n")
            .filter(Boolean)
            .every((line) => /: No such file or directory$/.test(line));
          if (typeof error.stdout === "string" && stderr && vanished)
            return { stdout: error.stdout, stderr };
          throw error;
        });
        const match = /^(\d+)\t/.exec(result.stdout);
        if (!match) throw unavailable();
        bytes += Number(match[1]);
        if (!Number.isSafeInteger(bytes)) throw unavailable();
      }
      if (freeBytes === undefined) throw unavailable();
      return { bytes, freeBytes };
    } catch {
      // Never expose du stderr, filesystem names, or private environment data.
      throw unavailable();
    }
  }
  /** Shared admission, when configured, for services on this filesystem. */
  private shared() {
    this.admitted ??= this.admission().catch(() => {
      this.admitted = undefined;
      throw unavailable();
    });
    return this.admitted;
  }
  private get target() {
    return this.retainedRoots?.[0] || this.directory;
  }
  async check(
    projectId: string,
    reserveBytes = 0,
    reservation?: { id: string } | null,
  ) {
    if (!Number.isSafeInteger(reserveBytes) || reserveBytes < 0)
      throw unavailable();
    const measured = await this.sample(projectId);
    const admission = await this.shared();
    // Headroom other producers reserved is not available to this one.
    const others = admission
      ? await admission.reserved(this.target, reservation?.id).catch(() => {
          throw unavailable();
        })
      : 0n;
    const sample = { ...measured, freeBytes: measured.freeBytes - others };
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
    const baseline = await this.check(projectId);
    const admission = await this.shared();
    // Reserve this work's remaining allowance, capped and limited to what is
    // shareable now; the work is stopped if it grows past that reservation.
    const reservation = admission
      ? await admission
          .reserve(this.target, {
            minimum: 0,
            maximum: Math.max(0, this.limits.projectBytes - baseline.bytes),
            floor: this.limits.freeBytes,
          })
          .catch((error: { admissionRefused?: boolean; message?: string }) => {
            throw error?.admissionRefused
              ? new HostedHelperError(409, error.message!)
              : unavailable();
          })
      : null;
    const within = async () => {
      const current = await this.check(projectId, 0, reservation);
      if (reservation && current.bytes - baseline.bytes > reservation.bytes)
        throw new HostedHelperError(
          409,
          "This work needed more disk space than it could reserve alongside other work. Existing files are kept. Try again after other work finishes.",
        );
    };
    let pending: Promise<void> | undefined;
    let failure: HostedHelperError | undefined;
    let closed = false;
    const timer = setInterval(() => {
      if (closed || pending || failure) return;
      pending = within()
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
      try {
        await pending;
        if (failure) throw failure;
        await within();
      } finally {
        await reservation?.release().catch(() => {});
      }
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
      // A storage refusal must never hide uncertain process cleanup. Native
      // callers use this marker to keep their operation and recovery files.
      if (
        (error as { nativeRecoveryRequired?: boolean })?.nativeRecoveryRequired
      )
        throw error;
      throw failure || error;
    }
  }
}

/** The fixed native service owns its checkout and private worker state under
 * one deployment lock. Re-measure both after restarts; do not trust a stored
 * byte counter or leave the package-manager store outside the allowance. */
export function nativeDiskGuard(
  root: string,
  state: string,
  env: NodeJS.ProcessEnv,
) {
  return new HostedDiskGuard(
    state,
    hostedDiskLimits({
      BUILDER_HOSTED_PROJECT_MAX_BYTES: env.BUILDER_NATIVE_STORAGE_MAX_BYTES,
      BUILDER_HOSTED_MIN_FREE_BYTES: env.BUILDER_NATIVE_MIN_FREE_BYTES,
      BUILDER_HOSTED_DISK_CHECK_MS: env.BUILDER_NATIVE_DISK_CHECK_MS,
    }),
    [root, state],
    () => StorageAdmission.fromEnvironment("native-deployment", env),
  );
}
