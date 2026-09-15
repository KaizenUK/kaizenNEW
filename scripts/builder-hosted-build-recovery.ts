import { createHash } from "node:crypto";
import { lstat, open, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { HostedHelperError } from "./builder-hosted-auth";
import {
  unlinkedPath,
  type HostedWebsiteFolders,
} from "./builder-hosted-folders";
import { HostedReceiptStore, receiptError } from "./builder-hosted-receipts";
import type { BuildJob } from "./builder-runner";

type BuildReceipt = {
  id: string;
  binding: string;
  fingerprint: string;
  startedAt: string;
  phase: "running" | "finished" | "recovery_required" | "pruning";
  finishedAt?: string;
  outcome?: "succeeded" | "failed" | "cancelled";
};
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const timestamp = (value: unknown) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const recoveryError = () =>
  new HostedHelperError(
    409,
    "A previous build needs an operator check before this website can change. Your source and recovery files are kept.",
  );

function decode(value: unknown): BuildReceipt[] {
  if (!Array.isArray(value) || value.length > 24) throw receiptError();
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !uuid.test(item.id) ||
      ids.has(item.id) ||
      !hash.test(item.binding) ||
      !hash.test(item.fingerprint) ||
      !timestamp(item.startedAt) ||
      !["running", "finished", "recovery_required", "pruning"].includes(
        item.phase,
      ) ||
      Object.keys(item).some(
        (key) =>
          ![
            "id",
            "binding",
            "fingerprint",
            "startedAt",
            "phase",
            "finishedAt",
            "outcome",
          ].includes(key),
      ) ||
      (item.phase === "running"
        ? item.finishedAt !== undefined || item.outcome !== undefined
        : !timestamp(item.finishedAt) ||
          Date.parse(item.finishedAt) < Date.parse(item.startedAt) ||
          !["succeeded", "failed", "cancelled"].includes(item.outcome))
    )
      throw receiptError();
    ids.add(item.id);
  }
  return value;
}

