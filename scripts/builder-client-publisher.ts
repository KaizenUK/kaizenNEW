import { loadPublicationAsset } from "./builder-publication-media";
import { projectDeliveryWarnings } from "../shared/builderDelivery";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  rmdir,
  lstat,
  readdir,
  link,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { inspectProcessLock, withRecoveryLock } from "./release-recovery.mjs";
import {
  readClientDestinations,
  clientPublicationAction,
  publicDestination,
} from "./client-publication.mjs";
import {
  fetchContentCatalogue,
  hasContentBindings,
} from "../shared/builderContent";
import {
  captureClientPublication,
  clientDraftInput,
  withClientLiveBaseline,
  type ClientPublicationSnapshot,
  type ClientPublicationReview,
  type ClientPublicationJob,
} from "../shared/builderClientPublication";
import type { Workspace } from "../shared/visualBuilder";
import type { BuilderProject } from "../shared/builderProjects";
import { validateBackupWorkspace } from "../shared/builderBackup";
import {
  validatePublicationIndex,
  type PublicationIndex as Index,
} from "./builder-publication-state";

type Compiled = {
  files: Record<string, Uint8Array>;
  backup: Uint8Array;
  redirects: unknown[];
  warnings: string[];
};
type Services = {
  directory: (projectId: string) => string;
  require: (projectId: string) => Promise<unknown>;
  workspace: (projectId: string) => Promise<Workspace>;
  compile: (
    snapshot: ClientPublicationSnapshot,
    load: (url: string) => Promise<Uint8Array>,
    progress: (message: string) => void,
  ) => Promise<Compiled>;
  registry: () => string | undefined;
  adapters?: () => Record<string, any>;
  samplesRoot: string;
};
type Review = {
  public: ClientPublicationReview;
  destination: any;
  snapshot: ClientPublicationSnapshot | null;
  draftInput?: string;
  artifactId?: string;
};

const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value,
  );
