import { createServer, type IncomingMessage } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validProjectId } from "../shared/builderProjects";
import {
  DEFAULT_EDITOR_ORIGINS,
  parseAllowedOrigins,
} from "../shared/builderOrigins";
import {
  HostedHelperError,
  HostedRepositoryAccess,
  type RepositoryActor,
} from "./builder-hosted-auth";
import {
  HostedWebsiteFolders,
  hostedProjectRepositories,
  unlinkedPath,
} from "./builder-hosted-folders";
import { RepositoryCompanion, inspectRepository } from "./builder-repository";
import { RepositoryRunner, type BuildPlan } from "./builder-runner";
import { HostedBuildQueue } from "./builder-hosted-builds";
import { HostedPreviews } from "./builder-hosted-previews";
import { HostedWebsiteSaves } from "./builder-hosted-saves";
import { HostedSaveReleases } from "./builder-hosted-save-release";
import { HostedRepositorySettings } from "./builder-hosted-settings";
import { repositorySetupActions } from "../shared/builderRepositorySettings";
import { repositoryPublishActions } from "../shared/builderRepositoryPublish";
import { HostedWebsitePublishing } from "./builder-hosted-publishing";
import { SourceDrafts } from "./builder-source-drafts";
import { NativeRepositoryBackups } from "./builder-native-backup";
import { hostedDiskLimits } from "./builder-hosted-disk";
import { HostedBuildRecovery } from "./builder-hosted-build-recovery";

const endpoint = "/editor-api/builder-repository";
const maxBody = 52 * 1024 * 1024;
const actions = new Set([
  ...repositorySetupActions,
  ...repositoryPublishActions,
  "repository-connect",
  "repository-inspect-current",
  "repository-inspect",
  "repository-fetch",
  "repository-git-status",
  "repository-source-inspect",
  "repository-source-draft-read",
  "repository-source-draft-save",
  "repository-source-prepare",
  "repository-prepare",
  "repository-apply",
  "repository-save",
  "repository-save-status",
  "repository-build-review",
  "repository-build-start",
  "repository-build-status",
  "repository-build-stop",
  "repository-source-frame",
  "repository-source-preview",
  "repository-native-backup-review",
  "repository-native-backup-download",
  "repository-native-review-discard",
]);
const comingNext = new Set([
  "repository-commit",
  "repository-open",
  "repository-native-restore-review",
  "repository-native-restore-apply",
]);
type IssuedPlan = {
  actorId: string;
  kind: "files" | "backup" | "build";
  expiresAt: number;
  draft?: { route: string; version: number };
  route?: string;
  build?: BuildPlan;
};
class ProjectOperations {
  repositories = new RepositoryCompanion();
  constructor(readonly runner: RepositoryRunner) {}
  backups = new NativeRepositoryBackups();
  issued = new Map<string, IssuedPlan>();
  remember(id: string, entry: IssuedPlan) {
    for (const [key, item] of this.issued)
      if (item.expiresAt <= Date.now()) this.issued.delete(key);
    if (this.issued.size >= 100)
      this.issued.delete(this.issued.keys().next().value!);
    this.issued.set(id, entry);
  }
  require(id: unknown, actorId: string, kind?: IssuedPlan["kind"]) {
    const entry = typeof id === "string" ? this.issued.get(id) : undefined;
    if (
      !entry ||
      entry.actorId !== actorId ||
      entry.expiresAt <= Date.now() ||
      (kind && entry.kind !== kind)
    )
      throw new HostedHelperError(
        409,
        "Review this operation again in your current project and account.",
      );
    return entry;
  }
}

