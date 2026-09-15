import { randomUUID } from "node:crypto";
import { HostedHelperError, type RepositoryActor } from "./builder-hosted-auth";
import type { HostedWebsiteFolders } from "./builder-hosted-folders";
import type { RepositoryRunner, BuildJob, BuildPlan } from "./builder-runner";

const logLimit = 100_000;
type Entry = {
  value: BuildJob;
  actor: RepositoryActor;
  token?: string;
  plan: BuildPlan;
  runnerId?: string;
  claimed?: boolean;
  cancelRequested?: boolean;
  cancelling?: Promise<unknown>;
};
type Adapters = {
  folders: HostedWebsiteFolders;
  authorize: (token: string, projectId: string) => Promise<void>;
  runner: (projectId: string) => RepositoryRunner;
  beforePreview?: (
    token: string,
    plan: BuildPlan,
    files: ReadonlyMap<string, Buffer>,
    fingerprint: string,
  ) => Promise<void>;
};
const active = (job: BuildJob) =>
  job.status === "queued" || job.status === "building";

/** A claimed build never retries. Its project lock outlives cancellation and output recovery. */
export class HostedBuildQueue {
  private entries = new Map<string, Entry>();
  private running = new Map<string, Promise<void>>();
  private closed = false;
  private scheduled = false;
  assertIdle(projectId: string) {
    if (
      [...this.entries.values()].some(
        (entry) => entry.value.projectId === projectId && active(entry.value),
      )
    )
      throw new HostedHelperError(
        409,
        "Finish or cancel this project's builds before changing its repository settings.",
      );
  }
  constructor(
    private adapters: Adapters,
    private concurrency = 2,
  ) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
      throw new Error("Choose between one and eight concurrent hosted builds.");
  }
  enqueue(plan: BuildPlan, actor: RepositoryActor, token: string): BuildJob {
    if (this.closed)
      throw new HostedHelperError(
        503,
        "The hosted helper is restarting. Reconnect shortly.",
      );
    if (plan.expiresAt <= Date.now())
      throw new HostedHelperError(
        409,
        "The build review expired. Review the command again.",
      );
    const jobs = [...this.entries.values()];
    if (
      jobs.filter(
        (entry) =>
          entry.value.projectId === plan.projectId && active(entry.value),
      ).length >= 8 ||
      jobs.filter((entry) => active(entry.value)).length >= 64
    )
      throw new HostedHelperError(
        429,
        "The build queue is full. Wait for a build to finish or cancel one before adding another.",
      );
    const retained = jobs.filter(
      (entry) =>
        entry.value.projectId === plan.projectId && !active(entry.value),
    );
    while (retained.length >= 12)
      this.entries.delete(retained.shift()!.value.id);
    const id = randomUUID();
    const entry: Entry = {
      actor: { ...actor },
      token,
      plan: structuredClone(plan),
      value: {
        id,
        projectId: plan.projectId,
        root: plan.root,
        command: plan.command,
        status: "queued",
        queuedAt: new Date().toISOString(),
        log: "Waiting for an available build slot.\n",
        recoveryDirectory: "",
      },
    };
    this.entries.set(id, entry);
    this.schedule();
    return this.snapshot(entry);
  }
  private require(projectId: string, actorId: string, jobId: unknown) {
    const entry =
      typeof jobId === "string" ? this.entries.get(jobId) : undefined;
    if (
      !entry ||
      entry.value.projectId !== projectId ||
      entry.actor.id !== actorId
    )
      throw new HostedHelperError(
        410,
        "This build is not available in your project and account. Review a new build if the helper restarted.",
      );
    return entry;
  }
  status(projectId: string, actorId: string, jobId: unknown) {
    return this.snapshot(this.require(projectId, actorId, jobId));
  }
  previewJob(projectId: string, actorId: string, jobId: unknown) {
    const entry = this.require(projectId, actorId, jobId);
    if (entry.value.status !== "succeeded" || !entry.runnerId)
      throw new HostedHelperError(
        409,
        "Finish building this website before opening its preview.",
      );
    const runner = this.adapters.runner(projectId);
    let job: BuildJob;
    try {
      job = runner.status(entry.runnerId, projectId);
    } catch {
      throw new HostedHelperError(
        410,
        "This preview expired or closed. Build the website again.",
      );
    }
    if (
      !job.previewUrl ||
      !job.previewExpiresAt ||
      job.previewExpiresAt <= Date.now()
    )
      throw new HostedHelperError(
        410,
        "This preview expired or closed. Build the website again.",
      );
    return { runner, job };
  }
  private snapshot(entry: Entry) {
    const value = structuredClone(entry.value);
    if (value.status === "building" && entry.runnerId) {
      const current = this.adapters
        .runner(value.projectId)
        .status(entry.runnerId, value.projectId);
      value.log = current.log.slice(-logLimit);
      value.recoveryDirectory = current.recoveryDirectory;
      // Terminal means the runner, its recovery and the service's build lock have all finished.
    }
    if (value.status === "queued") {
      value.queuePosition =
        [...this.entries.values()]
          .filter(
            (other) =>
              other.value.projectId === value.projectId && active(other.value),
          )
          .findIndex((other) => other === entry) + 1;
    }
    if (entry.cancelRequested && active(value)) value.cancelling = true;
    // The loopback snapshot belongs to the VPS. HTTPS presentation is added by the preview service.
    delete value.previewUrl;
    delete value.previewExpiresAt;
    return value;
  }
  cancel(projectId: string, actorId: string, jobId: unknown) {
    const entry = this.require(projectId, actorId, jobId);
    if (!active(entry.value)) {
      if (entry.runnerId) void this.stop(entry);
      return this.snapshot(entry);
    }
    entry.cancelRequested = true;
    if (entry.value.status === "queued" && !entry.claimed) {
      this.finish(entry, "cancelled", "Build cancelled before it started.");
    } else if (entry.runnerId) void this.stop(entry);
    this.schedule();
    return this.snapshot(entry);
  }
  private stop(entry: Entry) {
    if (!entry.cancelling && entry.runnerId)
      entry.cancelling = this.adapters
        .runner(entry.value.projectId)
        .cancel(entry.runnerId, entry.value.projectId)
        .catch(() => {
          entry.value.error =
            "The build could not be stopped yet. It may still be running; ask the operator to check it.";
        });
    return entry.cancelling;
  }
  private finish(entry: Entry, status: BuildJob["status"], message?: string) {
    entry.value.status = status;
    entry.value.finishedAt = new Date().toISOString();
    delete entry.token;
    delete entry.value.cancelling;
    if (message) {
      entry.value.error = message;
      entry.value.log = (entry.value.log + message + "\n").slice(-logLimit);
    }
  }
  private schedule() {
    if (this.scheduled || this.closed) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.closed) return;
      for (const entry of this.entries.values()) {
        if (this.running.size >= this.concurrency) break;
        if (
          entry.value.status !== "queued" ||
          this.running.has(entry.value.projectId)
        )
          continue;
        const projectId = entry.value.projectId;
        entry.claimed = true;
        const work = this.execute(entry).finally(() => {
          this.running.delete(projectId);
          this.schedule();
        });
        this.running.set(projectId, work);
      }
    });
  }
  private async execute(entry: Entry) {
    const projectId = entry.value.projectId;
    let release: (() => Promise<void>) | undefined;
    let result: BuildJob | undefined;
    try {
      const runner = this.adapters.runner(projectId);
      await this.adapters.folders.locked(projectId, async () => {
        if (entry.cancelRequested || this.closed) return;
        await this.adapters.authorize(entry.token!, projectId);
        if (entry.cancelRequested || this.closed) return;
        const token = entry.token!;
        delete entry.token;
        await this.adapters.folders.check(projectId);
        release = await this.adapters.folders.claimBuild(
          projectId,
          entry.value.id,
        );
        if (entry.cancelRequested || this.closed) return;
        const started = await runner.start(
          entry.plan.id,
          projectId,
          this.adapters.beforePreview
            ? async (files, fingerprint) => {
                await this.adapters.authorize(token, projectId);
                await this.adapters.beforePreview!(
                  token,
                  entry.plan,
                  files,
                  fingerprint,
                );
              }
            : undefined,
        );
        entry.runnerId = started.id;
        entry.value = {
          ...started,
          id: entry.value.id,
          queuedAt: entry.value.queuedAt,
          status: "building",
        };
        if (entry.cancelRequested || this.closed) void this.stop(entry);
      });
      if (entry.runnerId) result = await runner.wait(entry.runnerId, projectId);
    } catch (error) {
      const message =
        error instanceof HostedHelperError
          ? error.message
          : error instanceof Error &&
              error.constructor === Error &&
              !error["code"]
            ? error.message.slice(0, 2000)
            : "The build could not start. Review the command again or ask the operator to check the helper.";
      result = {
        ...entry.value,
        status: "failed",
        error: message,
        log: (entry.value.log + message + "\n").slice(-logLimit),
      };
    } finally {
      try {
        await release?.();
      } catch {
        result = {
          ...(result || entry.value),
          status: "failed",
          error:
            "The build lock could not be released safely. Ask the operator to inspect the website folder.",
        };
      }
      if (result) {
        entry.value = {
          ...result,
          id: entry.value.id,
          queuedAt: entry.value.queuedAt,
          log: result.log.slice(-logLimit),
        };
        this.finish(entry, result.status, result.error);
      } else
        this.finish(entry, "cancelled", "Build cancelled before it started.");
    }
  }
  async close() {
    this.closed = true;
    for (const entry of this.entries.values())
      if (active(entry.value))
        this.cancel(entry.value.projectId, entry.actor.id, entry.value.id);
    await Promise.allSettled([...this.running.values()]);
  }
}
