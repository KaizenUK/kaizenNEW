import { saveClientSettings } from "../shared/builderSettings";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  copyFile,
  unlink,
} from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { LocalProjects } from "./builder-projects";
import { RepositoryRunner } from "./builder-runner";
import { SourceDrafts } from "./builder-source-drafts";
import { NativeRepositoryBackups } from "./builder-native-backup";
import { ClientPublisher } from "./builder-client-publisher";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  RepositoryCompanion,
  inspectRepository,
  readEditableArchive,
} from "./builder-repository";
import { LEGACY_PROJECT_ID } from "../shared/builderProjects";
import { randomUUID, createHash } from "node:crypto";
import { localUploadServer } from "./builder-uploads";
import { localPreviewAction } from "./builder-previews";
import {
  saveRoutes,
  publishLocalRoutes,
  assertLocalPublicationRoutes,
} from "../shared/builderRoutes";
import {
  canonicalRedirectPath,
  technicalRoute,
} from "../shared/builderRedirects.js";
import type { Plugin } from "vite";
import { attachAssetImage, materializeImages } from "../shared/builderImages";
import { applyRestorePlan } from "../shared/builderBackup";
import { saveConversion } from "../shared/builderConversions";
import {
  replaceAssetInDrafts,
  updateAssetMetadata,
} from "../shared/builderLibrary";
import { getServerContentCatalogue } from "./builder-content";
import { fetchContentCatalogue } from "../shared/builderContent";
import { ContactError, handleContactRequest } from "../shared/builderContact";
import {
  assertPageSitePublished,
  publishSiteWorkspace,
  saveSiteDesign,
} from "../shared/builderSite";
import {
  clone,
  normalizeSlug,
  savePage,
  type Workspace,
  type Asset,
} from "../shared/visualBuilder";
// Test runs can use a separate workspace without touching the user's local pages.
const directory = path.resolve(
  process.env.BUILDER_LOCAL_DIRECTORY || ".kaizen-builder",
);
export async function readLocalWorkspace(
  folder = directory,
): Promise<Workspace> {
  try {
    return JSON.parse(
      await readFile(path.join(folder, "workspace.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return { pages: [], assets: [], saved: [] };
    throw error;
  }
}
async function writeLocalWorkspace(workspace: Workspace, directory: string) {
  const database = path.join(directory, "workspace.json");
  await mkdir(directory, { recursive: true });
  const temporary = `${database}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(workspace));
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temporary, database);
        break;
      } catch (error) {
        // Windows scanners/readers can briefly hold the destination. Keep the old
        // complete file in place and retry the same atomic rename, never truncate it.
        if (
          process.platform !== "win32" ||
          !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
          attempt >= 5
        )
          throw error;
        await delay(50 * 2 ** attempt);
      }
    }
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
// Astro's trailing-slash guard runs ahead of ordinary Vite middleware.
// Run only published GET/HEAD redirects first; editor APIs keep their existing guards.
export function builderLocalRedirectsPlugin(): Plugin {
  return {
    name: "kaizen-builder-local-redirects",
    apply: "serve",
    configureServer: {
      order: "post",
      handler(server) {
        return () => {
          server.middlewares.stack.unshift({
            route: "",
            handle: async (req, res, next) => {
              const url = new URL(req.url || "/", "http://localhost");
              if (
                !["GET", "HEAD"].includes(req.method || "") ||
                technicalRoute.test(url.pathname) ||
                /^\/(?:@|node_modules|client|src|shared|scripts|tests|test-results)/.test(
                  url.pathname,
                )
              )
                return next();
              let source: string;
              try {
                source = canonicalRedirectPath(url.pathname);
              } catch {
                return next();
              }
              try {
                const rule = (
                  await readLocalWorkspace()
                ).routes?.published.find((rule) => rule.source === source);
                if (!rule) return next();
                res.statusCode = rule.status;
                res.setHeader("Location", rule.destination + url.search);
                res.setHeader("Cache-Control", "no-store");
                res.end();
              } catch {
                res.statusCode = 503;
                res.setHeader("Content-Type", "text/plain");
                res.setHeader("Cache-Control", "no-store");
                res.end(
                  "The local builder workspace could not be read. Check the workspace file and retry.",
                );
              }
            },
          });
        };
      },
    },
  };
}
export function builderLocalPlugin(): Plugin {
  let queue: Promise<unknown> = Promise.resolve();
  const projects = new LocalProjects(directory);
  const repositories = new RepositoryCompanion();
  const nativeBackups = new NativeRepositoryBackups();
  const sourceDraftPlans = new Map<string, {root: string; route: string; version: number}>();
  const runner = new RepositoryRunner();
  let compilerServer: any;
  const publisher = new ClientPublisher({
    directory: (id) => projects.directory(id),
    require: (id) => projects.require(id, true),
    workspace: (id) => readLocalWorkspace(projects.directory(id)),
    registry: () => process.env.BUILDER_CLIENT_DESTINATIONS_FILE,
    samplesRoot: path.resolve("public/builder-samples"),
    compile: async (snapshot, load, progress) => {
      const module = await compilerServer.ssrLoadModule(
        "/client/visual-builder/compileClientPublication.tsx",
      );
      return module.compileClientPublication(snapshot, load, progress);
    },
    adapters: () => {
      const prefix = process.env.BUILDER_CLIENT_NGINX_PREFIX;
      if (!prefix) return {};
      if (!path.isAbsolute(prefix))
        throw new Error("The configured Nginx prefix must be absolute.");
      const run = promisify(execFile);
      const nginx = (args: string[]) =>
        run(
          process.env.BUILDER_CLIENT_NGINX_BINARY || "nginx",
          ["-p", prefix.replace(/\\/g, "/") + "/", "-c", "nginx.conf", ...args],
          { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 },
        );
      return {
        validateConfig: () => nginx(["-t"]),
        reload: () => nginx(["-s", "reload"]),
      };
    },
  });
  const uploadServers = new Map<string, ReturnType<typeof localUploadServer>>();
  return {
    name: "kaizen-builder-local",
    apply: "serve",
    configureServer(server) {
      compilerServer = server;
      server.httpServer?.once("close", () => {
        void runner.close();
        void publisher.close();
      });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const resumable =
          url.pathname === "/__builder-upload" ||
          url.pathname.startsWith("/__builder-upload/");
        const media = url.pathname.match(
          /^\/builder-media\/([\w-]+)(?:\.[a-z0-9]+)?\/?$/,
        );
        if (
          !media &&
          !resumable &&
          ![
            "/__builder-local",
            "/__builder-contact",
            "/__builder-content",
            "/__builder-projects",
          ].includes(url.pathname)
        ) {
          return next();
        }
        const json = (status: number, value: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(value));
        };
        try {
          const projectId = String(
            req.headers["x-kaizen-project"] ||
              url.searchParams.get("project") ||
              LEGACY_PROJECT_ID,
          );
          // Request-local scope; no process-global active project or cookie. Multiple tabs stay isolated.
          const project = await projects.require(
            projectId,
            url.pathname !== "/__builder-projects" &&
              !["GET", "HEAD"].includes(req.method || "GET"),
          );
          const directory = projects.directory(project.id);
          const readWorkspace = () => readLocalWorkspace(directory);
          const writeWorkspace = (workspace: Workspace) => {
            if (projectId === LEGACY_PROJECT_ID)
              for (const page of workspace.pages) {
                normalizeSlug(page.draft.slug);
                if (page.published) normalizeSlug(page.published.slug);
              }
            return writeLocalWorkspace(workspace, directory);
          };
          if (!uploadServers.has(projectId))
            uploadServers.set(projectId, localUploadServer(directory));
          const uploads = uploadServers.get(projectId)!;
          if (media) {
            const workspace = await readWorkspace();
            const asset = workspace.assets.find((a) => a.id === media[1]);
            if (!asset) return json(404, { error: "Asset not found" });
            res.setHeader("Content-Type", asset.mime);
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            );
            if (!["image", "icon", "font"].includes(asset.kind))
              res.setHeader("Content-Disposition", "attachment");
            res.end(await readFile(path.join(directory, "assets", asset.id)));
            return;
          }
          const host = new URL(`http://${req.headers.host}`).hostname;
          const remote = req.socket.remoteAddress || "";
          if (
            !["localhost", "127.0.0.1", "[::1]"].includes(host) ||
            !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)
          )
            return json(403, {
              error: "The local builder is available on this computer only.",
            });
          if (
            req.headers.origin &&
            new URL(req.headers.origin).host !== req.headers.host
          )
            return json(403, {
              error: "Cross-origin requests are not allowed.",
            });
          if (req.headers["sec-fetch-site"] === "cross-site")
            return json(403, { error: "Cross-site requests are not allowed." });
          if (url.pathname === "/__builder-projects") {
            if (req.method === "GET")
              return json(
                200,
                await publisher.catalogue(await projects.list()),
              );
            if (
              req.method !== "POST" ||
              req.headers["x-kaizen-builder"] !== "1"
            )
              return json(405, { error: "Unsupported request" });
            let body = "";
            for await (const chunk of req) {
              body += chunk.toString();
              if (body.length > 8192)
                return json(413, { error: "Project request is too large." });
            }
            const input = JSON.parse(body);
            // Serialize duplication with writes so pages and asset files are one consistent snapshot.
            const pending = queue.then(() => projects.mutate(input));
            queue = pending.catch(() => undefined);
            return json(200, await pending);
          }
          if (resumable) {
            if (req.headers["x-kaizen-builder"] !== "1")
              return json(403, { error: "Builder upload header required." });
            await uploads.handle(req, res);
            return;
          }
          if (url.pathname === "/__builder-content") {
            if (req.method !== "GET")
              return json(405, { error: "Unsupported request" });
            try {
              if (projectId !== LEGACY_PROJECT_ID) {
                const cms = (await readWorkspace()).settings?.value.cms;
                if (cms?.kind !== "sanity-public")
                  throw new Error(
                    "Configure this project's public Sanity connection in Client settings first.",
                  );
                return json(
                  200,
                  await fetchContentCatalogue({
                    projectId: cms.projectId,
                    dataset: cms.dataset,
                  }),
                );
              }
              return json(200, await getServerContentCatalogue(true));
            } catch (error) {
              return json(503, {
                error:
                  error instanceof Error
                    ? error.message
                    : "Sanity content could not be loaded.",
              });
            }
          }
          if (url.pathname === "/__builder-contact") {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 16_384)
                return json(413, { error: "Your message is too long." });
              chunks.push(chunk);
            }
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers))
              if (typeof value === "string") headers.set(key, value);
            const response = await handleContactRequest(
              new Request(`http://${req.headers.host}${req.url}`, {
                method: req.method,
                headers,
                ...(!["GET", "HEAD"].includes(req.method || "GET")
                  ? { body: Buffer.concat(chunks) }
                  : {}),
              }),
              {
                allowedOrigins: [`http://${req.headers.host}`],
                async submit(id, record) {
                  const operation = async () => {
                    const file = path.join(
                      directory,
                      "contact-submissions.json",
                    );
                    let records: {
                      id: string;
                      createdAt: number;
                      record: typeof record;
                    }[] = [];
                    try {
                      records = JSON.parse(await readFile(file, "utf8"));
                    } catch (error) {
                      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                        throw error;
                    }
                    const existing = records.find((item) => item.id === id);
                    if (existing) {
                      if (
                        JSON.stringify(existing.record) !==
                        JSON.stringify(record)
                      )
                        throw new ContactError(
                          "This request has changed. Reload the page before sending it again.",
                          409,
                        );
                      return;
                    }
                    if (
                      records.filter(
                        (item) =>
                          item.record.email === record.email &&
                          item.createdAt > Date.now() - 600_000,
                      ).length >= 5
                    )
                      throw new ContactError(
                        "Too many messages. Please wait ten minutes and try again.",
                        429,
                      );
                    records.push({ id, createdAt: Date.now(), record });
                    await mkdir(directory, { recursive: true });
                    await writeFile(
                      file + ".tmp",
                      JSON.stringify(records, null, 2),
                    );
                    await rename(file + ".tmp", file);
                  };
                  const pending = queue.then(operation, operation);
                  queue = pending.catch(() => {});
                  await pending;
                },
              },
            );
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(await response.text());
            return;
          }
          if (req.method === "GET" && url.searchParams.has("scope"))
            return json(200, {
              scope: createHash("sha256").update(directory).digest("hex"),
            });
          if (req.method === "GET" && url.searchParams.has("asset"))
            return json(
              200,
              (await readWorkspace()).assets.find(
                (asset) => asset.id === url.searchParams.get("asset"),
              ) || null,
            );
          if (req.method === "GET") {
            const workspace = await readWorkspace();
            return json(
              200,
              projectId === LEGACY_PROJECT_ID
                ? workspace
                : await publisher.workspace(projectId, workspace),
            );
          }
          if (req.method !== "POST" || req.headers["x-kaizen-builder"] !== "1")
            return json(405, { error: "Unsupported request" });
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 52 * 1024 * 1024)
              return json(413, { error: "Files must be smaller than 50 MB." });
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks);
          const operation = async () => {
            await projects.require(projectId, true);
            const workspace = await readWorkspace();
            if (url.searchParams.get("action") === "finish-upload") {
              const input = JSON.parse(body.toString()),
                metadata = input.asset as Asset;
              const existing = workspace.assets.find(
                (asset) => asset.id === metadata.id,
              );
              if (existing) {
                if (
                  existing.hash !== metadata.hash ||
                  existing.pack !== metadata.pack ||
                  existing.path !== metadata.path
                )
                  throw new Error("This asset ID is already in use.");
                return existing;
              }
              const asset = await uploads.finish(input.uploadUrl, metadata);
              if (projectId !== LEGACY_PROJECT_ID)
                asset.url += `?project=${projectId}`;
              workspace.assets.push(asset);
              await writeWorkspace(workspace);
              await uploads.release(input.uploadUrl).catch(() => {});
              return asset;
            }
            if (url.searchParams.get("action") === "upload") {
              const metadata = JSON.parse(
                decodeURIComponent(
                  String(req.headers["x-asset-metadata"] || "{}"),
                ),
              ) as Asset;
              if (
                !/^[\w-]+$/.test(metadata.id) ||
                !/^[a-f0-9]{64}$/.test(metadata.hash)
              )
                throw new Error("Invalid asset metadata");
              const existing = workspace.assets.find(
                (a) =>
                  a.hash === metadata.hash &&
                  a.pack === metadata.pack &&
                  a.path === metadata.path,
              );
              if (existing) return existing;
              if (workspace.assets.some((asset) => asset.id === metadata.id))
                throw new Error(
                  "This asset ID is already in use. Upload a new file instead of overwriting an original.",
                );
              const extension =
                metadata.name
                  .split(".")
                  .pop()
                  ?.toLowerCase()
                  .replace(/[^a-z0-9]/g, "") || "bin";
              const asset = {
                ...metadata,
                url: `/builder-media/${metadata.id}.${extension}${projectId === LEGACY_PROJECT_ID ? "" : `?project=${projectId}`}`,
                size: body.length,
              };
              await mkdir(path.join(directory, "assets"), { recursive: true });
              await writeFile(path.join(directory, "assets", asset.id), body);
              workspace.assets.push(asset);
              await writeWorkspace(workspace);
              return asset;
            }
            const input = JSON.parse(body.toString("utf8"));
            if (
              input.action === "restore-backup" &&
              input.plan?.settings &&
              projectId === LEGACY_PROJECT_ID
            )
              throw new Error(
                "Restore client settings into a client project. The original site's services remain deployment-managed.",
              );
            if (input.action === "settings") {
              if (projectId === LEGACY_PROJECT_ID)
                throw new Error(
                  "The original Kaizen site's services remain configured in its deployment environment. Use a client project for these settings.",
                );
              workspace.settings = saveClientSettings(
                workspace.settings,
                input.version,
                input.settings,
              );
              await writeWorkspace(workspace);
              return workspace.settings;
            }
            if (input.action === "repository-inspect")
              return inspectRepository(input.root);
            if (input.action === "repository-native-backup-review")
              return nativeBackups.capture(input.root, projectId, directory);
            if (input.action === "repository-native-backup-download")
              return {archive: nativeBackups.download(input.reviewId, projectId)};
            if (input.action === "repository-native-restore-review")
              return nativeBackups.reviewRestore(input.root, projectId, Buffer.from(input.archive, 'base64'));
            if (input.action === "repository-native-restore-apply")
              return nativeBackups.restore(input.reviewId, projectId, directory);
            if (input.action === "repository-native-review-discard") {
              nativeBackups.discard(input.reviewId, projectId);
              return {discarded:true};
            }
            if (input.action === "repository-inspect-current")
              return inspectRepository(server.config.root);
            if (input.action === "repository-source-inspect")
              return repositories.inspectSourcePage(input.root, input.route);
            if (input.action === "repository-source-preview")
              return runner.sourcePreview(input.jobId, projectId, await repositories.inspectSourcePage(input.root, input.route), req.headers.origin || "");
            if (input.action === "repository-source-draft-read")
              return new SourceDrafts(directory).read(input.root, input.route);
            if (input.action === "repository-source-draft-save")
              return new SourceDrafts(directory).save(input.root, input.route, input.version, input.edits);
            if (input.action === "repository-source-prepare") {
              let draft;
              if (input.draftVersion !== undefined) {
                draft = await new SourceDrafts(directory).read(input.edits.inspection.root, input.edits.inspection.route);
                if (draft.version !== input.draftVersion || JSON.stringify(draft.edits) !== JSON.stringify(input.edits))
                  throw new Error("Save the latest editing draft before reviewing it.");
              }
              const plan = await repositories.prepareSource(projectId, input.edits);
              if (draft) sourceDraftPlans.set(plan.id, {root: draft.root, route: draft.route, version: draft.version});
              if (sourceDraftPlans.size > 100) sourceDraftPlans.delete(sourceDraftPlans.keys().next().value!);
              return plan;
            }
            if (input.action === "client-release-list")
              return {
                destinations: await publisher.destinations(projectId),
                ...clientHistoryPage(
                  await publisher.jobs(projectId),
                  input.before,
                ),
              };
            if (input.action === "client-release-review")
              return publisher.review(
                projectId,
                input.destinationId,
                input.releaseAction,
                input.rollbackOf,
              );
            if (input.action === "client-release-start")
              return publisher.start(projectId, input.reviewId);
            if (input.action === "client-release-recover")
              return publisher.recover(projectId, input.jobId);
            if (input.action === "repository-build-review")
              return runner.prepare(input.root, projectId);
            if (input.action === "repository-build-start")
              return runner.start(input.planId, projectId);
            if (input.action === "repository-build-status")
              return runner.status(input.jobId, projectId);
            if (input.action === "repository-build-stop")
              return runner.cancel(input.jobId, projectId);
            if (input.action === "repository-prepare")
              return repositories.prepare(
                input.root,
                projectId,
                Buffer.from(input.archive, "base64"),
              );
            if (input.action === "repository-apply") {
              const result = await repositories.apply(input.planId, projectId);
              const draft = sourceDraftPlans.get(input.planId);
              sourceDraftPlans.delete(input.planId);
              if (draft) {
                try { await new SourceDrafts(directory).save(draft.root, draft.route, draft.version, null); }
                catch { result.message += " The saved editing draft was retained; reopen it to review or discard it."; }
              }
              return result;
            }
            if (input.action === "repository-open") {
              const archive = readEditableArchive(
                await repositories.editableArchive(input.root),
              );
              return projects.importWorkspace(
                input.name || path.basename(input.root),
                archive.workspace,
                archive.files,
              );
            }
            if (
              projectId !== LEGACY_PROJECT_ID &&
              ["publish", "publish-site", "publish-routes"].includes(
                input.action,
              )
            )
              throw new Error(
                "This client project has no publication destination. Export it for an isolated host; the Kaizen local site is reserved for the original workspace.",
              );
            if (input.action === "routes") {
              workspace.routes = saveRoutes(
                workspace.routes,
                input.version,
                input.rules,
              );
              await writeWorkspace(workspace);
              return workspace.routes;
            }
            if (input.action === "publish-routes") {
              const next = publishLocalRoutes(workspace, input.version);
              await writeWorkspace(next);
              return next;
            }
            if (
              [
                "preview-create",
                "preview-read",
                "preview-list",
                "preview-revoke",
              ].includes(input.action)
            )
              return localPreviewAction(directory, input);
            if (input.action === "asset-conversion") {
              const asset = saveConversion(
                workspace.assets,
                input.expected,
                input.draft,
              );
              workspace.assets = workspace.assets.map((item) =>
                item.id === asset.id ? asset : item,
              );
              await writeWorkspace(workspace);
              return asset;
            }
            if (input.action === "asset-image") {
              const asset = attachAssetImage(
                workspace.assets,
                input.expected,
                input.image,
              );
              workspace.assets = workspace.assets.map((item) =>
                item.id === asset.id ? asset : item,
              );
              await writeWorkspace(workspace);
              return asset;
            }
            if (input.action === "restore-backup") {
              const next = applyRestorePlan(workspace, input.plan);
              await writeWorkspace(next);
              return next;
            }
            if (input.action === "site") {
              workspace.site = saveSiteDesign(
                workspace.site,
                input.version,
                input.design,
              );
              await writeWorkspace(workspace);
              return workspace.site;
            }
            if (input.action === "publish-site") {
              const next = publishSiteWorkspace(
                workspace,
                input.version,
                input.pageVersions,
              );
              assertLocalPublicationRoutes(next);
              await writeWorkspace(next);
              for (const [name, environment] of Object.entries(
                server.environments,
              ))
                if (name !== "client")
                  environment.hot.send("astro:content-changed", {});
              return next;
            }
            if (input.action === "save") {
              if (projectId === LEGACY_PROJECT_ID)
                normalizeSlug(input.document?.slug);
              if (
                workspace.routes?.published.some(
                  (rule) =>
                    rule.source === canonicalRedirectPath(input.document?.slug),
                )
              )
                throw new Error(
                  "This URL has a published redirect. Remove and publish that redirect first.",
                );
              const page = savePage(
                workspace.pages,
                input.document,
                input.id,
                input.version,
                input.label,
              );
              workspace.pages = workspace.pages.some((p) => p.id === page.id)
                ? workspace.pages.map((p) => p.id === page.id ? page : p)
                : [...workspace.pages, page];
              await writeWorkspace(workspace);
              return page;
            }
            if (input.action === "publish") {
              const page = workspace.pages.find((p) => p.id === input.id);
              if (!page || page.version !== input.version)
                throw new Error("Save the current draft before publishing.");
              page.published = materializeImages(
                assertPageSitePublished(page.draft, workspace.site),
                workspace.assets,
              );
              page.publishedAt = new Date().toISOString();
              page.version++;
              page.revisions.push({
                id: randomUUID(),
                createdAt: page.publishedAt,
                label: "Published",
                document: clone(page.draft),
              });
              page.revisions = page.revisions.slice(-50);
              assertLocalPublicationRoutes(workspace);
              await writeWorkspace(workspace);
              // Astro 6 caches getStaticPaths results. Notify the server renderer after publication.
              for (const [name, environment] of Object.entries(
                server.environments,
              )) {
                if (name !== "client")
                  environment.hot.send("astro:content-changed", {});
              }
              return page;
            }
            if (input.action === "asset") {
              const asset = workspace.assets.find(
                (a) => a.id === input.asset.id,
              );
              if (!asset) throw new Error("Asset not found");
              Object.assign(asset, {
                tags: input.asset.tags,
                favourite: Boolean(input.asset.favourite),
              });
              await writeWorkspace(workspace);
              return asset;
            }
            if (input.action === "asset-metadata") {
              workspace.assets = updateAssetMetadata(
                workspace.assets,
                input.changes,
              );
              await writeWorkspace(workspace);
              return workspace.assets.filter((asset) =>
                input.changes.some((change) => change.id === asset.id),
              );
            }
            if (input.action === "replace-asset") {
              const next = replaceAssetInDrafts(workspace, input.review);
              await writeWorkspace(next);
              return next;
            }
            if (input.action === "saved") {
              workspace.saved = [
                ...workspace.saved.filter((s) => s.id !== input.item.id),
                input.item,
              ];
              await writeWorkspace(workspace);
              return input.item;
            }
            throw new Error("Unknown builder operation");
          };
          const pending = queue.then(operation);
          queue = pending.catch(() => undefined);
          json(200, await pending);
        } catch (error) {
          json(400, {
            error:
              error instanceof Error
                ? error.message
                : "Unable to save. Please try again.",
          });
        }
      });
    },
  };
}
export function builderLocalAssets() {
  return {
    name: "kaizen-builder-local-assets",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        if (process.env.BUILDER_LOCAL_BUILD !== "1") return;
        const workspace = await readLocalWorkspace();
        const published = JSON.stringify(
          workspace.pages.map((p) => p.published),
        );
        const destination = new URL("builder-media/", dir);
        await mkdir(destination, { recursive: true });
        for (const asset of workspace.assets)
          if (
            ["image", "icon", "font"].includes(asset.kind) &&
            published.includes(asset.url)
          )
            await copyFile(
              path.join(directory, "assets", asset.id),
              new URL(path.basename(asset.url), destination),
            );
      },
    },
  };
}
import { clientHistoryPage } from "../shared/builderClientPublication";