/** Reuses the local source/repository modules. Server authority fixes the folder and actor. */
export class HostedHelperService {
  private projects = new Map<string, ProjectOperations>();
  private closed = false;
  private stopping?: Promise<void>;
  private builds: HostedBuildQueue;
  private saves: HostedWebsiteSaves;
  private settings: HostedRepositorySettings;
  private publishing: HostedWebsitePublishing;
  private buildRecovery: HostedBuildRecovery;
  readonly previews?: HostedPreviews;
  constructor(
    readonly folders: HostedWebsiteFolders,
    readonly access: HostedRepositoryAccess,
    options?: {
      editorOrigin?: string;
      saveReleases?: HostedSaveReleases;
      publicationFetch?: typeof fetch;
    },
  ) {
    this.saves = new HostedWebsiteSaves(folders, options?.saveReleases);
    this.buildRecovery = new HostedBuildRecovery(folders);
    this.settings = new HostedRepositorySettings(folders);
    this.publishing = new HostedWebsitePublishing(
      folders,
      options?.saveReleases,
      options?.publicationFetch,
    );
    this.builds = new HostedBuildQueue({
      folders,
      authorize: async (token, projectId) => {
        const actor = await access.verify(token);
        await access.requireProject(token, actor, projectId);
      },
      runner: (projectId) => this.projects.get(projectId)!.runner,
    });
    if (options?.editorOrigin !== undefined)
      this.previews = new HostedPreviews(
        options.editorOrigin,
        access,
        this.builds,
      );
  }
  async request(
    token: string,
    readInput: () => Promise<unknown>,
    preview?: { cookie?: string; grant: (cookie: string) => void },
  ) {
    if (this.closed)
      throw new HostedHelperError(
        503,
        "The hosted helper is restarting. Reconnect shortly.",
      );
    const actor = await this.access.verify(token);
    const input = (await readInput()) as Record<string, any>;
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.projectId !== "string" ||
      !validProjectId(input.projectId) ||
      typeof input.action !== "string"
    )
      throw new HostedHelperError(
        400,
        "Choose a valid project and website action.",
      );
    const projectId = input.projectId;
    // Reject an unauthorised project before any disk access; check again after waiting for its lock.
    await this.access.requireProject(token, actor, projectId);
    const setup = repositorySetupActions.has(input.action);
    if (setup)
      await this.access.requireProject(token, actor, projectId, "owner");
    const publishing = repositoryPublishActions.has(input.action);
    if (publishing)
      await this.access.requireProject(token, actor, projectId, "publish");
    if (comingNext.has(input.action))
      throw new HostedHelperError(
        501,
        "This hosted operation is not available yet. The operator must finish the hosted helper setup.",
      );
    if (!actions.has(input.action))
      throw new HostedHelperError(
        400,
        "Choose a supported website folder action.",
      );
    this.folders.admission(projectId);
    const root = this.folders.root(projectId);
    if (
      (input.root !== undefined && input.root !== root) ||
      (input.edits?.inspection?.root !== undefined &&
        input.edits.inspection.root !== root)
    )
      throw new HostedHelperError(
        403,
        "This operation belongs to another website folder. Reopen the intended project.",
      );
    return this.folders.locked(projectId, async () => {
      if (this.closed)
        throw new HostedHelperError(
          503,
          "The hosted helper is restarting. Reconnect shortly.",
        );
      await this.access.requireProject(token, actor, projectId);
      if (setup)
        await this.access.requireProject(token, actor, projectId, "owner");
      if (publishing)
        await this.access.requireProject(token, actor, projectId, "publish");
      await this.publishing.refresh(projectId);
      await this.saves.refresh(projectId);
      await this.buildRecovery.refresh(projectId);
      if (
        [
          "repository-settings-save",
          "repository-settings-key",
          "repository-settings-connect",
          "repository-fetch",
          "repository-apply",
          "repository-save",
          "repository-publish-review",
          "repository-publish",
          "repository-build-review",
          "repository-build-start",
          "repository-native-backup-review",
        ].includes(input.action)
      )
        this.buildRecovery.assertCanOperate(projectId);
      if (await this.settings.refresh(projectId))
        await this.invalidateProject(projectId);
      if (setup) {
        switch (input.action) {
          case "repository-settings-read":
            return this.settings.read(projectId);
          case "repository-settings-save":
            return this.settings.save(
              projectId,
              input.version,
              input.repository,
              () => this.invalidateProject(projectId),
            );
          case "repository-settings-key":
            return this.settings.createKey(projectId, input.version);
          case "repository-settings-connect":
            return this.settings.connect(projectId, input.version);
        }
      }
      await this.folders.ensure(projectId);
      let operations = this.projects.get(projectId);
      if (!operations) {
        operations = new ProjectOperations(
          new RepositoryRunner(undefined, undefined, {
            environment: await this.folders.buildEnvironment(projectId),
            watchStorage: (stop) => this.folders.disk.watch(projectId, stop),
            beforeBuild: (job, fingerprint) =>
              this.buildRecovery.begin(job, fingerprint),
            afterBuild: (job) => this.buildRecovery.finish(job),
          }),
        );
        this.projects.set(projectId, operations);
      }
      await this.saves.recover(projectId, operations.repositories);
      try {
        if (
          [
            "repository-apply",
            "repository-fetch",
            "repository-native-backup-review",
          ].includes(input.action)
        )
          await this.folders.assertNotBuilding(projectId);
        // Reserve session capacity before a write, so a quota failure cannot hide an applied operation.
        const cookie =
          preview && this.previews?.issue(preview.cookie, actor, token);
        const value = await this.perform(input, actor, root, operations, token);
        if (cookie) preview!.grant(cookie);
        return value;
      } catch (error) {
        if (error instanceof HostedHelperError) throw error;
        // Expected source conflicts keep the existing helper wording. Filesystem/Git/JSON internals do not.
        if (
          error instanceof Error &&
          error.constructor === Error &&
          !error["code"] &&
          !error["stderr"]
        )
          throw new HostedHelperError(409, error.message.slice(0, 2000));
        throw new HostedHelperError(
          500,
          "The website operation could not finish. Your files are kept; ask the operator to inspect the helper.",
        );
      }
    });
  }
  private async invalidateProject(projectId: string) {
    this.builds.assertIdle(projectId);
    this.buildRecovery.assertCanOperate(projectId, true);
    this.saves.assertCanReconfigure(projectId);
    this.publishing.assertCanReconfigure(projectId);
    await this.projects.get(projectId)?.runner.close();
    this.projects.delete(projectId);
    await this.saves.forget(projectId);
    await this.publishing.forget(projectId);
    await this.buildRecovery.forget(projectId);
  }
  private async perform(
    input: Record<string, any>,
    actor: RepositoryActor,
    root: string,
    operations: ProjectOperations,
    token: string,
  ) {
    const projectId = input.projectId;
    const drafts = () =>
      this.folders
        .draftsDirectory(projectId, actor.id)
        .then((directory) => new SourceDrafts(directory));
    const remember = (
      value: { id: string; expiresAt: number },
      kind: IssuedPlan["kind"],
      draft?: IssuedPlan["draft"],
    ) => {
      operations.remember(value.id, {
        actorId: actor.id,
        kind,
        expiresAt: value.expiresAt,
        draft,
      });
      return value;
    };
    switch (input.action) {
      case "repository-connect":
        return {
          projectId,
          root,
          expiresAt: Math.min(actor.expiresAt, Date.now() + 15 * 60_000),
          ...(this.previews ? { previewSession: true } : {}),
          ...(this.folders.configuration(projectId).saveToWebsite
            ? { canSaveToWebsite: true }
            : {}),
          ...(this.folders.configuration(projectId).publishToWebsite
            ? { canPublishWebsite: true }
            : {}),
        };
      case "repository-publish-review":
      case "repository-publish": {
        this.builds.assertIdle(projectId);
        this.saves.assertCanReconfigure(projectId);
        if (input.action === "repository-publish-review")
          return this.publishing.review(projectId, actor);
        return this.publishing.publish(
          projectId,
          actor,
          input.reviewId,
          async () => {
            const current = await this.access.verify(token);
            await this.access.requireProject(
              token,
              current,
              projectId,
              "publish",
            );
          },
        );
      }
      case "repository-publish-status":
        return this.publishing.status(projectId, actor, input.reviewId);
      case "repository-inspect-current":
      case "repository-inspect":
        return inspectRepository(root);
      case "repository-fetch":
        return this.folders.fetch(projectId);
      case "repository-git-status":
        return operations.repositories.gitStatus(
          root,
          this.folders.localGit(projectId),
        );
      case "repository-source-inspect":
        return operations.repositories.inspectSourcePage(root, input.route);
      case "repository-source-draft-read":
        return (await drafts()).read(root, input.route);
      case "repository-source-draft-save":
        await this.folders.disk.check(
          projectId,
          Buffer.byteLength(JSON.stringify(input.edits) || "") + 64 * 1024,
        );
        return (await drafts()).save(
          root,
          input.route,
          input.version,
          input.edits,
        );
      case "repository-source-prepare": {
        // Never replace a client-supplied nested root: mismatches above are rejected.
        if (input.edits?.inspection?.root !== root)
          throw new HostedHelperError(
            400,
            "Inspect this website page before reviewing changes.",
          );
        let draft: IssuedPlan["draft"];
        if (input.draftVersion !== undefined) {
          const current = await (
            await drafts()
          ).read(root, input.edits.inspection.route);
          if (
            current.version !== input.draftVersion ||
            JSON.stringify(current.edits) !== JSON.stringify(input.edits)
          )
            throw new HostedHelperError(
              409,
              "Save the latest editing draft before reviewing it.",
            );
          draft = { route: current.route, version: current.version };
        }
        const plan = await operations.repositories.prepareSource(
          projectId,
          input.edits,
          input.media,
        );
        remember(plan, "files", draft);
        operations.issued.get(plan.id)!.route = input.edits.inspection.route;
        return plan;
      }
      case "repository-prepare": {
        if (
          typeof input.archive !== "string" ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(input.archive)
        )
          throw new HostedHelperError(400, "Choose a valid website export.");
        const plan = await operations.repositories.prepare(
          root,
          projectId,
          Buffer.from(input.archive, "base64"),
        );
        remember(plan, "files");
        return plan;
      }
      case "repository-apply": {
        this.saves.assertCanApply(projectId);
        const entry = operations.require(input.planId, actor.id, "files");
        const base = this.folders.configuration(projectId).saveToWebsite
          ? await this.folders.head(projectId)
          : "";
        // Consume before a write, including failures with unknown/partial outcomes; never resend an old plan.
        operations.issued.delete(input.planId);
        const result = await operations.repositories.apply(
          input.planId,
          projectId,
          async (changes, additionalBytes) => {
            await this.folders.disk.check(projectId, additionalBytes);
            return this.saves.begin(
              projectId,
              actor,
              base,
              input.planId,
              changes,
              entry.route,
            );
          },
        );
        await this.saves.remember(projectId, actor, result);
        if (entry.draft) {
          try {
            await (
              await drafts()
            ).save(root, entry.draft.route, entry.draft.version, null);
          } catch {
            result.message +=
              " The saved editing draft was retained; reopen it to review or discard it.";
          }
        }
        return result;
      }
      case "repository-save":
      case "repository-save-status": {
        if (!this.folders.configuration(projectId).saveToWebsite)
          throw new HostedHelperError(
            501,
            "Save to website needs a configured staging destination. Ask the owner to finish the hosted setup.",
          );
        if (input.action === "repository-save-status")
          return this.saves.status(
            projectId,
            actor.id,
            input.planId,
            input.route,
          );
        return this.saves.save(
          projectId,
          actor,
          input.planId,
          input.message,
          operations.repositories,
          async () => {
            const current = await this.access.verify(token);
            await this.access.requireProject(token, current, projectId);
          },
        );
      }
      case "repository-build-review": {
        const plan = await operations.runner.prepare(root, projectId);
        operations.remember(plan.id, {
          actorId: actor.id,
          kind: "build",
          expiresAt: plan.expiresAt,
          build: plan,
        });
        return plan;
      }
      case "repository-build-start": {
        const entry = operations.require(input.planId, actor.id, "build");
        const job = this.builds.enqueue(entry.build!, actor, token);
        operations.issued.delete(input.planId);
        return job;
      }
      case "repository-build-status": {
        const value = this.builds.status(projectId, actor.id, input.jobId);
        if (value.status === "succeeded" && this.previews) {
          try {
            const preview = await this.previews.view(
              projectId,
              actor.id,
              input.jobId,
            );
            return {
              ...value,
              previewUrl: preview.url,
              previewExpiresAt: preview.expiresAt,
            };
          } catch (error) {
            if (!(error instanceof HostedHelperError) || error.status !== 410)
              throw error;
          }
        }
        return value;
      }
      case "repository-build-stop":
        return this.builds.cancel(projectId, actor.id, input.jobId);
      case "repository-source-frame":
      case "repository-source-preview": {
        if (!this.previews)
          throw new HostedHelperError(
            501,
            "Configure the hosted helper's HTTPS preview origin before opening the page.",
          );
        const inspection = await operations.repositories.inspectSourcePage(
          root,
          input.route,
        );
        return this.previews.view(
          projectId,
          actor.id,
          input.jobId,
          inspection,
          input.action === "repository-source-preview",
        );
      }
      case "repository-native-backup-review": {
        const review = await operations.backups.capture(
          root,
          projectId,
          await this.folders.draftsDirectory(projectId, actor.id),
        );
        remember(review, "backup");
        return review;
      }
      case "repository-native-backup-download":
        operations.require(input.reviewId, actor.id, "backup");
        return {
          archive: operations.backups.download(input.reviewId, projectId),
        };
      case "repository-native-review-discard":
        operations.require(input.reviewId, actor.id, "backup");
        operations.backups.discard(input.reviewId, projectId);
        operations.issued.delete(input.reviewId);
        return { discarded: true };
    }
  }
  health() {
    return {
      service: "kaizen-hosted-helper",
      status: this.closed ? "stopping" : "running",
    } as const;
  }
  close() {
    if (this.stopping) return this.stopping;
    this.closed = true;
    this.previews?.close();
    this.stopping = (async () => {
      await this.builds.close();
      await this.folders.idle();
      await Promise.all(
        [...this.projects.values()].map((project) => project.runner.close()),
      );
      this.projects.clear();
    })();
    return this.stopping;
  }
}

