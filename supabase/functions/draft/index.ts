import {
  buildEditorCookie,
  getCorsHeaders,
  getEditorApiOrigin,
  getPublicSiteOrigin,
  isAllowedPreviewPath,
  isOriginAllowed,
  resolveDraftRedirectPath,
} from "../_shared/editorAuth.ts";

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isOriginAllowed(request)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Forbidden origin" }),
      {
        status: 403,
        headers: new Headers({
          ...Object.fromEntries(corsHeaders.entries()),
          "content-type": "application/json",
        }),
      },
    );
  }

  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: new Headers({
          ...Object.fromEntries(corsHeaders.entries()),
          "content-type": "application/json",
        }),
      },
    );
  }

  const disablePreview = requestUrl.searchParams.get("disable") === "1";
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
