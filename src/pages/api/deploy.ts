import type { APIRoute } from "astro";

const JSON_HEADERS = {
  "content-type": "application/json",
} as const;
const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const VALID_DEPLOY_TARGETS = new Set(["main", "prod", "production", "stage", "staging"]);

function parseRepository(repository: string): { owner: string; repo: string } | null {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function isSameOriginRequest(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const originHeader = request.headers.get("origin");

  if (!originHeader) return true;

  try {
    const originUrl = new URL(originHeader);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

function hasEditorCookie(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .some((entry) => entry === `${STUDIO_EDITOR_COOKIE}=1`);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return json(403, { ok: false, error: "Forbidden origin" });
  }

  if (!hasEditorCookie(request)) {
    return json(401, { ok: false, error: "Studio authentication required" });
  }

  const githubToken = process.env.GITHUB_DEPLOY_TOKEN;
  const repository = process.env.GITHUB_DEPLOY_REPO ?? process.env.GITHUB_REPOSITORY;
  const eventType = process.env.GITHUB_DEPLOY_EVENT_TYPE ?? "sanity-update";
  const defaultTarget = (process.env.GITHUB_DEPLOY_TARGET ?? "").trim().toLowerCase();

  if (!githubToken) {
    return json(500, {
      ok: false,
      error: "Missing server env var: GITHUB_DEPLOY_TOKEN",
    });
  }

  if (!repository) {
    return json(500, {
      ok: false,
      error: "Missing server env var: GITHUB_DEPLOY_REPO",
    });
  }

  const parsedRepository = parseRepository(repository);
  if (!parsedRepository) {
    return json(500, {
      ok: false,
      error: "Invalid GITHUB_DEPLOY_REPO format. Use owner/repo.",
    });
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
    return json(502, {
      ok: false,
      error: "GitHub dispatch request failed",
      status: dispatchResponse.status,
      details,
    });
  }

  return json(200, {
    ok: true,
    eventType,
    repository,
    target,
  });
};

export const GET: APIRoute = async () =>
  json(405, {
    ok: false,
    error: "Method not allowed",
  });
