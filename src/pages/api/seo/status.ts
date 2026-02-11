import type { APIRoute } from "astro";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
} as const;

const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const DEFAULT_PUBLIC_SITE_URL = "https://kaizenweb.co.uk";

type SeoSetupCheck = {
  key: string;
  present: boolean;
  required: boolean;
  description: string;
};

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function hasEditorCookie(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .some((entry) => entry === `${STUDIO_EDITOR_COOKIE}=1`);
}

function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/\/$/, "");
}

function parseUrlHost(value: string): string {
  try {
    return normalizeHost(new URL(value).host);
  } catch {
    return "";
  }
}

function getAllowedOriginHosts(request: Request): Set<string> {
  const requestUrl = new URL(request.url);
  const hosts = new Set<string>([normalizeHost(requestUrl.host)]);

  const hostHeader = request.headers.get("host");
  if (hostHeader) {
    hosts.add(normalizeHost(hostHeader));
  }

  const forwardedHostHeader = request.headers.get("x-forwarded-host");
  if (forwardedHostHeader) {
    forwardedHostHeader
      .split(",")
      .map((entry) => normalizeHost(entry))
      .filter(Boolean)
      .forEach((host) => hosts.add(host));
  }

  const configuredSite = String(
    process.env.PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      DEFAULT_PUBLIC_SITE_URL,
  ).trim();
  const configuredHost = parseUrlHost(configuredSite);
  if (configuredHost) {
    hosts.add(configuredHost);
  }

  return hosts;
}

function isSameOriginRequest(request: Request): boolean {
  const originHeader = request.headers.get("origin");

  if (!originHeader) return true;

  try {
    const originHost = normalizeHost(new URL(originHeader).host);
    return getAllowedOriginHosts(request).has(originHost);
  } catch {
    return false;
  }
}

function hasEnv(name: string): boolean {
  return String(process.env[name] ?? "").trim().length > 0;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return json(403, { ok: false, error: "Forbidden origin" });
  }

  if (!hasEditorCookie(request)) {
    return json(401, { ok: false, error: "Studio authentication required" });
  }

  const checks: SeoSetupCheck[] = [
    {
      key: "GCP_PROJECT_ID",
      present: hasEnv("GCP_PROJECT_ID"),
      required: true,
      description: "Google Cloud project id for Search Console/GA API auth",
    },
    {
      key: "GCP_CLIENT_EMAIL",
      present: hasEnv("GCP_CLIENT_EMAIL"),
      required: true,
      description: "Service account email used to query Google APIs",
    },
    {
      key: "GCP_PRIVATE_KEY",
      present: hasEnv("GCP_PRIVATE_KEY"),
      required: true,
      description: "Service account private key",
    },
    {
      key: "SEO_SITES_JSON",
      present: hasEnv("SEO_SITES_JSON"),
      required: false,
      description: "Multi-site SEO config (preferred)",
    },
    {
      key: "GSC_SITE_URL",
      present: hasEnv("GSC_SITE_URL"),
      required: false,
      description: "Single-site Search Console fallback",
    },
    {
      key: "GA4_PROPERTY_ID",
      present: hasEnv("GA4_PROPERTY_ID"),
      required: false,
      description: "Single-site GA4 fallback / analytics reporting",
    },
  ];

  const googleCredentialsConfigured =
    checks.find((check) => check.key === "GCP_PROJECT_ID")?.present &&
    checks.find((check) => check.key === "GCP_CLIENT_EMAIL")?.present &&
    checks.find((check) => check.key === "GCP_PRIVATE_KEY")?.present;

  const sitesConfigured =
    checks.find((check) => check.key === "SEO_SITES_JSON")?.present ||
    checks.find((check) => check.key === "GSC_SITE_URL")?.present;

  const analyticsConfigured =
    checks.find((check) => check.key === "GA4_PROPERTY_ID")?.present || false;

  const ready = Boolean(googleCredentialsConfigured && sitesConfigured);

  const recommendations: string[] = [];
  if (!googleCredentialsConfigured) {
    recommendations.push(
      "Set GCP_PROJECT_ID, GCP_CLIENT_EMAIL, and GCP_PRIVATE_KEY in GitHub secrets.",
    );
  }
  if (!sitesConfigured) {
    recommendations.push(
      "Set SEO_SITES_JSON (preferred) or GSC_SITE_URL for single-site mode.",
    );
  }
  if (!analyticsConfigured) {
    recommendations.push("Set GA4_PROPERTY_ID to include Analytics metrics.");
  }

  return json(200, {
    ok: true,
    summary: {
      ready,
      googleCredentialsConfigured: Boolean(googleCredentialsConfigured),
      sitesConfigured: Boolean(sitesConfigured),
      analyticsConfigured,
    },
    checks,
    recommendations,
  });
};
