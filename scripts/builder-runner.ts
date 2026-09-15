/** Local build commands are explicitly reviewed. Only a frozen static dist is served. */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  lstat,
  readFile,
  readdir,
  mkdir,
  rename,
  writeFile,
} from "node:fs/promises";
import {
  SandboxCleanupError,
  type SandboxBuild,
  type SandboxCommand,
} from "./builder-build-sandbox";
import path from "node:path";
import type { ControlledBuild } from "./builder-controlled-build";
import { inspectRepository } from "./builder-repository";
import { measureRepositorySource } from "./builder-repository-usage.mjs";
const digest = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");
import type { SourceInspection } from "../shared/builderSourceEditing";
import { frameCss, frameHtml } from "./builder-source-frame";
import {
  sourcePreviewPath,
  sourceSelectionScript,
  sourceEditingScript,
} from "./builder-source-preview";

export type BuildPlan = {
  id: string;
  sessionId: string;
  projectId: string;
  root: string;
  command: string;
  scripts: { name: string; command: string }[];
  fingerprint: string;
  expiresAt: number;
};
export type BuildJob = {
  id: string;
  projectId: string;
  root: string;
  command: string;
  status: "queued" | "building" | "succeeded" | "failed" | "cancelled";
  queuedAt?: string;
  queuePosition?: number;
  cancelling?: boolean;
  startedAt?: string;
  finishedAt?: string;
  log: string;
  error?: string;
  previewUrl?: string;
  previewExpiresAt?: number;
  recoveryDirectory: string;
  recoveryRequired?: boolean;
};
type Command = { cli: string; manager: "pnpm" | "npm" };
type Running = {
  value: BuildJob;
  fingerprint?: string;
  files?: Map<string, Buffer>;
  selection?: { nonce: string; path: string; script: string };
  frames?: Map<string, { path: string; script: string; origin: string }>;
  child?: ChildProcess;
  buildAbort?: AbortController;
  server?: Server;
  done?: Promise<void>;
  cancel?: string;
  timer?: NodeJS.Timeout;
};
async function exists(file: string) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
}
async function realDirectory(root: string, relative: string) {
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    const stat = await exists(current);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
      throw new Error(`Expected a real directory: ${relative}`);
  }
  return current;
}
async function sourceFingerprint(root: string) {
  return (await measureRepositorySource(root)).revision;
}
async function packageCommand(): Promise<Command> {
  const inherited = process.env.npm_execpath;
  const candidates = [
    inherited,
    path.join(
      path.dirname(process.execPath),
      "node_modules/corepack/dist/pnpm.js",
    ),
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
  ];
  for (const cli of candidates) {
    if (
      !cli ||
      !path.isAbsolute(cli) ||
      !/\.(?:c?js|mjs)$/.test(cli) ||
      !(await exists(cli))
    )
      continue;
    const name = path.basename(cli);
    if (/^pnpm\.(?:c?js|mjs)$/.test(name)) return { cli, manager: "pnpm" };
    if (name === "npm-cli.js") return { cli, manager: "npm" };
  }
  throw new Error(
    "Start the companion with pnpm dev or install Node with npm to run builds.",
  );
}
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
async function snapshot(root: string) {
  const files = new Map<string, Buffer>();
  let size = 0;
  let entries = 0;
  async function walk(folder: string) {
    for (const entry of await readdir(path.join(root, folder), {
      withFileTypes: true,
    })) {
      if (
        entry.name.startsWith(".") ||
        [
          "node_modules",
          "src",
          "scripts",
          "package.json",
          "package-lock.json",
          "pnpm-lock.yaml",
        ].includes(entry.name) ||
        entry.name.endsWith(".map")
      )
        continue;
      const name = folder ? `${folder}/${entry.name}` : entry.name;
      if (++entries > 10000)
        throw new Error(
          "Static previews support up to 10,000 files and directories.",
        );
      if (entry.isSymbolicLink())
        throw new Error(`Static output contains a symbolic link: ${name}`);
      if (entry.isDirectory()) await walk(name);
      else {
        const stat = await lstat(path.join(root, name));
        size += stat.size;
        if (
          !stat.isFile() ||
          stat.size > 32 * 1024 * 1024 ||
          size > 200 * 1024 * 1024 ||
          files.size >= 10000
        )
          throw new Error(
            "Static previews support 10,000 files, 32 MB per file and 200 MB total.",
          );
        files.set(`/${name}`, await readFile(path.join(root, name)));
      }
    }
  }
  await walk("");
  if (!files.has("/index.html"))
    throw new Error(
      "Build completed without dist/index.html. Only static sites using dist/ are supported.",
    );
  return files;
}
async function stopChild(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve, reject) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.once("error", reject);
      killer.once("exit", () => resolve());
    });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