/** Build intents survive restarts. All record access is under the project lock. */
export class HostedBuildRecovery {
  private records: HostedReceiptStore<BuildReceipt[]>;
  private observed = new Map<string, BuildReceipt[]>();
  private active = new Set<string>();
  constructor(private folders: HostedWebsiteFolders) {
    this.records = new HostedReceiptStore(
      folders,
      "build-receipts.json",
      decode,
      () => [],
    );
  }
  private binding(projectId: string) {
    const config = this.folders.configuration(projectId);
    return createHash("sha256")
      .update(
        JSON.stringify([
          this.folders.root(projectId),
          config.repositoryUrl,
          config.branch,
        ]),
      )
      .digest("hex");
  }
  async refresh(projectId: string) {
    this.observed.set(projectId, await this.records.read(projectId));
  }
  assertCanOperate(projectId: string, reconfigure = false) {
    const records = this.observed.get(projectId);
    if (!records) throw receiptError();
    if (
      records.some(
        (record) =>
          record.phase === "recovery_required" ||
          (record.phase === "running" &&
            (reconfigure ||
              !this.active.has(record.id) ||
              record.binding !== this.binding(projectId))) ||
          (reconfigure && record.phase === "pruning"),
      )
    )
      throw recoveryError();
  }
  async forget(projectId: string) {
    this.assertCanOperate(projectId, true);
    // Settings preserves the old checkout in previous-setups. Never clean that archive.
    await this.records.write(projectId, []);
    this.observed.set(projectId, []);
  }
  private directory(projectId: string, id: string) {
    if (!uuid.test(id)) throw receiptError();
    return path.join(
      this.folders.root(projectId),
      ".kaizen/build-recovery",
      id,
    );
  }
  /** Only known generated trees qualify. Unexpected files, links or mount devices are preserved. */
  private async removable(directory: string, checkout: string) {
    await unlinkedPath(directory);
    const device = (await lstat(checkout)).dev;
    // A recovery parent or the candidate itself may be a separate mount.
    for (const folder of [
      path.join(checkout, ".kaizen"),
      path.dirname(directory),
    ]) {
      const info = await lstat(folder).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      if (!info) return true;
      if (!info.isDirectory() || info.dev !== device) return false;
    }
    const root = await lstat(directory).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (!root) return true;
    if (!root.isDirectory() || root.dev !== device) return false;
    let entries = 0;
    const walk = async (folder: string, top = false): Promise<boolean> => {
      for (const name of await readdir(folder)) {
        if (
          ++entries > 100_000 ||
          (top && !["previous-dist", "failed-dist"].includes(name))
        )
          return false;
        const item = path.join(folder, name),
          info = await lstat(item);
        if (
          info.dev !== root.dev ||
          info.isSymbolicLink() ||
          (!info.isDirectory() && (!info.isFile() || info.nlink !== 1)) ||
          (top && !info.isDirectory())
        )
          return false;
        if (info.isDirectory() && !(await walk(item))) return false;
      }
      return true;
    };
    return walk(directory, true);
  }
  private async prune(projectId: string) {
    let records = this.observed.get(projectId)!;
    const completed = records
      .filter((record) => record.phase === "finished")
      .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!));
    const keep = new Set(completed.slice(0, 2).map((record) => record.id));
    for (const record of [...records]) {
      if (
        (record.phase !== "finished" && record.phase !== "pruning") ||
        keep.has(record.id)
      )
        continue;
      if (record.binding !== this.binding(projectId)) throw recoveryError();
      const directory = this.directory(projectId, record.id);
      // No destructive action on unrecognised data, even with a terminal receipt.
      if (!(await this.removable(directory, this.folders.root(projectId))))
        continue;
      const pruning = { ...record, phase: "pruning" as const };
      records = records.map((item) => (item.id === record.id ? pruning : item));
      await this.records.write(projectId, records);
      this.observed.set(projectId, records);
      if (!(await this.removable(directory, this.folders.root(projectId))))
        throw recoveryError();
      await rm(directory, { recursive: true, force: true });
      const parent = await open(path.dirname(directory), "r").catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      try {
        await parent?.sync();
      } finally {
        await parent?.close();
      }
      records = records.filter((item) => item.id !== record.id);
      await this.records.write(projectId, records);
      this.observed.set(projectId, records);
    }
  }
  async begin(job: BuildJob, fingerprint: string) {
    await this.folders.locked(job.projectId, async () => {
      await this.refresh(job.projectId);
      this.assertCanOperate(job.projectId);
      if (
        this.observed
          .get(job.projectId)!
          .some((record) => record.phase === "running")
      )
        throw recoveryError();
      if (
        job.root !== this.folders.root(job.projectId) ||
        job.recoveryDirectory !== this.directory(job.projectId, job.id)
      )
        throw receiptError();
      // Retention runs before capacity admission, so old generated output can free space.
      // A pruning receipt is resumable, but never replays a build or restores source.
      await this.prune(job.projectId);
      const records = this.observed.get(job.projectId)!;
      if (
        records.length >= 24 ||
        records.some((record) => record.id === job.id)
      )
        throw recoveryError();
      await unlinkedPath(job.recoveryDirectory);
      if (
        await lstat(job.recoveryDirectory).catch((error) => {
          if (error.code !== "ENOENT") throw error;
          return null;
        })
      )
        throw recoveryError();
      const receipt: BuildReceipt = {
        id: job.id,
        binding: this.binding(job.projectId),
        fingerprint,
        startedAt: job.startedAt!,
        phase: "running",
      };
      await this.records.write(job.projectId, [...records, receipt]);
      this.observed.set(job.projectId, [...records, receipt]);
      this.active.add(job.id);
    });
  }
  async finish(job: BuildJob) {
    try {
      await this.folders.locked(job.projectId, async () => {
        await this.refresh(job.projectId);
        const records = this.observed.get(job.projectId)!;
        const receipt = records.find((record) => record.id === job.id);
        if (
          !receipt ||
          receipt.phase !== "running" ||
          receipt.binding !== this.binding(job.projectId) ||
          !this.active.has(job.id) ||
          !["succeeded", "failed", "cancelled"].includes(job.status)
        )
          throw receiptError();
        const finished: BuildReceipt = {
          ...receipt,
          phase: job.recoveryRequired ? "recovery_required" : "finished",
          finishedAt: job.finishedAt!,
          outcome: job.status as BuildReceipt["outcome"],
        };
        const next = records.map((item) =>
          item.id === job.id ? finished : item,
        );
        await this.records.write(job.projectId, next);
        this.observed.set(job.projectId, next);
      });
    } finally {
      this.active.delete(job.id);
    }
  }
}