async function requestBody(request: IncomingMessage) {
  const length = request.headers["content-length"];
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBody))
    throw new HostedHelperError(
      413,
      "The website request is too large. Use an export smaller than 35 MB.",
    );
  if (
    request.headers["content-encoding"] &&
    request.headers["content-encoding"] !== "identity"
  )
    throw new HostedHelperError(415, "Send the website request as plain JSON.");
  if (
    !/^application\/json(?:\s*;.*)?$/i.test(
      request.headers["content-type"] || "",
    )
  )
    throw new HostedHelperError(415, "Send the website request as JSON.");
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(
      () =>
        finish(
          new HostedHelperError(
            408,
            "The website request did not finish uploading. Try again.",
          ),
        ),
      20_000,
    );
    const end = () => finish(undefined, Buffer.concat(chunks));
    const aborted = () =>
      finish(
        new HostedHelperError(
          400,
          "The website request ended before it finished uploading.",
        ),
      );
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBody) {
        request.pause();
        finish(new HostedHelperError(413, "The website request is too large."));
      } else chunks.push(chunk);
    };
    function finish(error?: Error, value?: Buffer) {
      clearTimeout(timer);
      request
        .off("data", data)
        .off("end", end)
        .off("aborted", aborted)
        .off("error", aborted);
      error ? reject(error) : resolve(value!);
    }
    request
      .on("data", data)
      .once("end", end)
      .once("aborted", aborted)
      .once("error", aborted);
    if (request.destroyed) aborted();
  });
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new HostedHelperError(
      400,
      "The website request contains invalid JSON.",
    );
  }
}