export class RepositoryRunner {
  private sessionId = randomUUID();
  private plans = new Map<string, { value: BuildPlan; command: Command }>();
  private jobs = new Map<string, Running>();
  private locks = new Set<string>();
  private closed = false;
  constructor(
    private timeoutMs = 5 * 60 * 1000,
    private previewMs = 60 * 60 * 1000,
    private options: {
      environment?: NodeJS.ProcessEnv;
      watchStorage?: (
        stop: (error: Error) => Promise<void>,
      ) => Promise<() => Promise<void>>;
      beforeBuild?: (job: BuildJob, fingerprint: string) => Promise<void>;
      afterBuild?: (job: BuildJob) => Promise<void>;
      controlledBuild?: (input: ControlledBuild) => Promise<number | null>;
      isolatedBuild?: {
        command: () => Promise<SandboxCommand>;
        run: (input: SandboxBuild) => Promise<Map<string, Buffer>>;
      };
    } = {},
  ) {}
  async prepare(root: string, projectId: string): Promise<BuildPlan> {
    if (this.closed) throw new Error("The local companion is shutting down.");
    const inspection = await inspectRepository(root);
    if (!["astro-react", "kaizen-export"].includes(inspection.framework))
      throw new Error(
        "Integrate an Astro + React or Kaizen static export before building.",
      );
    root = inspection.root;
    const fingerprint = await sourceFingerprint(root);
    const pkg = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    );
    if (typeof pkg.scripts?.build !== "string" || !pkg.scripts.build.trim())
      throw new Error(
        "Add a build script to package.json before using the companion.",
      );
    const command = await (this.options.isolatedBuild?.command() ??
      packageCommand());
    if ((await sourceFingerprint(root)) !== fingerprint)
      throw new Error(
        "Repository files changed during the command review. Review the build again.",
      );
    const value: BuildPlan = {
      id: randomUUID(),
      sessionId: this.sessionId,
      projectId,
      root,
      command: `${command.manager} run build`,
      scripts: ["prebuild", "build", "postbuild"]
        .filter((name) => typeof pkg.scripts[name] === "string")
        .map((name) => ({ name, command: pkg.scripts[name] })),
      fingerprint,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    for (const [id, plan] of this.plans)
      if (plan.value.expiresAt < Date.now()) this.plans.delete(id);
    if (this.plans.size >= 20)
      this.plans.delete(this.plans.keys().next().value!);
    this.plans.set(value.id, { value, command });
    return structuredClone(value);
  }
  async start(
    planId: string,
    projectId: string,
    beforePreview?: (
      files: ReadonlyMap<string, Buffer>,
      fingerprint: string,
    ) => Promise<void>,
  ): Promise<BuildJob> {
    const plan = this.plans.get(planId);
    if (
      this.closed ||
      !plan ||
      plan.value.projectId !== projectId ||
      plan.value.expiresAt < Date.now()
    )
      throw new Error(
        "Build review expired or belongs to another project. Review the command again.",
      );
    const { root, fingerprint } = plan.value;
    const key = process.platform === "win32" ? root.toLowerCase() : root;
    if (this.locks.has(key) || this.locks.size >= 2)
      throw new Error(
        "A build is already running for this repository, or two builds are active. Wait or cancel it first.",
      );
    this.locks.add(key);
    try {
      if (
        (await inspectRepository(root)).root !== root ||
        (await sourceFingerprint(root)) !== fingerprint
      )
        throw new Error(
          "Repository files changed since the command review. Review the build again.",
        );
      if (this.closed) throw new Error("The local companion is shutting down.");
      // Bound retained static snapshots and jobs. Never evict a running build.
      for (const [id, old] of this.jobs) {
        if (this.jobs.size < 8) break;
        if (old.value.status !== "building") {
          this.closePreview(old);
          this.jobs.delete(id);
        }
      }
      this.plans.delete(planId);
      const id = randomUUID();
      const running: Running = {
        value: {
          id,
          root,
          projectId,
          command: plan.value.command,
          status: "building",
          log: "",
          startedAt: new Date().toISOString(),
          recoveryDirectory: path.join(root, ".kaizen/build-recovery", id),
        },
      };
      this.jobs.set(id, running);
      running.done = this.execute(
        running,
        plan.command,
        fingerprint,
        beforePreview,
      ).finally(() => this.locks.delete(key));
      return structuredClone(running.value);
    } catch (error) {
      this.locks.delete(key);
      throw error;
    }
  }
  private require(id: string, projectId: string) {
    const running = this.jobs.get(id);
    if (!running || running.value.projectId !== projectId)
      throw new Error(
        "Build job was not found for this project. Jobs expire when the companion restarts.",
      );
    return running;
  }
  status(id: string, projectId: string) {
    return structuredClone(this.require(id, projectId).value);
  }
  async wait(id: string, projectId: string) {
    await this.require(id, projectId).done;
    return this.status(id, projectId);
  }
  /** Immutable build bytes for the authenticated hosted presenter; never reads a request path from disk. */
  previewFiles(id: string, projectId: string): ReadonlyMap<string, Buffer> {
    const running = this.require(id, projectId);
    if (
      !running.server ||
      !running.files ||
      running.value.status !== "succeeded"
    )
      throw new Error(
        "This preview expired or closed. Build the website again.",
      );
    return running.files;
  }
  async sourcePreview(
    id: string,
    projectId: string,
    inspection: SourceInspection,
    parentOrigin: string,
    paired = false,
    framed = false,
  ) {
    const running = this.require(id, projectId);
    const origin = new URL(parentOrigin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      (!paired &&
        !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) ||
      origin.origin !== parentOrigin
    )
      throw new Error("Source selection must be opened from the local editor.");
    if (
      running.value.root !== inspection.root ||
      !running.server ||
      !running.value.previewUrl ||
      running.value.status !== "succeeded"
    )
      throw new Error(
        "Build this repository before opening rendered selection.",
      );
    if ((await sourceFingerprint(inspection.root)) !== running.fingerprint)
      throw new Error(
        "Repository source changed after this build. Build again before selecting rendered content.",
      );
    const page = sourcePreviewPath(inspection.route);
    if (!running.files?.has(`${page}index.html`))
      throw new Error(
        "This static route is absent from the built preview. Check its base path or output configuration.",
      );
    const nonce = randomBytes(32).toString("hex");
    if (framed) {
      running.frames ??= new Map();
      if (running.frames.size >= 8)
        running.frames.delete(running.frames.keys().next().value!);
      running.frames.set(nonce, {
        path: page,
        origin: parentOrigin,
        script: sourceEditingScript(inspection, nonce, parentOrigin),
      });
      return {
        url: `${new URL(running.value.previewUrl).origin}/__kaizen-preview/${nonce}${page}`,
        nonce,
        files: inspection.files,
      };
    }
    running.selection = {
      nonce,
      path: page,
      script: sourceSelectionScript(inspection.fields, nonce, parentOrigin),
    };
    return {
      url: `${new URL(running.value.previewUrl).origin}/__kaizen-source/${nonce}/`,
      nonce,
      files: inspection.files,
    };
  }
  async cancel(id: string, projectId: string) {
    const running = this.require(id, projectId);
    if (running.value.status === "building") {
      running.cancel = "Build cancelled.";
      running.buildAbort?.abort(new Error(running.cancel));
      if (running.child) await stopChild(running.child);
      await running.done;
    }
    this.closePreview(running);
    return structuredClone(running.value);
  }
  private closePreview(running: Running) {
    clearTimeout(running.timer);
    running.server?.close();
    running.server?.closeAllConnections();
    running.server = undefined;
    delete running.files;
    delete running.selection;
    delete running.frames;
    delete running.value.previewUrl;
    delete running.value.previewExpiresAt;
  }
  private async execute(
    running: Running,
    command: Command,
    fingerprint: string,
    beforePreview?: (
      files: ReadonlyMap<string, Buffer>,
      fingerprint: string,
    ) => Promise<void>,
  ) {
    const job = running.value;
    let previous = false,
      prepared = false,
      recorded = false;
    let stopStorageWatch: (() => Promise<void>) | undefined;
    const log = (chunk: Buffer | string) => {
      job.log = (
        job.log + chunk.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
      ).slice(-100000);
    };
    try {
      await this.options.beforeBuild?.(structuredClone(job), fingerprint);
      recorded = true;
      stopStorageWatch = await this.options.watchStorage?.(async (error) => {
        running.cancel = error.message;
        running.buildAbort?.abort(error);
        if (running.child) await stopChild(running.child);
      });
      const output = await realDirectory(job.root, "dist");
      await realDirectory(job.root, ".kaizen/build-recovery");
      await mkdir(job.recoveryDirectory, { recursive: true });
      if (await exists(output)) {
        await rename(output, path.join(job.recoveryDirectory, "previous-dist"));
        previous = true;
      }
      prepared = true;
      if (running.cancel) throw new Error(running.cancel);
      let code: number | null;
      if (this.options.isolatedBuild) {
        const controller = new AbortController();
        running.buildAbort = controller;
        const timeout = setTimeout(() => {
          running.cancel = "Build exceeded the five-minute time limit.";
          controller.abort(new Error(running.cancel));
        }, this.timeoutMs);
        try {
          const files = await this.options.isolatedBuild.run({
            id: job.id,
            root: job.root,
            command,
            signal: controller.signal,
            log,
          });
          if (running.cancel) throw new Error(running.cancel);
          await mkdir(output);
          for (const [name, bytes] of files) {
            if (running.cancel) throw new Error(running.cancel);
            const relative = name.slice(1);
            const parent = path.posix.dirname(relative);
            if (parent !== ".")
              await mkdir(await realDirectory(job.root, `dist/${parent}`), {
                recursive: true,
              });
            await writeFile(path.join(output, relative), bytes, {
              flag: "wx",
              mode: 0o600,
            });
          }
          code = 0;
        } finally {
          clearTimeout(timeout);
          running.buildAbort = undefined;
        }
      } else if (this.options.controlledBuild) {
        const controller = new AbortController();
        running.buildAbort = controller;
        const timeout = setTimeout(() => {
          running.cancel = "Build exceeded the five-minute time limit.";
          controller.abort(new Error(running.cancel));
        }, this.timeoutMs);
        try {
          code = await this.options.controlledBuild({
            id: job.id,
            root: job.root,
            command,
            signal: controller.signal,
            log,
            environment: this.options.environment || process.env,
          });
        } finally {
          clearTimeout(timeout);
          running.buildAbort = undefined;
        }
      } else
        code = await new Promise<number | null>((resolve, reject) => {
          // No input is interpolated into a shell command. The reviewed package manager runs its normal lifecycle scripts.
          const child = spawn(process.execPath, [command.cli, "run", "build"], {
            cwd: job.root,
            windowsHide: true,
            detached: process.platform !== "win32",
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...(this.options.environment || process.env),
              FORCE_COLOR: "0",
              CI: "1",
            },
          });
          running.child = child;
          const timeout = setTimeout(() => {
            running.cancel = "Build exceeded the five-minute time limit.";
            void stopChild(child).catch((error) =>
              log(`\nUnable to stop build: ${error.message}`),
            );
          }, this.timeoutMs);
          child.stdout?.on("data", log);
          child.stderr?.on("data", log);
          child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once("close", (code) => {
            clearTimeout(timeout);
            resolve(code);
          });
        });
      running.child = undefined;
      const stopWatch = stopStorageWatch;
      stopStorageWatch = undefined;
      await stopWatch?.();
      if (running.cancel) throw new Error(running.cancel);
      if (code !== 0)
        throw new Error(
          `Build exited with code ${code ?? "unknown"}. Review the build log.`,
        );
      if ((await sourceFingerprint(job.root)) !== fingerprint)
        throw new Error(
          "Source files changed during the build. Review and build again before previewing.",
        );
      const builtOutput = await realDirectory(job.root, "dist");
      if (!(await exists(builtOutput)))
        throw new Error(
          "Build completed without dist/index.html. Only static sites using dist/ are supported.",
        );
      const files = await snapshot(builtOutput);
      await beforePreview?.(files, fingerprint);
      running.files = files;
      running.fingerprint = fingerprint;
      if (running.cancel || this.closed)
        throw new Error(running.cancel || "Companion stopped.");
      const token = randomBytes(32).toString("hex"),
        cookie = `kaizen_preview_${job.id.replace(/-/g, "")}`;
      let port = 0;
      const server = createServer((req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader(
          "Content-Security-Policy",
          "connect-src 'none'; form-action 'none'; frame-ancestors 'none'",
        );
        if (
          req.headers.host !== `127.0.0.1:${port}` ||
          !["GET", "HEAD"].includes(req.method || "")
        ) {
          res.writeHead(403);
          res.end();
          return;
        }
        const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
        const frameMatch = /^\/__kaizen-preview\/([a-f0-9]{64})(\/.*)$/.exec(
          url.pathname,
        );
        const frame = frameMatch && running.frames?.get(frameMatch[1]);
        if (frame && frameMatch) {
          const prefix = `/__kaizen-preview/${frameMatch[1]}`;
          res.setHeader(
            "Content-Security-Policy",
            `connect-src 'none'; form-action 'none'; frame-ancestors 'self' ${frame.origin}`,
          );
          let file: string;
          try {
            file = decodeURIComponent(frameMatch[2]);
          } catch {
            res.writeHead(400);
            res.end();
            return;
          }
          if (
            file.includes("\\") ||
            file.includes(":") ||
            file.split("/").includes("..")
          ) {
            res.writeHead(404);
            res.end();
            return;
          }
          if (file === "/__kaizen-canvas.js") {
            res.writeHead(200, {
              "Content-Type": "text/javascript; charset=utf-8",
            });
            res.end(req.method === "HEAD" ? undefined : frame.script);
            return;
          }
          if (file.endsWith("/")) file += "index.html";
          else if (!files.has(file) && files.has(`${file}/index.html`)) {
            res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
            res.end();
            return;
          }
          let bytes = files.get(file);
          if (!bytes) {
            res.writeHead(404);
            res.end("Static page not found.");
            return;
          }
          if (file.endsWith(".html")) {
            let html = frameHtml(bytes.toString("utf8"), prefix);
            if (file === `${frame.path}index.html`) {
              const script = `<script src="${prefix}/__kaizen-canvas.js" defer></script>`;
              html = /<\/body\s*>/i.test(html)
                ? html.replace(/<\/body\s*>/i, script + "</body>")
                : html + script;
            }
            bytes = Buffer.from(html);
          } else if (file.endsWith(".css"))
            bytes = Buffer.from(frameCss(bytes.toString("utf8"), prefix));
          res.writeHead(200, {
            "Content-Type":
              mime[path.extname(file)] || "application/octet-stream",
            "Content-Length": bytes.length,
          });
          res.end(req.method === "HEAD" ? undefined : bytes);
          return;
        }
        const selection = running.selection;
        const selecting =
          selection && url.pathname === `/__kaizen-source/${selection.nonce}/`;
        if (url.pathname === `/__kaizen-preview/${token}/` || selecting) {
          res.setHeader(
            "Set-Cookie",
            `${cookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(this.previewMs / 1000)}`,
          );
          res.writeHead(303, {
            Location: selecting
              ? `${selection.path}?__kaizen_select=${selection.nonce}`
              : "/",
          });
          res.end();
          return;
        }
        if (
          !req.headers.cookie
            ?.split(";")
            .some((value) => value.trim() === `${cookie}=${token}`)
        ) {
          res.writeHead(403);
          res.end("Open the preview from the builder.");
          return;
        }
        if (
          selection &&
          url.pathname === `/__kaizen-source-script/${selection.nonce}.js`
        ) {
          res.writeHead(200, {
            "Content-Type": "text/javascript; charset=utf-8",
          });
          res.end(req.method === "HEAD" ? undefined : selection.script);
          return;
        }
        let file: string;
        try {
          file = decodeURIComponent(url.pathname);
        } catch {
          res.writeHead(400);
          res.end();
          return;
        }
        if (file.includes("\\") || file.includes(":")) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (file.endsWith("/")) file += "index.html";
        else if (!files.has(file) && files.has(`${file}/index.html`)) {
          res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
          res.end();
          return;
        }
        let bytes = files.get(file);
        if (!bytes) {
          res.writeHead(404);
          res.end("Static page not found.");
          return;
        }
        if (
          selection &&
          file === `${selection.path}index.html` &&
          url.searchParams.get("__kaizen_select") === selection.nonce
        ) {
          const script = `<script src="/__kaizen-source-script/${selection.nonce}.js" defer></script>`;
          const html = bytes.toString("utf8");
          bytes = Buffer.from(
            /<\/body\s*>/i.test(html)
              ? html.replace(/<\/body\s*>/i, script + "</body>")
              : html + script,
          );
        }
        res.writeHead(200, {
          "Content-Type":
            mime[path.extname(file)] || "application/octet-stream",
          "Content-Length": bytes.length,
        });
        res.end(req.method === "HEAD" ? undefined : bytes);
      });
      running.server = server;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          if (!address || typeof address === "string")
            return reject(new Error("Preview address unavailable."));
          port = address.port;
          resolve();
        });
      });
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { Cookie: `${cookie}=${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (
        !response.ok ||
        digest(Buffer.from(await response.arrayBuffer())) !==
          digest(files.get("/index.html")!)
      )
        throw new Error("The served preview did not match the built output.");
      if (running.cancel || this.closed)
        throw new Error(running.cancel || "Companion stopped.");
      job.previewUrl = `http://127.0.0.1:${port}/__kaizen-preview/${token}/`;
      // Retain earlier previews until the replacement's served bytes are verified.
      const previews = [...this.jobs.values()].filter(
        (value) => value !== running && value.server,
      );
      while (previews.length >= 2) this.closePreview(previews.shift()!);
      job.previewExpiresAt = Date.now() + this.previewMs;
      running.timer = setTimeout(
        () => this.closePreview(running),
        this.previewMs,
      );
      running.timer.unref();
      job.status = "succeeded";
      log(
        "\nStatic preview verified against built index.html. Forms and network API calls are disabled in this local preview.\n",
      );
    } catch (error) {
      this.closePreview(running);
      const cleanupUncertain = error instanceof SandboxCleanupError;
      if (cleanupUncertain) job.recoveryRequired = true;
      const terminalStatus = running.cancel ? "cancelled" : "failed";
      job.error = error.message;
      log(
        cleanupUncertain
          ? "\nPreserving build output until process cleanup is confirmed…\n"
          : "\nRecovering build output before finishing this job…\n",
      );
      if (cleanupUncertain)
        job.error += ` Output is preserved in the website folder and ${job.recoveryDirectory} until all build processes have stopped.`;
      if (prepared && !cleanupUncertain)
        try {
          const output = await realDirectory(job.root, "dist");
          if (await exists(output))
            await rename(
              output,
              path.join(job.recoveryDirectory, "failed-dist"),
            );
          if (previous)
            await rename(
              path.join(job.recoveryDirectory, "previous-dist"),
              output,
            );
        } catch (recovery) {
          job.recoveryRequired = true;
          job.error += ` Recovery requires attention: ${recovery.message}. Original output is retained in ${job.recoveryDirectory}.`;
        }
      // A terminal status promises that restoration has finished (or its
      // recovery error has been recorded). Polling/close must still await us.
      job.status = terminalStatus;
    } finally {
      // Finish a check already in flight before releasing the build's lock.
      await stopStorageWatch?.().catch(() => {});
      job.finishedAt = new Date().toISOString();
      if (recorded)
        try {
          await this.options.afterBuild?.(structuredClone(job));
        } catch {
          this.closePreview(running);
          job.status = "failed";
          job.recoveryRequired = true;
          job.error =
            "The build record could not be completed. Ask the operator to check the preserved website and recovery files.";
        }
    }
  }
  async close() {
    this.closed = true;
    await Promise.allSettled(
      [...this.jobs.values()].map(async (running) => {
        this.closePreview(running);
        if (running.value.status === "building") {
          running.cancel = "Companion stopped.";
          running.buildAbort?.abort(new Error(running.cancel));
          if (running.child) await stopChild(running.child);
          await running.done;
        }
      }),
    );
  }
}
