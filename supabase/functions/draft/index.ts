import {
  buildEditorCookie,
  getCorsHeaders,
  getEditorApiOrigin,
  getPublicSiteOrigin,
  hasEditorCookie,
  isAllowedPreviewPath,
  isOriginAllowed,
  resolveDraftRedirectPath,
} from "../_shared/editorAuth.ts";

function json(
  status: number,
  payload: Record<string, unknown>,
  corsHeaders: Headers,
): Response {
  const headers = new Headers(corsHeaders);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers });
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isOriginAllowed(request)) {
    return json(403, { ok: false, error: "Forbidden origin" }, corsHeaders);
  }

  if (request.method !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  const disablePreview = requestUrl.searchParams.get("disable") === "1";
  const hasSession = hasEditorCookie(request);

  // Enabling preview requires an existing Studio-authenticated session.
  if (!disablePreview && !hasSession) {
    return json(
      401,
      { ok: false, error: "Studio authentication required" },
      corsHeaders,
    );
  }

  const requestedPath = resolveDraftRedirectPath(requestUrl);
  const safePath = isAllowedPreviewPath(requestedPath) ? requestedPath : "/blog";

  const publicOrigin = getPublicSiteOrigin();
  const editorApiOrigin = getEditorApiOrigin(requestUrl);
  const redirectTo = safePath.startsWith("/preview-blog/")
    ? `${editorApiOrigin}${safePath}`
    : `${publicOrigin}${safePath}`;

  const headers = new Headers(corsHeaders);
  headers.set("location", redirectTo);
  headers.set(
    "set-cookie",
    buildEditorCookie({
      enabled: !disablePreview,
      requestUrl,
      forwardedProto: request.headers.get("x-forwarded-proto"),
    }),
  );

  return new Response(null, {
    status: 307,
    headers,
  });
});
