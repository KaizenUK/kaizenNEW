export const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
export const COOKIE_MAX_AGE_SECONDS = 900;

type CookieOptions = {
  enabled: boolean;
  requestUrl: URL;
  forwardedProto?: string | null;
};

function getEnv(key: string): string {
  return String(Deno.env.get(key) ?? "").trim();
}

function normalizeOrigin(value: string): string {
  return String(value).replace(/\/+$/, "").trim().toLowerCase();
}

function parseOrigin(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpsRequest(requestUrl: URL, forwardedProto?: string | null): boolean {
  if (requestUrl.protocol === "https:") return true;
  const proto = String(forwardedProto ?? "").trim().toLowerCase();
  if (!proto) return false;
  return proto.split(",").some((entry) => entry.trim() === "https");
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const entries = String(header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const values: Record<string, string> = {};
  for (const entry of entries) {
    const [key, ...rest] = entry.split("=");
    if (!key) continue;
    values[key] = rest.join("=");
  }
  return values;
}

function getAllowedOrigins(): string[] {
  const fromEnv = getEnv("ALLOWED_STUDIO_ORIGINS")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);

  const studioOrigin = normalizeOrigin(getEnv("VITE_STUDIO_ORIGIN") || getEnv("STUDIO_ORIGIN"));
  if (studioOrigin) fromEnv.push(studioOrigin);

  const publicSiteOrigin = normalizeOrigin(
    getEnv("VITE_PUBLIC_SITE_ORIGIN") || getEnv("PUBLIC_SITE_ORIGIN"),
  );
  if (publicSiteOrigin) fromEnv.push(publicSiteOrigin);

  return Array.from(new Set(fromEnv));
}

export function getEditorApiOrigin(requestUrl: URL): string {
  const configured = getEnv("VITE_EDITOR_API_ORIGIN") || getEnv("EDITOR_API_ORIGIN");
  if (configured) return configured.replace(/\/+$/, "");
  return requestUrl.origin;
}

export function getPublicSiteOrigin(): string {
  return (
    getEnv("VITE_PUBLIC_SITE_ORIGIN") ||
    getEnv("PUBLIC_SITE_ORIGIN") ||
    "https://kaizenweb.co.uk"
  ).replace(/\/+$/, "");
}

export function getStudioOrigin(): string {
  return (
    getEnv("VITE_STUDIO_ORIGIN") ||
    getEnv("STUDIO_ORIGIN") ||
    "https://studio.kaizenweb.co.uk"
  ).replace(/\/+$/, "");
}

export function getCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const requestOrigin = normalizeOrigin(request.headers.get("origin") ?? "");
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] ?? "";

  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }

  headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-forwarded-proto",
  );
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function isOriginAllowed(request: Request): boolean {
  const requestOrigin = normalizeOrigin(request.headers.get("origin") ?? "");
  if (!requestOrigin) return true;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(requestOrigin);
}

export function hasEditorCookie(request: Request): boolean {
  const cookie = parseCookieHeader(request.headers.get("cookie"));
  return cookie[STUDIO_EDITOR_COOKIE] === "1";
}

export function buildEditorCookie(options: CookieOptions): string {
  const { enabled, requestUrl, forwardedProto } = options;
  const secure = isHttpsRequest(requestUrl, forwardedProto) ? "; Secure" : "";
  const domain =
    getEnv("VITE_EDITOR_COOKIE_DOMAIN") || getEnv("EDITOR_COOKIE_DOMAIN");
  const domainSuffix = domain ? `; Domain=${domain}` : "";
  const base = `${STUDIO_EDITOR_COOKIE}=${enabled ? "1" : ""}; Path=/; SameSite=Lax${secure}${domainSuffix}; HttpOnly`;

  if (enabled) {
    return `${base}; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
  }

  return `${base}; Max-Age=0`;
}

export function normalizeRedirectPath(rawValue: string | null, requestUrl: URL): string {
  const value = String(rawValue ?? "").trim();
  if (!value) return "/blog";

  if (/^https?:\/\//i.test(value)) {
    const parsed = parseOrigin(value);
    if (!parsed || parsed.host.toLowerCase() !== requestUrl.host.toLowerCase()) {
      return "/blog";
    }
    return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
  }

  if (value.startsWith("//")) return "/blog";
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\/+/, "")}`;
}

export function resolveDraftRedirectPath(requestUrl: URL): string {
  const keyCandidates = [
    "sanity-preview-pathname",
    "sanity-preview-path",
    "pathname",
    "path",
    "returnTo",
    "returnPath",
    "route",
    "href",
    "slug",
    "redirectTo",
    "redirect",
    "url",
  ] as const;

  for (const key of keyCandidates) {
    const rawValue = requestUrl.searchParams.get(key);
    if (rawValue) return normalizeRedirectPath(rawValue, requestUrl);
  }

  return "/blog";
}

export function isAllowedPreviewPath(path: string): boolean {
  const pathname = String(path).split(/[?#]/, 1)[0] || "/";
  return (
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/preview-blog/")
  );
}
