import { validProjectId } from "./builderProjects.ts";

export const diagnosticSummaries = {
  network: "A connection to a service failed.",
  session: "Sign-in or session access needs attention.",
  access: "An action was refused by an access check.",
  conflict: "Saved changes conflicted with another version.",
  build: "The website build or preview failed.",
  unknown: "An unexpected error occurred.",
} as const;
export type DiagnosticCategory = keyof typeof diagnosticSummaries;
export type DiagnosticSource = "browser" | "workspace" | "helper";
export type DiagnosticError = {
  category: DiagnosticCategory;
  source: DiagnosticSource;
  summary: string;
  at: string;
};
const sources = new Set(["browser", "workspace", "helper"]);
const screens = new Set([
  "projects",
  "pages",
  "site",
  "assets",
  "repository",
  "settings",
  "releases",
  "redirects",
  "previews",
  "backups",
  "existing",
  "page-editor",
  "website-editor",
]);

/** Error text can contain URLs, pasted content or credentials. Retain only a fixed classification. */
export function classifyDiagnosticError(
  error: unknown,
  source: DiagnosticSource = "browser",
  now = new Date(),
): DiagnosticError {
  let message = "";
  try {
    message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
  } catch {
    /* Unknown errors still get a safe record. */
  }
  const category: DiagnosticCategory =
    /session|sign.?in|password|authentication/i.test(message)
      ? "session"
      : /forbidden|permission|access denied|not approved|unauthori[sz]ed/i.test(
            message,
          )
        ? "access"
        : /conflict|changed.*(window|operation|review)|stale|another version/i.test(
              message,
            )
          ? "conflict"
          : /build|preview/i.test(message)
            ? "build"
            : /network|fetch|connection|offline|timeout|timed out/i.test(
                  message,
                )
              ? "network"
              : "unknown";
  return {
    category,
    source: sources.has(source) ? source : "browser",
    summary: diagnosticSummaries[category],
    at: now.toISOString(),
  };
}

export function safeDiagnosticError(value: unknown): DiagnosticError | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const category =
    typeof input.category === "string" &&
    Object.prototype.hasOwnProperty.call(diagnosticSummaries, input.category)
      ? (input.category as DiagnosticCategory)
      : "unknown";
  const at = typeof input.at === "string" ? Date.parse(input.at) : NaN;
  if (!Number.isFinite(at)) return null;
  return {
    category,
    source:
      typeof input.source === "string" && sources.has(input.source)
        ? (input.source as DiagnosticSource)
        : "browser",
    summary: diagnosticSummaries[category],
    at: new Date(at).toISOString(),
  };
}

export async function buildProblemReport(
  input: {
    projectId?: unknown;
    page?: { screen?: unknown; id?: unknown; route?: unknown };
    userAgent?: unknown;
    helper?: { local?: unknown; status?: unknown };
    lastError?: unknown;
  },
  now = new Date(),
) {
  const userAgent = typeof input.userAgent === "string" ? input.userAgent : "";
  const family = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Other";
  const versionPattern =
    family === "Edge"
      ? /Edg\/(\d+)/
      : family === "Firefox"
        ? /Firefox\/(\d+)/
        : family === "Chrome"
          ? /Chrome\/(\d+)/
          : /Version\/(\d+)/;
  const browser = family === "Other" ? null : versionPattern.exec(userAgent);
  const platform = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Other";
  const id =
    typeof input.page?.id === "string" && validProjectId(input.page.id)
      ? input.page.id
      : null;
  // Existing source pages have no database ID. A one-way reference identifies the route
  // without copying source filenames, URL tokens or user-authored text into a report.
  const route =
    typeof input.page?.route === "string"
      ? input.page.route.slice(0, 2000).split(/[?#]/)[0]
      : "";
  const routeHash =
    !id && route
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(route),
            ),
          ),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("")
      : null;
  return {
    schemaVersion: 1,
    createdAt: now.toISOString(),
    projectId:
      typeof input.projectId === "string" && validProjectId(input.projectId)
        ? input.projectId
        : null,
    page: {
      screen:
        typeof input.page?.screen === "string" && screens.has(input.page.screen)
          ? (input.page!.screen as string)
          : "unknown",
      id,
      routeHash,
    },
    browser: {
      family,
      majorVersion: browser ? Number(browser[1].slice(0, 4)) : null,
      platform,
    },
    helper: {
      mode: input.helper?.local === true ? "local" : "hosted",
      status:
        input.helper?.local === true
          ? "not-checked"
          : typeof input.helper?.status === "string" &&
              ["connected", "connecting", "disconnected"].includes(
                input.helper.status,
              )
            ? (input.helper!.status as string)
            : "disconnected",
    },
    lastError: safeDiagnosticError(input.lastError),
  };
}
