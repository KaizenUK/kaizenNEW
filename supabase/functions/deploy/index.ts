import {
  getCorsHeaders,
  hasEditorCookie,
  isOriginAllowed,
} from "../_shared/editorAuth.ts";

const VALID_DEPLOY_TARGETS = new Set([
  "main",
  "prod",
  "production",
  "stage",
  "staging",
]);

function parseRepository(repository: string): { owner: string; repo: string } | null {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

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
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isOriginAllowed(request)) {
    return json(403, { ok: false, error: "Forbidden origin" }, corsHeaders);
  }

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  if (!hasEditorCookie(request)) {
    return json(
      401,
      { ok: false, error: "Studio authentication required" },
      corsHeaders,
    );
  }

  const githubToken = Deno.env.get("GITHUB_DEPLOY_TOKEN");
  const repository =
    Deno.env.get("GITHUB_DEPLOY_REPO") ?? Deno.env.get("GITHUB_REPOSITORY");
  const eventType = Deno.env.get("GITHUB_DEPLOY_EVENT_TYPE") ?? "sanity-update";
  const defaultTarget = String(Deno.env.get("GITHUB_DEPLOY_TARGET") ?? "")
    .trim()
    .toLowerCase();

  if (!githubToken) {
    return json(
      500,
      { ok: false, error: "Missing env var: GITHUB_DEPLOY_TOKEN" },
      corsHeaders,
    );
  }

  if (!repository) {
    return json(
      500,
      { ok: false, error: "Missing env var: GITHUB_DEPLOY_REPO" },
      corsHeaders,
    );
  }

  const parsedRepository = parseRepository(repository);
  if (!parsedRepository) {
    return json(
      500,
      { ok: false, error: "Invalid GITHUB_DEPLOY_REPO format. Use owner/repo." },
      corsHeaders,
    );
  }

  let requestPayload: Record<string, unknown> = {};
  try {
    requestPayload = (await request.json()) as Record<string, unknown>;
  } catch {
    requestPayload = {};
  }

  const requestedTargetRaw =
    typeof requestPayload.target === "string"
      ? requestPayload.target.trim().toLowerCase()
      : "";
  const target = VALID_DEPLOY_TARGETS.has(requestedTargetRaw)
    ? requestedTargetRaw
    : VALID_DEPLOY_TARGETS.has(defaultTarget)
      ? defaultTarget
      : "main";

  const dispatchResponse = await fetch(
    `https://api.github.com/repos/${parsedRepository.owner}/${parsedRepository.repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "kaizen-studio-deploy",
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          source: "studio",
          documentId:
            typeof requestPayload.documentId === "string"
              ? requestPayload.documentId
              : undefined,
          schemaType:
            typeof requestPayload.schemaType === "string"
              ? requestPayload.schemaType
              : undefined,
          target,
          requestedAt: new Date().toISOString(),
        },
      }),
    },
  );

  if (!dispatchResponse.ok) {
    const details = await dispatchResponse.text();
    return json(
      502,
      {
        ok: false,
        error: "GitHub dispatch request failed",
        status: dispatchResponse.status,
        details,
      },
      corsHeaders,
    );
  }

  return json(
    200,
    {
      ok: true,
      eventType,
      repository,
      target,
    },
    corsHeaders,
  );
});
