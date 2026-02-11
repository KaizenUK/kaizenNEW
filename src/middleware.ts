import { defineMiddleware } from "astro:middleware";

const STAGE_HOST = "stage.kaizenweb.co.uk";
const ALLOWED_STAGE_IPS = new Set(["78.148.109.55"]);

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
  // Skip stage-IP checks during prerender so static build does not
  // rely on request headers and emit warnings.
  if (context.isPrerendered) {
    return next();
  }

  const host = context.url.hostname.toLowerCase();

  if (host === STAGE_HOST) {
    const clientIp = getClientIp(context.request);
    if (!ALLOWED_STAGE_IPS.has(clientIp)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  return next();
});
