import type { APIRoute } from "astro";

const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const COOKIE_MAX_AGE_SECONDS = 900;
const REDIRECT_PARAM_CANDIDATES = [
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

function normalizeRedirectPath(rawValue: string | null, requestUrl: URL): string {
  const value = String(rawValue ?? "").trim();
  if (!value) return "/";

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.host.toLowerCase() !== requestUrl.host.toLowerCase()) {
        return "/";
      }

      return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
    } catch {
      return "/";
    }
  }

  if (value.startsWith("//")) return "/";
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\/+/, "")}`;
}

function getRedirectTarget(requestUrl: URL): string {
  for (const key of REDIRECT_PARAM_CANDIDATES) {
    const match = requestUrl.searchParams.get(key);
    if (match) return normalizeRedirectPath(match, requestUrl);
  }

  return "/blog";
}

function getCookieHeader({
  requestUrl,
  enabled,
}: {
  requestUrl: URL;
  enabled: boolean;
}): string {
  const isHttps = requestUrl.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";

  // Presentation mode uses an iframe. For cookies to work reliably in that context,
  // we need SameSite=None (which requires Secure). Fall back to Lax on non-HTTPS.
  const sameSite = isHttps ? "None" : "Lax";

  // This cookie is used as a short-lived server-side flag, so HttpOnly is appropriate.
  const httpOnly = "; HttpOnly";

  if (enabled) {
    return `${STUDIO_EDITOR_COOKIE}=1; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=${sameSite}${secure}${httpOnly}`;
  }

  return `${STUDIO_EDITOR_COOKIE}=; Path=/; Max-Age=0; SameSite=${sameSite}${secure}${httpOnly}`;
}

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const disablePreview = requestUrl.searchParams.get("disable") === "1";
  const requestedRedirect = getRedirectTarget(requestUrl);
  const redirectTo =
    requestedRedirect === "/api/draft" || requestedRedirect === "/api/draft/"
      ? "/blog"
      : requestedRedirect;

  return new Response(null, {
    status: 307,
    headers: {
      location: redirectTo,
      "set-cookie": getCookieHeader({
        requestUrl,
        enabled: !disablePreview,
      }),
      "cache-control": "no-store",
    },
  });
};