export async function startHostedHelper(options: {
  service: HostedHelperService;
  origins: string[];
  port?: number;
}) {
  const origins = new Set(
    parseAllowedOrigins(
      options.origins.join(","),
      [],
      "ALLOWED_STUDIO_ORIGINS",
    ),
  );
  if (options.service.previews && !origins.has(options.service.previews.origin))
    throw new Error(
      "The canonical HTTPS preview origin must be an allowed editor origin.",
    );
  let active = 0,
    previewActive = 0,
    listeningPort = 0;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    let counted = false;
    let previewCounted = false;
    try {
      if (request.url === "/health") {
        // This is an operator liveness probe, never a proxied or browser API.
        if (
          !["GET", "HEAD"].includes(request.method || "") ||
          request.headers.host !== `127.0.0.1:${listeningPort}` ||
          Object.keys(request.headers).some(
            (name) =>
              name === "origin" ||
              name === "forwarded" ||
              name.startsWith("x-forwarded-") ||
              name === "sec-fetch-site",
          )
        )
          throw new HostedHelperError(404, "Hosted helper route not found.");
        const health = options.service.health();
        response
          .writeHead(health.status === "running" ? 200 : 503)
          .end(request.method === "HEAD" ? undefined : JSON.stringify(health));
        return;
      }
      if (
        request.url?.startsWith("/editor-preview/") &&
        options.service.previews
      ) {
        if (previewActive >= 32)
          throw new HostedHelperError(
            429,
            "Too many preview files are loading. Reopen the preview.",
          );
        previewActive++;
        previewCounted = true;
        await options.service.previews.serve(request, response);
        return;
      }
      if (request.url !== endpoint)
        throw new HostedHelperError(404, "Hosted helper route not found.");
      const origin = request.headers.origin;
      if (origin && !origins.has(origin))
        throw new HostedHelperError(
          403,
          "This website cannot connect to the hosted helper.",
        );
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
      }
      if (request.method === "DELETE" && options.service.previews) {
        if (origin !== options.service.previews.origin)
          throw new HostedHelperError(
            403,
            "Disconnect previews from their editor.",
          );
        const cookie = options.service.previews.revoke(
          request.headers.cookie,
          request.headers["x-kaizen-preview-account"],
        );
        if (cookie) response.setHeader("Set-Cookie", cookie);
        response.writeHead(204).end();
        return;
      }
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "POST, DELETE");
        response.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type, X-Kaizen-Preview-Account",
        );
        response.writeHead(204).end();
        return;
      }
      if (request.method !== "POST")
        throw new HostedHelperError(
          405,
          "Use a POST request for website operations.",
        );
      const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(
        request.headers.authorization || "",
      );
      if (!match)
        throw new HostedHelperError(401, "Sign in to use the hosted helper.");
      if (active >= 8)
        throw new HostedHelperError(
          429,
          "The hosted helper has too many pending requests. Try again after they finish.",
        );
      active++;
      counted = true;
      const value = await options.service.request(
        match[1],
        () => requestBody(request),
        origin === options.service.previews?.origin
          ? {
              cookie: request.headers.cookie,
              grant: (cookie) => response.setHeader("Set-Cookie", cookie),
            }
          : undefined,
      );
      response.writeHead(200).end(JSON.stringify(value));
    } catch (error) {
      const status = error instanceof HostedHelperError ? error.status : 500;
      const message =
        error instanceof HostedHelperError
          ? error.message
          : "The hosted helper could not finish this operation. Ask the operator to check it.";
      response.shouldKeepAlive = false;
      response.writeHead(status).end(JSON.stringify({ error: message }));
    } finally {
      if (counted) active--;
      if (previewCounted) previewActive--;
    }
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  server.on("clientError", (_error, socket) =>
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"),
  );
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4334, "127.0.0.1", resolve);
  });
  const address = server.address();
  listeningPort = typeof address === "object" && address ? address.port : 4334;
  let closing: Promise<void> | undefined;
  return {
    server,
    origin: `http://127.0.0.1:${listeningPort}`,
    close: () =>
      (closing ??= (async () => {
        const stopped = new Promise<void>((resolve) =>
          server.close(() => resolve()),
        );
        try {
          await options.service.close();
        } finally {
          server.closeAllConnections();
          await stopped;
        }
      })()),
  };
}

