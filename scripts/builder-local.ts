import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import {
  clone,
  savePage,
  type Workspace,
  type Asset,
} from "../shared/visualBuilder";
const directory = path.resolve(".kaizen-builder");
const database = path.join(directory, "workspace.json");
export async function readLocalWorkspace(): Promise<Workspace> {
  try {
    return JSON.parse(await readFile(database, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { pages: [], assets: [], saved: [] };
    throw error;
  }
}
async function writeWorkspace(workspace: Workspace) {
  await mkdir(directory, { recursive: true });
  const temporary = `${database}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(workspace));
  await rename(temporary, database);
}
export function builderLocalPlugin(): Plugin {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    name: "kaizen-builder-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const media = url.pathname.match(
          /^\/builder-media\/([\w-]+)(?:\.[a-z0-9]+)?\/?$/,
        );
        if (!media && url.pathname !== "/__builder-local") return next();
        const json = (status: number, value: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(value));
        };
        try {
          if (media) {
            const workspace = await readLocalWorkspace();
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
          if (req.method === "GET")
            return json(200, await readLocalWorkspace());
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
            const workspace = await readLocalWorkspace();
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
              const extension =
                metadata.name
                  .split(".")
                  .pop()
                  ?.toLowerCase()
                  .replace(/[^a-z0-9]/g, "") || "bin";
              const asset = {
                ...metadata,
                url: `/builder-media/${metadata.id}.${extension}`,
                size: body.length,
              };
              await mkdir(path.join(directory, "assets"), { recursive: true });
              await writeFile(path.join(directory, "assets", asset.id), body);
              workspace.assets.push(asset);
              await writeWorkspace(workspace);
              return asset;
            }
            const input = JSON.parse(body.toString("utf8"));
            if (input.action === "save") {
              const page = savePage(
                workspace.pages,
                input.document,
                input.id,
                input.version,
                input.label,
              );
              workspace.pages = [
                ...workspace.pages.filter((p) => p.id !== page.id),
                page,
              ];
              await writeWorkspace(workspace);
              return page;
            }
            if (input.action === "publish") {
              const page = workspace.pages.find((p) => p.id === input.id);
              if (!page || page.version !== input.version)
                throw new Error("Save the current draft before publishing.");
              page.published = clone(page.draft);
              page.publishedAt = new Date().toISOString();
              page.version++;
              page.revisions.push({
                id: randomUUID(),
                createdAt: page.publishedAt,
                label: "Published",
                document: clone(page.draft),
              });
              page.revisions = page.revisions.slice(-50);
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
