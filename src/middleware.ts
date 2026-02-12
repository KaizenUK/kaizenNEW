import { defineMiddleware } from "astro:middleware";
import { getAllRedirects, type SanityRedirect } from "./lib/sanity/client";

const STAGE_HOST = "stage.kaizenweb.co.uk";
const ALLOWED_STAGE_IPS = new Set(["78.148.109.55"]);

// Cache redirects so we don't query Sanity on every request.
let redirectCache: SanityRedirect[] | null = null;
let redirectCacheTime = 0;
const REDIRECT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getRedirects(): Promise<SanityRedirect[]> {
  const now = Date.now();
  if (redirectCache && now - redirectCacheTime < REDIRECT_CACHE_TTL_MS) {
    return redirectCache;
  }
  try {
    redirectCache = await getAllRedirects();
    redirectCacheTime = now;
  } catch {
    // If Sanity is unreachable keep stale cache or empty
    if (!redirectCache) redirectCache = [];
  }
  return redirectCache;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0];
    if (first) return first.trim();
  }

  return "";
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Skip during prerender
  if (context.isPrerendered) {
    return next();
  }

  // ── Stage IP gate ────────────────────────────────────────────────
  const host = context.url.hostname.toLowerCase();
  if (host === STAGE_HOST) {
    const clientIp = getClientIp(context.request);
    if (!ALLOWED_STAGE_IPS.has(clientIp)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // ── Sanity-managed redirects ─────────────────────────────────────
  const pathname = context.url.pathname;
  const redirects = await getRedirects();
  const match = redirects.find((r) => r.source === pathname);
  if (match) {
    const status = match.isPermanent ? 301 : 302;
    return context.redirect(match.destination, status);
  }

  return next();
});