async function main() {
  const file = process.env.BUILDER_HOSTED_PROJECTS_FILE || "";
  await unlinkedPath(file);
  const configuration = await readFile(file, "utf8");
  if (configuration.length > 1024 * 1024) throw new Error();
  const projects = hostedProjectRepositories(JSON.parse(configuration));
  const folders = new HostedWebsiteFolders(
    process.env.BUILDER_HOSTED_WORK_DIRECTORY || "",
    process.env.BUILDER_HOSTED_CREDENTIALS_DIRECTORY || "",
    projects,
    hostedDiskLimits(process.env),
  );
  const access = new HostedRepositoryAccess({
    url: process.env.BUILDER_HOSTED_SUPABASE_URL || "",
    anonKey: process.env.BUILDER_HOSTED_SUPABASE_ANON_KEY || "",
  });
  const port = Number(process.env.BUILDER_HOSTED_PORT || 4334);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const helper = await startHostedHelper({
    service: new HostedHelperService(folders, access, {
      editorOrigin: process.env.BUILDER_HOSTED_EDITOR_ORIGIN || "",
      saveReleases: new HostedSaveReleases({
        githubToken: process.env.BUILDER_HOSTED_GITHUB_READ_TOKEN,
      }),
    }),
    port,
    origins: parseAllowedOrigins(
      process.env.ALLOWED_STUDIO_ORIGINS,
      DEFAULT_EDITOR_ORIGINS,
      "ALLOWED_STUDIO_ORIGINS",
    ),
  });
  console.info("Hosted helper is listening on loopback.");
  const stop = () => {
    void helper.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
// The permanent service selects a versioned runtime through a symlink. Node
// resolves the imported module but may retain that link in argv[1].
void (async () => {
  const entry = process.argv[1]
    ? await realpath(process.argv[1]).catch(() => undefined)
    : undefined;
  if (entry === fileURLToPath(import.meta.url)) await main();
})().catch(() => {
  console.error(
    "Hosted helper could not start. Check its server-only configuration and file permissions.",
  );
  process.exitCode = 1;
});
