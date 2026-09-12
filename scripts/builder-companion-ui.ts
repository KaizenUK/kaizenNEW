import path from "node:path";
import { build, type Plugin } from "vite";

const prefix = "/__builder-companion-ui/";

/** The consent window must survive website builds and source hot reloads. */
export function builderCompanionUiPlugin(sourceRoot = process.cwd()): Plugin {
  let bundle:
    | Promise<{
        html: string;
        files: Map<string, { body: string | Uint8Array; type: string }>;
      }>
    | undefined;
  function assets() {
    return (bundle ??= (async () => {
      const result = await build({
        configFile: false,
        envDir: false,
        root: sourceRoot,
        publicDir: false,
        logLevel: "error",
        // The enclosing dev server uses development JSX; this standalone bundle
        // carries production React and must use its matching JSX runtime.
        oxc: { jsx: { development: false } },
        // This bundle is served only by the loopback development helper.
        define: {
          "import.meta.env.DEV": "true",
          "process.env.NODE_ENV": '"production"',
        },
        build: {
          write: false,
          emptyOutDir: false,
          cssCodeSplit: false,
          sourcemap: false,
          lib: {
            entry: path.join(
              sourceRoot,
              "client/visual-builder/companion-entry.tsx",
            ),
            formats: ["es"],
            fileName: "companion",
          },
        },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap(
        (item) => {
          if (!("output" in item))
            throw new Error("The helper UI must build once without a watcher.");
          return item.output;
        },
      );
      const files = new Map<
        string,
        { body: string | Uint8Array; type: string }
      >();
      for (const file of outputs)
        files.set(prefix + file.fileName, {
          body: file.type === "chunk" ? file.code : file.source,
          type: file.fileName.endsWith(".css") ? "text/css" : "text/javascript",
        });
      const entry = outputs.find(
        (file) => file.type === "chunk" && file.isEntry,
      );
      if (!entry) throw new Error("The helper UI entry was not generated.");
      const styles = outputs
        .filter((file) => file.fileName.endsWith(".css"))
        .map(
          (file) => `<link rel="stylesheet" href="${prefix}${file.fileName}">`,
        )
        .join("");
      return {
        files,
        html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Kaizen local companion</title><link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Poppins:wght@500;600&amp;display=swap">${styles}</head><body style="margin:0"><div id="companion"></div><script type="module" src="${prefix}${entry.fileName}"></script></body></html>`,
      };
    })().catch((error) => {
      bundle = undefined;
      throw error;
    }));
  }
  return {
    name: "kaizen-stable-companion-window",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || "/", "http://localhost").pathname;
        const page =
          pathname === "/builder/companion/" ||
          pathname === "/builder/companion";
        if (!page && !pathname.startsWith(prefix)) return next();
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.end("Use GET or HEAD.");
          return;
        }
        try {
          const generated = await assets();
          const file = page
            ? { body: generated.html, type: "text/html" }
            : generated.files.get(pathname);
          if (!file) {
            res.statusCode = 404;
            res.end("Not found.");
            return;
          }
          res.setHeader("Content-Type", `${file.type}; charset=utf-8`);
          res.end(req.method === "HEAD" ? undefined : file.body);
        } catch (error) {
          server.config.logger.error(
            `Companion window build failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          res.statusCode = 503;
          res.end(
            "The helper window could not load. Restart pnpm dev and connect again.",
          );
        }
      });
    },
  };
}