export class ClientPublisher {
  private reviews = new Map<string, Review>();
  private queue: Promise<unknown> = Promise.resolve();
  private running = new Map<string, Promise<void>>();
  private closed = false;
  constructor(private services: Services) {}
  async catalogue(projects: BuilderProject[]): Promise<BuilderProject[]> {
    const file = this.services.registry();
    if (!file) return projects;
    const destinations = await readClientDestinations(file);
    return projects.map((project) => {
      const configured = destinations.filter(
        (value) => value.projectId === project.id,
      );
      return configured.length
        ? {
            ...project,
            destination: {
              kind: "client-configured",
              label: configured
                .map((value) => `${value.environment}: ${value.origin}`)
                .join(" · "),
            },
          }
        : project;
    });
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(operation, operation);
    this.queue = pending.catch(() => {});
    return pending;
  }
  private async folder(projectId: string) {
    if (!uuid(projectId))
      throw new Error("Client publication requires a client project UUID.");
    const folder = path.join(this.services.directory(projectId), "publication");
    await mkdir(folder, { recursive: true });
    if ((await lstat(folder)).isSymbolicLink())
      throw new Error("Publication storage must not be linked.");
    return folder;
  }
  private async atomic(file: string, value: unknown) {
    const temp = `${file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2), { flag: "wx" });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temp, file);
          break;
        } catch (error) {
          if (
            process.platform !== "win32" ||
            !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
            attempt >= 5
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * 2 ** attempt),
          );
        }
      }
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  private async index(projectId: string): Promise<Index> {
    const file = path.join(await this.folder(projectId), "index.json");
    let stat;
    try {
      stat = await lstat(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const folder = path.dirname(file);
      const entries = await readdir(folder);
      if (entries.includes("index.json")) return this.index(projectId);
      if (
        entries.some(
          (name) => !/^\.initial-index-[0-9a-f-]{36}\.tmp$/.test(name),
        )
      )
        throw new Error(
          "Publication history is missing but retained publication files exist. Preserve its files for operator recovery.",
        );
      const empty: Index = { schemaVersion: 1, jobs: [], active: {} };
      const temp = path.join(folder, `.initial-index-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(empty), { flag: "wx" });
      try {
        // Install complete initial JSON without replacing an index another
        // companion has just created. Future writes use the normal atomic path.
        await link(temp, file);
      } catch (initialError) {
        if (initialError.code !== "EEXIST") throw initialError;
      } finally {
        await unlink(temp);
      }
      return this.index(projectId);
    }
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(
        "Publication history must be a regular file. Preserve its files for recovery.",
      );
    let value: unknown;
    try {
      value = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(
        "Publication history contains invalid JSON. Preserve its files for recovery.",
      );
    }
    return validatePublicationIndex(value, projectId);
  }
  private async persist(
    projectId: string,
    job: ClientPublicationJob,
    activate = false,
  ) {
    // Event callbacks enqueue writes without awaiting them. Freeze each event's
    // value so later phase/log mutations cannot rewrite an earlier queued state.
    const savedJob = structuredClone(job);
    return this.serial(async () => {
      const state = await this.index(projectId);
      state.jobs = [
        savedJob,
        ...state.jobs.filter((value) => value.id !== savedJob.id),
      ];
      if (activate)
        state.active[savedJob.destination.destinationId] = savedJob.id;
      await this.atomic(
        path.join(await this.folder(projectId), "index.json"),
        validatePublicationIndex(state, projectId),
      );
    });
  }
  async destinations(projectId: string) {
    await this.services.require(projectId);
    const file = this.services.registry();
    if (!file) return [];
    return (await readClientDestinations(file))
      .filter((value) => value.projectId === projectId)
      .map(publicDestination);
  }
  private async destination(projectId: string, destinationId: string) {
    await this.services.require(projectId);
    const file = this.services.registry();
    if (!file)
      throw new Error(
        "Configure the server's client destination registry before publishing.",
      );
    const destination = (await readClientDestinations(file)).find(
      (value) =>
        value.projectId === projectId && value.destinationId === destinationId,
    );
    if (!destination)
      throw new Error("That destination is not configured for this project.");
    return destination;
  }
  async jobs(projectId: string) {
    await this.services.require(projectId);
    const state = await this.index(projectId);
    return Promise.all(
      state.jobs.map(async (job) => {
        const visible: ClientPublicationJob = {
          ...job,
          active: state.active[job.destination.destinationId] === job.id,
        };
        if (
          !this.running.has(job.id) &&
          [
            "queued",
            "building",
            "activating",
            "verifying",
            "recovery_required",
          ].includes(job.phase)
        ) {
          try {
            const lock = await inspectProcessLock(
              path.join(
                await this.folder(projectId),
                `lock-${job.destination.destinationId}`,
              ),
            );
            if (!lock || (lock.stopped && lock.owner.jobId === job.id)) {
              visible.phase = "recovery_required";
              visible.error =
                job.error ||
                "The publication stopped before its final status was recorded. Check and reconcile the selected destination artifact.";
              visible.recoveryAvailable = true;
            }
          } catch (error) {
            visible.error = error.message;
          }
        }
        return visible;
      }),
    );
  }
  async recover(projectId: string, jobId: string) {
    if (this.closed) throw new Error("The publisher is shutting down.");
    const job = (await this.jobs(projectId)).find(
      (value) => value.id === jobId,
    );
    if (!job?.recoveryAvailable)
      throw new Error(
        "This publication is not available for recovery. Its process must be proven stopped.",
      );
    const destination = await this.destination(
      projectId,
      job.destination.destinationId,
    );
    if (
      JSON.stringify(publicDestination(destination)) !==
      JSON.stringify(job.destination)
    )
      throw new Error(
        "Destination identity changed. Operator inspection is required.",
      );
    const folder = await this.folder(projectId);
    return withRecoveryLock(
      path.join(folder, `lock-${job.destination.destinationId}`),
      async () => {
        const selected = await clientPublicationAction(destination, "list");
        const id = selected.selectedReleaseId;
        if (!id || ![job.artifactId, job.previousReleaseId].includes(id))
          throw new Error(
            "The destination selects an unrelated artifact. Its configuration was preserved for operator inspection.",
          );
        const promoted = id === job.artifactId;
        const state = await this.index(projectId);
        const prior = state.jobs.find(
          (value) =>
            value.destination.destinationId === job.destination.destinationId &&
            value.artifactId === id &&
            value.id !== job.id &&
            value.phase === "live",
        );
        const active = state.jobs.find(
          (value) => value.id === state.active[job.destination.destinationId],
        );
        if (!promoted && !prior && active && active.id !== job.id)
          throw new Error(
            "No editable baseline matches the selected artifact. Preserve the files for operator reconciliation.",
          );
        // Read and validate the retained snapshot before any server reload.
        if (promoted || prior)
          await this.snapshot(projectId, promoted ? job : prior!);
        const checkDestination = async () => {
          const current = await this.destination(
            projectId,
            job.destination.destinationId,
          );
          if (
            this.closed ||
            JSON.stringify(current) !== JSON.stringify(destination)
          )
            throw new Error(
              "Destination configuration changed during recovery.",
            );
        };
        try {
          await clientPublicationAction(
            destination,
            "reconcile",
            { id },
            {
              ...this.services.adapters?.(),
              beforeReconcile: checkDestination,
              finalize: async () => {
                await checkDestination();
                await this.serial(async () => {
                  const latest = await this.index(projectId);
                  job.phase = promoted ? "live" : "rolled_back";
                  job.updatedAt = new Date().toISOString();
                  delete job.error;
                  delete job.recoveryAvailable;
                  job.log = (
                    job.log +
                    `\nRecovery verified selected artifact ${id}. Drafts were preserved.\n`
                  ).slice(-100000);
                  latest.jobs = [
                    job,
                    ...latest.jobs.filter((value) => value.id !== job.id),
                  ];
                  if (promoted)
                    latest.active[job.destination.destinationId] = job.id;
                  else if (prior)
                    latest.active[job.destination.destinationId] = prior.id;
                  else delete latest.active[job.destination.destinationId];
                  await this.atomic(
                    path.join(folder, "index.json"),
                    validatePublicationIndex(latest, projectId),
                  );
                });
              },
            },
          );
          return { ...job, active: promoted };
        } catch (error) {
          job.phase = "recovery_required";
          job.error = error.message;
          job.updatedAt = new Date().toISOString();
          delete job.recoveryAvailable;
          await this.persist(projectId, job);
          throw error;
        }
      },
      job.id,
    );
  }
  private async snapshot(
    projectId: string,
    job: ClientPublicationJob,
  ): Promise<ClientPublicationSnapshot | null> {
    const jobId = job.id;
    try {
      if (!uuid(jobId)) throw new Error("Invalid publication reference.");
      const file = path.join(
        await this.folder(projectId),
        `${jobId}.snapshot.json`,
      );
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error(
          "Publication snapshot must be a regular file. Preserve its files for recovery.",
        );
      const snapshot = JSON.parse(await readFile(file, "utf8"));
      if (
        snapshot !== null &&
        (snapshot.schemaVersion !== 1 || snapshot.projectId !== projectId)
      )
        throw new Error("Publication snapshot belongs to another project.");
      if (
        (snapshot === null && job.action === "publish") ||
        (snapshot !== null && job.action === "unpublish")
      )
        throw new Error(
          "Publication snapshot does not match its action. Preserve its files for recovery.",
        );
      if (snapshot !== null) {
        if (
          typeof snapshot.capturedAt !== "string" ||
          !Number.isFinite(Date.parse(snapshot.capturedAt))
        )
          throw new Error(
            "Publication snapshot has an invalid capture time. Preserve its files for recovery.",
          );
        validateBackupWorkspace(snapshot.workspace);
      }
      return snapshot;
    } catch (error) {
      throw new Error(
        `Publication snapshot ${jobId} is invalid or unavailable. Preserve its files for operator recovery.`,
      );
    }
  }
  async workspace(projectId: string, workspace: Workspace) {
    const state = await this.index(projectId);
    const job = state.jobs.find(
      (value) =>
        value.destination.environment === "production" &&
        state.active[value.destination.destinationId] === value.id,
    );
    return withClientLiveBaseline(
      projectId,
      workspace,
      job ? await this.snapshot(projectId, job) : null,
    );
  }
  async review(
    projectId: string,
    destinationId: string,
    action: ClientPublicationJob["action"],
    rollbackOf?: string,
  ) {
    if (this.closed) throw new Error("The publisher is shutting down.");
    const destination = await this.destination(projectId, destinationId);
    const live = await clientPublicationAction(destination, "list");
    if (!live.selectedReleaseId)
      throw new Error(
        "Initialise and verify this destination's Nginx store before publishing.",
      );
    let snapshot: ClientPublicationSnapshot | null = null,
      draftInput: string | undefined,
      artifactId: string | undefined;
    if (action === "publish") {
      const workspace = await this.services.workspace(projectId);
      draftInput = clientDraftInput(workspace);
      const connected =
        workspace.pages.some((page) =>
          hasContentBindings(page.draft.data.content),
        ) ||
        workspace.site?.draft.components.some((component) =>
          hasContentBindings(component.blocks),
        );
      let catalogue;
      if (connected) {
        const cms = workspace.settings?.value.cms;
        if (cms?.kind !== "sanity-public")
          throw new Error(
            "Configure this client's public Sanity connection before publishing connected content.",
          );
        catalogue = await fetchContentCatalogue({
          projectId: cms.projectId,
          dataset: cms.dataset,
        });
      }
      snapshot = captureClientPublication(projectId, workspace, catalogue);
    } else if (action === "rollback") {
      const state = await this.index(projectId),
        prior = state.jobs.find(
          (value) =>
            value.id === rollbackOf &&
            value.destination.destinationId === destinationId &&
            value.phase === "live",
        );
      if (!prior)
        throw new Error(
          "Choose a previously verified release for this destination.",
        );
      if (live.selectedReleaseId === prior.artifactId)
        throw new Error("That artifact is already selected.");
      snapshot = await this.snapshot(projectId, prior);
      artifactId = prior.artifactId;
    } else if (action !== "unpublish")
      throw new Error("Unsupported client publication action.");
    const review: ClientPublicationReview = {
      id: randomUUID(),
      destination: publicDestination(destination) as any,
      action,
      expiresAt: Date.now() + 15 * 60 * 1000,
      previousReleaseId: live.selectedReleaseId,
      warnings: snapshot
        ? projectDeliveryWarnings(
            snapshot.workspace,
            snapshot.catalogue,
            destination.origin,
          )
        : [],
      pages:
        snapshot?.workspace.pages.map((page) => ({
          id: page.id,
          title: page.draft.title,
          slug: page.draft.slug,
          version: page.version,
        })) || [],
      ...(rollbackOf ? { rollbackOf } : {}),
    };
    for (const [id, value] of this.reviews)
      if (value.public.expiresAt < Date.now()) this.reviews.delete(id);
    if (this.reviews.size >= 30)
      this.reviews.delete(this.reviews.keys().next().value!);
    this.reviews.set(review.id, {
      public: review,
      destination,
      snapshot,
      draftInput,
      artifactId,
    });
    return structuredClone(review);
  }
  async start(projectId: string, reviewId: string) {
    const review = this.reviews.get(reviewId);
    if (
      this.closed ||
      !review ||
      review.public.destination.projectId !== projectId ||
      review.public.expiresAt < Date.now()
    )
      throw new Error(
        "Publication review expired. Review the destination and pages again.",
      );
    if (
      (await this.jobs(projectId)).some(
        (job) =>
          job.destination.destinationId ===
            review.public.destination.destinationId &&
          job.phase === "recovery_required",
      )
    )
      throw new Error(
        "Reconcile the interrupted publication for this destination before starting another release.",
      );
    await this.checkReview(projectId, review);
    const folder = await this.folder(projectId),
      lock = path.join(
        folder,
        `lock-${review.public.destination.destinationId}`,
      );
    try {
      await mkdir(lock);
    } catch (error) {
      if (error.code === "EEXIST")
        throw new Error(
          "This destination has a pending publication or recovery lock. Inspect its recorded process and release status before retrying.",
        );
      throw error;
    }
    const id = randomUUID(),
      now = new Date().toISOString();
    const job: ClientPublicationJob = {
      id,
      destination: review.public.destination,
      action: review.public.action,
      phase: "queued",
      createdAt: now,
      updatedAt: now,
      previousReleaseId: review.public.previousReleaseId,
      artifactId: review.artifactId || id,
      ...(review.public.rollbackOf
        ? { rollbackOf: review.public.rollbackOf }
        : {}),
      log: "",
      active: false,
    };
    try {
      await writeFile(
        path.join(lock, "owner.json"),
        JSON.stringify({
          pid: process.pid,
          host: os.hostname(),
          jobId: id,
          createdAt: now,
        }),
        { flag: "wx" },
      );
      await this.atomic(
        path.join(folder, `${id}.snapshot.json`),
        review.snapshot,
      );
      await this.persist(projectId, job);
      this.reviews.delete(reviewId);
      const work = this.execute(projectId, job, review).finally(async () => {
        this.running.delete(id);
        await unlink(path.join(lock, "owner.json"));
        await rmdir(lock);
      });
      this.running.set(id, work);
      void work.catch(() => {});
      return structuredClone(job);
    } catch (error) {
      await unlink(path.join(lock, "owner.json")).catch(() => {});
      await rmdir(lock).catch(() => {});
      throw error;
    }
  }
  private async checkReview(
    projectId: string,
    review: Review,
    checkDraft = true,
  ) {
    const current = await this.destination(
      projectId,
      review.destination.destinationId,
    );
    if (JSON.stringify(current) !== JSON.stringify(review.destination))
      throw new Error("Destination configuration changed. Review it again.");
    const selected = await clientPublicationAction(current, "list");
    if (selected.selectedReleaseId !== review.public.previousReleaseId)
      throw new Error(
        "The selected live artifact changed. Review publication again.",
      );
    if (
      checkDraft &&
      review.draftInput &&
      review.draftInput !==
        clientDraftInput(await this.services.workspace(projectId))
    )
      throw new Error(
        "Saved drafts changed after review. Review the updated pages before publishing.",
      );
    return current;
  }
  private async asset(snapshot: ClientPublicationSnapshot, url: string) {
    return loadPublicationAsset(snapshot, url, {
      samplesRoot: this.services.samplesRoot,
      registered: async (id) => {
        const file = path.join(
          this.services.directory(snapshot.projectId),
          "assets",
          id,
        );
        const stat = await lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Publication assets must be regular project files.");
        return new Uint8Array(await readFile(file));
      },
    });
  }
  private async execute(
    projectId: string,
    job: ClientPublicationJob,
    review: Review,
  ) {
    const events: Promise<unknown>[] = [];
    const log = (message: string) => {
      job.log = (job.log + message + "\n").slice(-100000);
    };
    const save = async (phase: ClientPublicationJob["phase"]) => {
      job.phase = phase;
      job.updatedAt = new Date().toISOString();
      await this.persist(projectId, job);
    };
    try {
      if (job.action === "publish") {
        await save("building");
        const result = await this.services.compile(
          review.snapshot!,
          (url) => this.asset(review.snapshot!, url),
          log,
        );
        const root = path.join(await this.folder(projectId), job.id);
        await mkdir(root);
        const output = path.join(root, "site");
        await mkdir(output);
        for (const [name, bytes] of Object.entries(result.files)) {
          if (
            !name ||
            name.includes("\\") ||
            name.includes(":") ||
            name
              .split("/")
              .some((part) => !part || part === "." || part === "..")
          )
            throw new Error("Compiler returned an unsafe file path.");
          const file = path.join(output, name);
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, bytes, { flag: "wx" });
        }
        await writeFile(path.join(root, "project.zip"), result.backup, {
          flag: "wx",
        });
        const redirects = path.join(root, "redirects.json");
        await this.atomic(redirects, result.redirects);
        result.warnings.forEach(log);
        await clientPublicationAction(review.destination, "stage", {
          source: output,
          id: job.artifactId,
          redirects,
        });
      }
      if (this.closed)
        throw new Error(
          "Publisher stopped before activation. Review and retry.",
        );
      await this.checkReview(projectId, review, false);
      await save("activating");
      const adapters = {
        ...this.services.adapters?.(),
        beforeSwitch: async () => {
          if (this.closed)
            throw new Error("Publisher stopped before activation.");
          await this.checkReview(projectId, review, false);
        },
        finalize: async () => {
          const destination = await this.destination(
            projectId,
            job.destination.destinationId,
          );
          if (
            JSON.stringify(destination) !== JSON.stringify(review.destination)
          )
            throw new Error(
              "Destination configuration changed before publication could be finalized.",
            );
          try {
            job.phase = "live";
            job.updatedAt = new Date().toISOString();
            await this.persist(projectId, job, true);
          } catch (error) {
            error.releaseCommitUncertain = true;
            throw error;
          }
        },
      };
      await clientPublicationAction(
        review.destination,
        job.action === "unpublish"
          ? "unpublish"
          : job.action === "rollback"
            ? "rollback"
            : "activate",
        {
          id: job.artifactId,
          report: (event: any) => {
            if (["activating", "verifying"].includes(event.status)) {
              job.phase = event.status;
              job.updatedAt = new Date().toISOString();
              events.push(this.persist(projectId, job));
            }
            log(`Release engine: ${event.status}`);
          },
        },
        adapters,
      );
      await Promise.all(events);
      await save("live");
    } catch (error) {
      await Promise.allSettled(events);
      job.error = error.message;
      log(error.message);
      const state = await this.index(projectId);
      const committed = state.active[job.destination.destinationId] === job.id;
      await save(
        committed || /recovery|externally|uncertain/i.test(error.message)
          ? "recovery_required"
          : /previous release was restored/i.test(error.message)
            ? "rolled_back"
            : "failed",
      );
    }
  }
  async close() {
    this.closed = true;
    await Promise.allSettled([...this.running.values()]);
  }
}
