import { createServer, type IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
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
import { RepositoryRunner } from "./builder-runner";
import { SourceDrafts } from "./builder-source-drafts";
import { NativeRepositoryBackups } from "./builder-native-backup";

const endpoint = "/editor-api/builder-repository";
const maxBody = 52 * 1024 * 1024;
const actions = new Set([
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
  "repository-build-review",
  "repository-native-backup-review",
  "repository-native-backup-download",
  "repository-native-review-discard",
]);
const comingNext = new Set([
  "repository-build-start",
  "repository-build-status",
  "repository-build-stop",
  "repository-source-frame",
  "repository-source-preview",
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
};
class ProjectOperations {
  repositories = new RepositoryCompanion();
  runner = new RepositoryRunner();
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
  constructor(
    readonly folders: HostedWebsiteFolders,
    readonly access: HostedRepositoryAccess,
  ) {}
  async request(token: string, readInput: () => Promise<unknown>) {
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
    this.folders.configuration(projectId);
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
      await this.folders.ensure(projectId);
      let operations = this.projects.get(projectId);
      if (!operations) {
        operations = new ProjectOperations();
        this.projects.set(projectId, operations);
      }
      try {
        return await this.perform(input, actor, root, operations);
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
  private async perform(
    input: Record<string, any>,
    actor: RepositoryActor,
    root: string,
    operations: ProjectOperations,
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
        };
      case "repository-inspect-current":
      case "repository-inspect":
        return inspectRepository(root);
      case "repository-fetch":
        return this.folders.fetch(projectId);
      case "repository-git-status":
        return operations.repositories.gitStatus(root);
      case "repository-source-inspect":
        return operations.repositories.inspectSourcePage(root, input.route);
      case "repository-source-draft-read":
        return (await drafts()).read(root, input.route);
      case "repository-source-draft-save":
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
        const entry = operations.require(input.planId, actor.id, "files");
        // Consume before a write, including failures with unknown/partial outcomes; never resend an old plan.
        operations.issued.delete(input.planId);
        const result = await operations.repositories.apply(
          input.planId,
          projectId,
        );
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
      case "repository-build-review": {
        const plan = await operations.runner.prepare(root, projectId);
        remember(plan, "build");
        return plan;
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
  async close() {
    this.closed = true;
    await this.folders.idle();
    await Promise.all(
      [...this.projects.values()].map((project) => project.runner.close()),
    );
    this.projects.clear();
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
  let active = 0;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    let counted = false;
    try {
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
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "POST");
        response.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
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
      const value = await options.service.request(match[1], () =>
        requestBody(request),
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
  return {
    server,
    origin: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 4334}`,
    close: async () => {
      const stopped = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );
      await options.service.close();
      server.closeAllConnections();
      await stopped;
    },
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
  );
  const access = new HostedRepositoryAccess({
    url: process.env.BUILDER_HOSTED_SUPABASE_URL || "",
    anonKey: process.env.BUILDER_HOSTED_SUPABASE_ANON_KEY || "",
  });
  const port = Number(process.env.BUILDER_HOSTED_PORT || 4334);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const helper = await startHostedHelper({
    service: new HostedHelperService(folders, access),
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
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  void main().catch(() => {
    console.error(
      "Hosted helper could not start. Check its server-only configuration and file permissions.",
    );
    process.exitCode = 1;
  });
