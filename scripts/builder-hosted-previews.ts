import { randomBytes } from "node:crypto";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  HostedHelperError,
  type HostedRepositoryAccess,
  type RepositoryActor,
  accountId,
} from "./builder-hosted-auth";
import type { HostedBuildQueue } from "./builder-hosted-builds";
import type { SourceInspection } from "../shared/builderSourceEditing";
import {
  sourceEditingScript,
  sourceSelectionScript,
  sourcePreviewPath,
} from "./builder-source-preview";
import {
  hostedPreviewHtml,
  hostedPreviewCss,
  hostedPreviewJs,
  previewMime,
  previewEnvelope,
  previewBootstrapScript,
  previewNavigationScript,
} from "./builder-hosted-preview-content";

export const hostedPreviewCookie = "__Host-kaizen_builder_preview";
export const hostedFrameCookie = "__Secure-kaizen_preview_frame";
const secret = () => randomBytes(32).toString("hex");
const duration = 15 * 60_000;
type Session = { actor: RepositoryActor; token: string; expiresAt: number };
type View = {
  projectId: string;
  actorId: string;
  jobId: string;
  nonce: string;
  prefix: string;
  expiresAt: number;
  route: string;
  script?: string;
  parent?: string;
  inspection?: SourceInspection;
  selection?: boolean;
};
type Grant = { sessionId: string; view: View; expiresAt: number };
const cookies = (header: string | undefined, name: string) => {
  const values = (header || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="));
  if (values.length !== 1) return undefined;
  const value = values[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
};
const unavailable = () =>
  new HostedHelperError(
    401,
    "This private preview expired. Reconnect the helper from the builder and open it again.",
  );

/** Cookies authorize bytes; public view IDs alone grant nothing. No cookie contains an access token. */
export class HostedPreviews {
  readonly origin: string;
  private sessions = new Map<string, Session>();
  private views = new Map<string, View>();
  private bootstraps = new Map<string, Grant>();
  private frames = new Map<string, Grant>();
  constructor(
    origin: string,
    private access: HostedRepositoryAccess,
    private builds: HostedBuildQueue,
  ) {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin)
      throw new Error("Configure one HTTPS editor origin for hosted previews.");
    this.origin = origin;
  }
  private prune() {
    for (const map of [
      this.sessions,
      this.views,
      this.bootstraps,
      this.frames,
    ] as Map<string, { expiresAt: number }>[])
      for (const [id, value] of map)
        if (value.expiresAt <= Date.now()) map.delete(id);
  }
  issue(header: string | undefined, actor: RepositoryActor, token: string) {
    this.prune();
    let id = cookies(header, hostedPreviewCookie);
    if (id && this.sessions.get(id)?.actor.id !== actor.id) {
      this.sessions.delete(id);
      id = undefined;
    }
    if (!id || !this.sessions.has(id)) {
      if (this.sessions.size >= 512)
        throw new HostedHelperError(
          429,
          "Too many preview sessions are open. Close an old session and reconnect.",
        );
      id = secret();
    }
    const expiresAt = Math.min(actor.expiresAt, Date.now() + duration);
    this.sessions.set(id, { actor, token, expiresAt });
    return `${hostedPreviewCookie}=${id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`;
  }
  revoke(header: string | undefined, actorId: unknown) {
    if (!accountId(actorId))
      throw new HostedHelperError(
        400,
        "Choose the preview account to disconnect.",
      );
    const id = cookies(header, hostedPreviewCookie);
    if (id && this.sessions.get(id)?.actor.id !== actorId) return undefined;
    if (id) this.sessions.delete(id);
    return `${hostedPreviewCookie}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  private own(view: View) {
    return this.builds.previewJob(view.projectId, view.actorId, view.jobId);
  }
  async view(
    projectId: string,
    actorId: string,
    jobId: string,
    inspection?: SourceInspection,
    selection = false,
  ) {
    this.prune();
    const { runner, job } = this.builds.previewJob(projectId, actorId, jobId);
    if (!inspection) {
      const existing = [...this.views.values()].find(
        (view) =>
          view.projectId === projectId &&
          view.actorId === actorId &&
          view.jobId === jobId &&
          !view.script &&
          !view.parent,
      );
      if (existing)
        return {
          url: this.origin + existing.prefix + "/",
          expiresAt: existing.expiresAt,
        };
    }
    // Reuse the runner's source fingerprint, route and built-file checks before exposing editing controls.
    if (inspection)
      await runner.sourcePreview(
        job.id,
        projectId,
        inspection,
        this.origin,
        true,
        true,
      );
    const related = [...this.views.values()].filter(
      (view) =>
        view.projectId === projectId && view.jobId === jobId && !view.parent,
    );
    while (related.length >= 8) this.views.delete(related.shift()!.nonce);
    if (this.views.size >= 1024)
      throw new HostedHelperError(
        429,
        "Too many previews are open. Close old previews and try again.",
      );
    const nonce = secret(),
      prefix = `/editor-preview/${projectId}/${jobId}/${nonce}`;
    const route = inspection ? sourcePreviewPath(inspection.route) : "/";
    const script = inspection
      ? selection
        ? sourceSelectionScript(inspection.fields, nonce, this.origin, prefix)
        : sourceEditingScript(inspection, nonce, this.origin, prefix)
      : undefined;
    const view: View = {
      projectId,
      actorId,
      jobId,
      nonce,
      prefix,
      route,
      script,
      inspection,
      selection,
      expiresAt: job.previewExpiresAt!,
    };
    this.views.set(nonce, view);
    return {
      url: this.origin + prefix + route,
      nonce,
      files: inspection?.files,
      expiresAt: view.expiresAt,
    };
  }
  private async authorize(sessionId: string | undefined, view: View) {
    const session = sessionId && this.sessions.get(sessionId);
    if (
      !session ||
      session.expiresAt <= Date.now() ||
      session.actor.id !== view.actorId
    )
      throw unavailable();
    const actor = await this.access.verify(session.token);
    await this.access.requireProject(session.token, actor, view.projectId);
    if (!this.sessions.has(sessionId!) || session.expiresAt <= Date.now())
      throw unavailable();
    return session;
  }
  private contentView(view: View) {
    if (view.parent) return view;
    const prior = [...this.views.values()].filter(
      (value) => value.parent === view.nonce,
    );
    while (prior.length >= 8) this.views.delete(prior.shift()!.nonce);
    if (this.views.size >= 1024)
      throw new HostedHelperError(
        429,
        "Too many previews are open. Close old pages and reconnect.",
      );
    const nonce = secret(),
      prefix = `/editor-preview/${view.projectId}/${view.jobId}/${nonce}`;
    const script = view.inspection
      ? view.selection
        ? sourceSelectionScript(
            view.inspection.fields,
            view.nonce,
            this.origin,
            prefix,
          )
        : sourceEditingScript(view.inspection, view.nonce, this.origin, prefix)
      : previewNavigationScript(view.nonce, this.origin, prefix);
    const content = { ...view, nonce, prefix, parent: view.nonce, script };
    this.views.set(nonce, content);
    return content;
  }
  private headers(response: ServerResponse, view: View) {
    const prefix = this.origin + view.prefix + "/";
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Vary", "Cookie, Origin");
    response.setHeader(
      "Content-Security-Policy",
      `sandbox allow-scripts; default-src 'none'; script-src ${prefix} 'unsafe-inline'; style-src https: 'unsafe-inline'; img-src https: data: blob:; font-src https: data:; media-src ${prefix} data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri ${prefix}; frame-ancestors ${this.origin}`,
    );
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
  }
  async serve(request: IncomingMessage, response: ServerResponse) {
    this.prune();
    if (!["GET", "HEAD"].includes(request.method || ""))
      throw new HostedHelperError(405, "Private previews are read-only.");
    const raw = request.url || "";
    if (
      raw.length > 4096 ||
      /[\\\u0000-\u0020]/.test(raw) ||
      /%(?:2f|5c|2e|00|25)/i.test(raw) ||
      raw.split(/[/?#]/).some((part) => part === "." || part === "..")
    )
      throw new HostedHelperError(400, "Invalid preview path.");
    const url = new URL(raw, this.origin);
    const parts = url.pathname.split("/");
    let view = this.views.get(parts[4]);
    if (
      !view ||
      (view.parent && !this.views.has(view.parent)) ||
      view.projectId !== parts[2] ||
      view.jobId !== parts[3] ||
      !url.pathname.startsWith(view.prefix + "/")
    )
      throw new HostedHelperError(
        404,
        "This preview is unavailable. Open it again from the builder.",
      );
    this.headers(response, view);
    const requestOrigin = request.headers.origin;
    if (
      requestOrigin &&
      requestOrigin !== "null" &&
      requestOrigin !== this.origin
    )
      throw new HostedHelperError(
        403,
        "Open this private preview from its editor.",
      );
    let relative: string;
    try {
      relative = decodeURIComponent(url.pathname.slice(view.prefix.length));
    } catch {
      throw new HostedHelperError(400, "Invalid preview path.");
    }
    if (
      relative
        .split("/")
        .some((part) => part === ".." || part === "." || part.includes(":"))
    )
      throw new HostedHelperError(400, "Invalid preview path.");
    const boot = /^\/__kaizen-session\/([a-f0-9]{64})\.js$/.exec(relative);
    if (boot) {
      const grant = this.bootstraps.get(boot[1]);
      this.bootstraps.delete(boot[1]);
      if (
        request.method !== "GET" ||
        requestOrigin !== "null" ||
        !grant ||
        grant.view !== view
      )
        throw unavailable();
      const session = await this.authorize(grant.sessionId, view);
      if (grant.expiresAt <= Date.now()) throw unavailable();
      this.own(view);
      if (this.frames.size >= 2048)
        throw new HostedHelperError(
          429,
          "Too many preview windows are open. Reconnect the helper.",
        );
      const id = secret(),
        expiresAt = Math.min(session.expiresAt, view.expiresAt);
      this.frames.set(id, { sessionId: grant.sessionId, view, expiresAt });
      response.setHeader(
        "Set-Cookie",
        `${hostedFrameCookie}=${id}; Path=${view.prefix}/; Secure; HttpOnly; SameSite=None; Partitioned; Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`,
      );
      response.setHeader("Access-Control-Allow-Origin", "null");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(previewBootstrapScript);
      return;
    }
    const frame = cookies(request.headers.cookie, hostedFrameCookie);
    const grant = frame && this.frames.get(frame);
    let sessionId = grant && grant.view === view ? grant.sessionId : undefined;
    let file = relative.endsWith("/") ? relative + "index.html" : relative;
    const isHtml = file.endsWith(".html") || !path.posix.extname(file);
    // The editor cookie may open a document; it never bypasses the frame cookie for assets or null-origin CORS reads.
    if (!sessionId && !view.parent && isHtml && requestOrigin !== "null")
      sessionId = cookies(request.headers.cookie, hostedPreviewCookie);
    const session = await this.authorize(sessionId, view);
    const { runner, job } = this.own(view),
      files = runner.previewFiles(job.id, view.projectId);
    if (!files.has(file) && files.has(file + "/index.html")) {
      response
        .writeHead(308, { Location: url.pathname + "/" + url.search })
        .end();
      return;
    }
    let bytes =
      file === "/__kaizen-canvas.js" && view.script
        ? Buffer.from(view.script)
        : files.get(file);
    if (!bytes)
      throw new HostedHelperError(
        404,
        "This file is absent from the built preview.",
      );
    const extension = path.posix.extname(file).toLowerCase();
    if (extension === ".html") {
      // The public document URL never reveals the private asset namespace / CSRF token.
      view = this.contentView(view);
      this.headers(response, view);
      const html = hostedPreviewHtml(
        bytes.toString("utf8"),
        view.prefix,
        file,
        files,
        !view.inspection || file === view.route + "index.html"
          ? view.script
          : undefined,
        this.origin +
          view.prefix +
          path.posix.dirname(file).replace(/\/$/, "") +
          "/",
      );
      if (request.method !== "HEAD") {
        if (this.bootstraps.size >= 2048)
          throw new HostedHelperError(
            429,
            "Too many preview pages are opening. Try again shortly.",
          );
        const id = secret();
        this.bootstraps.set(id, {
          sessionId: sessionId!,
          view,
          expiresAt: Math.min(session.expiresAt, Date.now() + 30_000),
        });
        bytes = Buffer.from(
          previewEnvelope(
            html,
            view.prefix + "/__kaizen-session/" + id + ".js",
          ),
        );
      }
    } else if (extension === ".css")
      bytes = Buffer.from(
        hostedPreviewCss(bytes.toString("utf8"), view.prefix, file, files),
      );
    else if (
      [".js", ".mjs"].includes(extension) &&
      file !== "/__kaizen-canvas.js"
    )
      bytes = Buffer.from(hostedPreviewJs(bytes.toString("utf8"), view.prefix));
    // CORS is only for the authenticated opaque frame; the editor-cookie document response has no null-origin CORS grant.
    if (grant && grant.view === view && requestOrigin === "null") {
      response.setHeader("Access-Control-Allow-Origin", "null");
      response.setHeader("Access-Control-Allow-Credentials", "true");
    }
    response.setHeader(
      "Content-Type",
      previewMime[extension] || "application/octet-stream",
    );
    response.end(request.method === "HEAD" ? undefined : bytes);
  }
  close() {
    this.sessions.clear();
    this.views.clear();
    this.bootstraps.clear();
    this.frames.clear();
  }
}
