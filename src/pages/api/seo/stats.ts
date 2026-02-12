import type { APIRoute } from "astro";
import { google, type Auth } from "googleapis";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
} as const;

const STUDIO_EDITOR_COOKIE = "kaizen_studio_auth";
const MAX_DAYS = 90;
const DEFAULT_DAYS = 28;
const DEFAULT_PUBLIC_SITE_URL = "https://kaizenweb.co.uk";

type SeoSiteConfig = {
  id: string;
  label: string;
  gscSiteUrl: string;
  ga4PropertyId?: string;
};

type SearchConsoleRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type TrendPoint = {
  date: string;
  clicks: number;
  impressions: number;
};

type GaRow = {
  pagePath: string;
  activeUsers: number;
  averageSessionDuration: number;
  screenPageViews: number;
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

  const configuredSite =
    getEnv("PUBLIC_SITE_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL") ||
    DEFAULT_PUBLIC_SITE_URL;
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

function getEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function parseDays(rawDays: string | null): number {
  const value = Number.parseInt(rawDays ?? "", 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DAYS;
  return Math.min(value, MAX_DAYS);
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function normalizeUrlPrefixSite(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  if (!trimmed) return "";

  const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");
  const isBareDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed);

  if (trimmed.startsWith("sc-domain:")) {
    const host = stripTrailingSlash(trimmed.slice("sc-domain:".length)).toLowerCase();
    return host ? `sc-domain:${host}` : "";
  }

  if (isBareDomain) {
    return `sc-domain:${stripTrailingSlash(trimmed).toLowerCase()}`;
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    try {
      const url = new URL(`https://${trimmed}`);
      const asDomain = `${url.hostname}`.toLowerCase();
      if (asDomain && !trimmed.includes("/")) {
        return `sc-domain:${asDomain}`;
      }
      return `${url.protocol}//${url.host}/`;
    } catch {
      return trimmed;
    }
  }
}

function parseDomainFromGscSiteUrl(gscSiteUrl: string): string {
  const trimmed = gscSiteUrl.trim().toLowerCase();
  if (!trimmed) return "";

  if (trimmed.startsWith("sc-domain:")) {
    return trimmed.slice("sc-domain:".length).replace(/\/+$/, "");
  }

  if (/^https?:\/\//.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function resolvePageFilterOrigin(gscSiteUrl: string, request: Request): string {
  const configuredSite =
    getEnv("PUBLIC_SITE_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL") ||
    DEFAULT_PUBLIC_SITE_URL;

  const requestOrigin = new URL(request.url).origin;
  const gscDomain = parseDomainFromGscSiteUrl(gscSiteUrl);

  if (/^https?:\/\//.test(gscSiteUrl)) {
    try {
      return new URL(gscSiteUrl).origin;
    } catch {
      // Fall through to configured site handling.
    }
  }

  if (gscDomain) {
    try {
      const configuredUrl = new URL(configuredSite);
      const configuredHost = configuredUrl.hostname.toLowerCase();
      if (configuredHost === gscDomain) {
        return configuredUrl.origin;
      }
    } catch {
      // Ignore invalid configured site URL and continue with fallback.
    }
    return `https://${gscDomain}`;
  }

  try {
    return new URL(configuredSite).origin;
  } catch {
    return requestOrigin;
  }
}

function resolveDefaultSeoSite(request: Request): string {
  const configuredSite =
    getEnv("PUBLIC_SITE_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL") ||
    DEFAULT_PUBLIC_SITE_URL;
  const normalizedConfigured = normalizeUrlPrefixSite(configuredSite);
  if (normalizedConfigured) return normalizedConfigured;
  return normalizeUrlPrefixSite(`${new URL(request.url).origin}/`);
}

function unwrapQuoted(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function tryParseStrictSites(raw: string): SeoSiteConfig[] {
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  const normalized: SeoSiteConfig[] = [];

  for (const site of parsed) {
    const id = String(site.id ?? "").trim();
    const label = String(site.label ?? "").trim();
    const gscSiteUrl = normalizeUrlPrefixSite(String(site.gscSiteUrl ?? "").trim());
    const ga4PropertyId = String(site.ga4PropertyId ?? "").trim();

    if (!id || !gscSiteUrl) continue;
    normalized.push({
      id,
      label: label || id,
      gscSiteUrl,
      ga4PropertyId: ga4PropertyId || undefined,
    });
  }

  return normalized;
}

function parseSeoSitesFromEnv(): SeoSiteConfig[] {
  const sitesRaw = getEnv("SEO_SITES_JSON") || getEnv("SEO_SITES");
  if (!sitesRaw) {
    const fallbackGsc = normalizeUrlPrefixSite(getEnv("GSC_SITE_URL"));
    const fallbackGa = getEnv("GA4_PROPERTY_ID");
    if (!fallbackGsc) return [];
    return [
      {
        id: "kaizenweb",
        label: "Kaizen Web",
        gscSiteUrl: fallbackGsc,
        ga4PropertyId: fallbackGa || undefined,
      },
    ];
  }

  const parseCandidates = [
    sitesRaw,
    unwrapQuoted(sitesRaw),
    unwrapQuoted(sitesRaw).replace(/\\"/g, '"'),
  ];

  for (const candidate of parseCandidates) {
    try {
      const parsed = tryParseStrictSites(candidate);
      if (parsed.length) return parsed;
    } catch {
      // Continue and try looser parsing below.
    }
  }

  {
    const source = unwrapQuoted(sitesRaw);
    const looseMatches = source.match(/\{[^{}]+\}/g) ?? [];
    const normalized: SeoSiteConfig[] = [];
    for (const block of looseMatches) {
      const extract = (key: string): string => {
        const regex = new RegExp(
          `${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^,}\\n]+))`,
          "i",
        );
        const match = block.match(regex);
        return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
      };

      const id = extract("id");
      const label = extract("label");
      const gscSiteUrl = normalizeUrlPrefixSite(extract("gscSiteUrl"));
      const ga4PropertyId = extract("ga4PropertyId");

      if (!id || !gscSiteUrl) continue;
      normalized.push({
        id,
        label: label || id,
        gscSiteUrl,
        ga4PropertyId: ga4PropertyId || undefined,
      });
    }

    return normalized;
  }
}

function getGoogleAuth() {
  const projectId = getEnv("GCP_PROJECT_ID");
  const clientEmail = getEnv("GCP_CLIENT_EMAIL");
  const privateKey = getEnv("GCP_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return new google.auth.GoogleAuth({
    credentials: {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
  });
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolvePageFilter(
  rawPage: string | null,
  gscSiteUrl: string,
  pageFilterOrigin: string,
): { pageUrl?: string; pagePath?: string } {
  if (!rawPage) return {};
  const value = rawPage.trim();
  if (!value) return {};

  try {
    const url = new URL(value);
    return { pageUrl: url.toString(), pagePath: url.pathname || "/" };
  } catch {
    const normalizedPath = value.startsWith("/") ? value : `/${value}`;
    try {
      return {
        pageUrl: new URL(normalizedPath, pageFilterOrigin).toString(),
        pagePath: normalizedPath,
      };
    } catch {
      if (gscSiteUrl.startsWith("http://") || gscSiteUrl.startsWith("https://")) {
        try {
          const base = new URL(gscSiteUrl);
          return {
            pageUrl: new URL(normalizedPath, base.origin).toString(),
            pagePath: normalizedPath,
          };
        } catch {
          return { pagePath: normalizedPath };
        }
      }
      return { pagePath: normalizedPath };
    }
  }
}

async function fetchSearchConsoleData(args: {
  auth: Auth.GoogleAuth;
  gscSiteUrl: string;
  startDate: string;
  endDate: string;
  pageUrl?: string;
}): Promise<{ queryRows: SearchConsoleRow[]; trendRows: TrendPoint[] }> {
  const webmasters = google.webmasters({ version: "v3", auth: args.auth });
  const pageFilter = args.pageUrl
    ? [
        {
          filters: [
            {
              dimension: "page",
              operator: "equals",
              expression: args.pageUrl,
            },
          ],
        },
      ]
    : undefined;

  const [queryResponse, trendResponse] = await Promise.all([
    webmasters.searchanalytics.query({
      siteUrl: args.gscSiteUrl,
      requestBody: {
        startDate: args.startDate,
        endDate: args.endDate,
        dimensions: ["query", "page"],
        rowLimit: 100,
        dimensionFilterGroups: pageFilter,
      },
    }),
    webmasters.searchanalytics.query({
      siteUrl: args.gscSiteUrl,
      requestBody: {
        startDate: args.startDate,
        endDate: args.endDate,
        dimensions: ["date"],
        rowLimit: 100,
        dimensionFilterGroups: pageFilter,
      },
    }),
  ]);

  const queryRows = (queryResponse.data.rows ?? []).map((row) => ({
    query: String(row.keys?.[0] ?? ""),
    page: String(row.keys?.[1] ?? ""),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: toNumber(row.ctr),
    position: toNumber(row.position),
  }));

  const trendRows = (trendResponse.data.rows ?? []).map((row) => ({
    date: String(row.keys?.[0] ?? ""),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
  }));

  return { queryRows, trendRows };
}

async function fetchGa4Data(args: {
  auth: Auth.GoogleAuth;
  ga4PropertyId?: string;
  startDate: string;
  endDate: string;
  pagePath?: string;
}): Promise<GaRow[]> {
  if (!args.ga4PropertyId) return [];

  const analyticsData = google.analyticsdata({ version: "v1beta", auth: args.auth });
  const dimensionFilter = args.pagePath
    ? {
        filter: {
          fieldName: "pagePath",
          stringFilter: {
            matchType: "EXACT",
            value: args.pagePath,
          },
        },
      }
    : undefined;

  const response = await analyticsData.properties.runReport({
    property: `properties/${args.ga4PropertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
        { name: "screenPageViews" },
      ],
      limit: "100",
      dimensionFilter,
    },
  });

  return (response.data.rows ?? []).map((row) => ({
    pagePath: String(row.dimensionValues?.[0]?.value ?? ""),
    activeUsers: toNumber(row.metricValues?.[0]?.value),
    averageSessionDuration: toNumber(row.metricValues?.[1]?.value),
    screenPageViews: toNumber(row.metricValues?.[2]?.value),
  }));
}

function summarizeSearchConsole(queryRows: SearchConsoleRow[], trendRows: TrendPoint[]) {
  const clicks = trendRows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = trendRows.reduce((sum, row) => sum + row.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;

  const weightedPosition = queryRows.reduce(
    (sum, row) => sum + row.position * Math.max(row.impressions, 1),
    0,
  );
  const weightedImpressions = queryRows.reduce(
    (sum, row) => sum + Math.max(row.impressions, 1),
    0,
  );
  const position = weightedImpressions > 0 ? weightedPosition / weightedImpressions : 0;

  return { clicks, impressions, ctr, position };
}

function summarizeGa4(rows: GaRow[]) {
  if (!rows.length) {
    return {
      activeUsers: 0,
      averageSessionDuration: 0,
      screenPageViews: 0,
    };
  }

  const activeUsers = rows.reduce((sum, row) => sum + row.activeUsers, 0);
  const screenPageViews = rows.reduce((sum, row) => sum + row.screenPageViews, 0);

  const durationWeighted = rows.reduce((sum, row) => {
    const weight = Math.max(row.activeUsers, 1);
    return sum + row.averageSessionDuration * weight;
  }, 0);
  const durationWeight = rows.reduce(
    (sum, row) => sum + Math.max(row.activeUsers, 1),
    0,
  );

  return {
    activeUsers,
    averageSessionDuration: durationWeight > 0 ? durationWeighted / durationWeight : 0,
    screenPageViews,
  };
}

function extractGoogleApiError(error: unknown): { message: string; status: number } {
  const fallback = {
    message: error instanceof Error ? error.message : "Unknown error",
    status: 502,
  };

  if (!error || typeof error !== "object") return fallback;

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    response?: {
      status?: unknown;
      data?: { error?: { message?: unknown } };
    };
    errors?: Array<{ message?: unknown }>;
  };

  const responseStatus = Number(maybeError.response?.status);
  const codeStatus = Number(maybeError.code);
  const status = Number.isFinite(responseStatus)
    ? responseStatus
    : Number.isFinite(codeStatus)
      ? codeStatus
      : 502;

  const responseMessage = maybeError.response?.data?.error?.message;
  const firstErrorMessage = maybeError.errors?.[0]?.message;
  const ownMessage = maybeError.message;
  const message = String(
    responseMessage ?? firstErrorMessage ?? ownMessage ?? fallback.message,
  );

  return { message, status };
}

function isAuthorizationFailure(message: string, status: number): boolean {
  if (status === 401 || status === 403) return true;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not authorized") ||
    normalized.includes("permission") ||
    normalized.includes("insufficient")
  );
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!isSameOriginRequest(request)) {
    return json(403, { ok: false, error: "Forbidden origin" });
  }

  if (!hasEditorCookie(request)) {
    return json(401, { ok: false, error: "Studio authentication required" });
  }

  let sites = parseSeoSitesFromEnv();
  if (!sites.length) {
    const fallbackSite = resolveDefaultSeoSite(request);
    const fallbackGa = getEnv("GA4_PROPERTY_ID");
    sites = [
      {
        id: "primary",
        label: "Primary Site",
        gscSiteUrl: fallbackSite,
        ga4PropertyId: fallbackGa || undefined,
      },
    ];
  }

  if (!sites.length) {
    return json(500, {
      ok: false,
      error:
        "No SEO sites configured. Set SEO_SITES_JSON (or GSC_SITE_URL/GA4_PROPERTY_ID).",
    });
  }

  const authProvider = getGoogleAuth();
  if (!authProvider) {
    return json(500, {
      ok: false,
      error:
        "Missing Google credentials. Set GCP_PROJECT_ID, GCP_CLIENT_EMAIL, and GCP_PRIVATE_KEY.",
    });
  }

  const siteIdParam = (url.searchParams.get("siteId") ?? "").trim();
  const selectedSite =
    sites.find((site) => site.id === siteIdParam) ?? sites[0];

  const days = parseDays(url.searchParams.get("days"));
  const { startDate, endDate } = getDateRange(days);
  const pageFilterOrigin = resolvePageFilterOrigin(selectedSite.gscSiteUrl, request);
  const pageFilter = resolvePageFilter(
    url.searchParams.get("page"),
    selectedSite.gscSiteUrl,
    pageFilterOrigin,
  );

  try {
    const auth = authProvider;
    const [{ queryRows, trendRows }, gaRows] = await Promise.all([
      fetchSearchConsoleData({
        auth,
        gscSiteUrl: selectedSite.gscSiteUrl,
        startDate,
        endDate,
        pageUrl: pageFilter.pageUrl,
      }),
      fetchGa4Data({
        auth,
        ga4PropertyId: selectedSite.ga4PropertyId,
        startDate,
        endDate,
        pagePath: pageFilter.pagePath,
      }),
    ]);

    const searchSummary = summarizeSearchConsole(queryRows, trendRows);
    const gaSummary = summarizeGa4(gaRows);

    return json(200, {
      ok: true,
      availableSites: sites,
      site: selectedSite,
      range: { startDate, endDate, days },
      filters: {
        page: pageFilter.pageUrl ?? pageFilter.pagePath ?? "",
      },
      summary: {
        ...searchSummary,
        ...gaSummary,
      },
      chart: [
        ["Date", "Clicks", "Impressions"],
        ...trendRows.map((row) => [row.date, row.clicks, row.impressions]),
      ],
      topQueries: queryRows,
      gaRows,
    });
  } catch (error) {
    const { message, status } = extractGoogleApiError(error);
    const authFailure = isAuthorizationFailure(message, status);
    return json(authFailure ? 403 : 502, {
      ok: false,
      error: authFailure
        ? "Google API authorization failed for the configured Search Console property."
        : "Failed to fetch SEO stats from Google APIs.",
      details: message,
      site: selectedSite,
      hint: authFailure
        ? `Grant the service account access to "${selectedSite.gscSiteUrl}" in Search Console, then retry.`
        : undefined,
    });
  }
};
