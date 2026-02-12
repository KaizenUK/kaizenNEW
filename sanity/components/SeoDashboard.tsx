import { useCallback, useEffect, useMemo, useState } from "react";
import { Chart } from "react-google-charts";
import { useClient } from "sanity";

type SeoSite = {
  id: string;
  label: string;
  gscSiteUrl: string;
  ga4PropertyId?: string;
};

type SeoSummary = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  activeUsers: number;
  averageSessionDuration: number;
  screenPageViews: number;
};

type SeoResponse = {
  ok: boolean;
  availableSites: SeoSite[];
  site: SeoSite;
  filters?: { page?: string };
  range?: { startDate: string; endDate: string; days: number };
  context?: {
    siteLabel: string;
    gscProperty: string;
    ga4PropertyId?: string;
    pagePath?: string;
    pageUrl?: string;
  };
  summary: SeoSummary;
  chart: Array<[string, string, string] | [string, number, number]>;
  topQueries: Array<{
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  gaRows: Array<{
    pagePath: string;
    activeUsers: number;
    averageSessionDuration: number;
    screenPageViews: number;
  }>;
  error?: string;
  details?: string;
};

type StaticSeoPage = {
  _id: string;
  title: string;
  route?: string;
  _updatedAt: string;
};

function metric(value: string, label: string, tone?: string) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          color: tone || "#fff",
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#8f96a3",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  if (value < 60) return `${Math.round(value)}s`;
  const mins = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  return `${mins}m ${secs}s`;
}

function formatDateRange(
  range: SeoResponse["range"] | undefined,
): string {
  if (!range?.startDate || !range?.endDate) return "Last 28 days";
  return `${range.startDate} to ${range.endDate} (${range.days}d)`;
}

function toStaticPageIntentHref(id: string): string {
  const normalizedId = String(id).replace(/^drafts\./, "");
  return `/studio/intent/edit/id=${encodeURIComponent(normalizedId)};type=staticPage`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SeoDashboard() {
  const client = useClient({ apiVersion: "2025-01-01" });
  const initialPageFilter =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("page") ?? "";

  const [data, setData] = useState<SeoResponse | null>(null);
  const [siteId, setSiteId] = useState("");
  const [pageFilterInput, setPageFilterInput] = useState(initialPageFilter);
  const [pageFilter, setPageFilter] = useState(initialPageFilter.trim());
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [staticPages, setStaticPages] = useState<StaticSeoPage[]>([]);
  const [staticPagesError, setStaticPagesError] = useState("");

  const loadStats = useCallback(
    async (nextSiteId?: string, nextPageFilter?: string) => {
      setRequested(true);
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      const selected = (nextSiteId ?? siteId).trim();
      const page = (nextPageFilter ?? pageFilter).trim();
      if (selected) params.set("siteId", selected);
      if (page) params.set("page", page);
      params.set("days", "28");

      try {
        const response = await fetch(`/api/seo/stats?${params.toString()}`, {
          credentials: "include",
        });
        const payload = (await response.json()) as SeoResponse;
        if (!response.ok || !payload.ok) {
          const message = payload.error || "Failed to load SEO stats";
          const details = payload.details ? ` (${payload.details})` : "";
          throw new Error(`${message}${details}`);
        }

        setData(payload);
        if (!selected) setSiteId(payload.site.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load SEO stats");
      } finally {
        setLoading(false);
      }
    },
    [pageFilter, siteId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPageFilter(pageFilterInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [pageFilterInput]);

  useEffect(() => {
    void loadStats(siteId, pageFilter);
  }, [loadStats, pageFilter, siteId]);

  useEffect(() => {
    let cancelled = false;
    client
      .fetch<StaticSeoPage[]>(
        `*[_type == "staticPage"] | order(slug.current asc) {
          _id,
          _updatedAt,
          title,
          "route": slug.current
        }`,
      )
      .then((pages) => {
        if (cancelled) return;
        setStaticPages(Array.isArray(pages) ? pages : []);
        setStaticPagesError("");
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setStaticPages([]);
        setStaticPagesError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load static SEO pages",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  const summary = data?.summary;
  const sites = data?.availableSites ?? [];
  const chartData = useMemo(
    () => data?.chart ?? [["Date", "Clicks", "Impressions"]],
    [data],
  );
  const filterLabel = data?.filters?.page?.trim() || "All pages";
  const rangeLabel = formatDateRange(data?.range);
  const propertyLabel = data?.context?.gscProperty || data?.site?.gscSiteUrl || "-";
  const contextSiteLabel = data?.context?.siteLabel || data?.site?.label || "-";

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        background: "#101112",
        color: "#d6dae0",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 28px 56px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 30, fontWeight: 700 }}>
            SEO Analytics
          </h1>
          <p style={{ margin: "8px 0 0", color: "#86909e", fontSize: 14 }}>
            Google Search Console + GA4 for the last 28 days.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 260px) minmax(280px, 1fr) auto",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#8f96a3" }}>Site</span>
            <select
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              style={{
                background: "#16181c",
                color: "#f3f4f6",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#8f96a3" }}>
              Page filter (path or full URL)
            </span>
            <input
              value={pageFilterInput}
              onChange={(event) => setPageFilterInput(event.target.value)}
              placeholder="/blog/post-slug"
              style={{
                background: "#16181c",
                color: "#f3f4f6",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => void loadStats(siteId, pageFilter)}
            style={{
              alignSelf: "end",
              height: 42,
              borderRadius: 10,
              border: "1px solid #2f87ff",
              background: "#2f87ff",
              color: "#fff",
              fontWeight: 700,
              padding: "0 18px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            padding: "10px 12px",
            marginBottom: 18,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>
            Site: <strong>{contextSiteLabel}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Search Console property: <strong>{propertyLabel}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Page scope: <strong>{filterLabel}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Date range: <strong>{rangeLabel}</strong>
          </div>
        </div>

        {loading && <p style={{ color: "#94a3b8" }}>Loading SEO metrics...</p>}
        {error && (
          <div
            style={{
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.1)",
              color: "#fecaca",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && !summary && !requested && (
          <p style={{ color: "#94a3b8", fontSize: 12 }}>
            Metrics load automatically after opening this tool.
          </p>
        )}

        {summary && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {metric(summary.clicks.toLocaleString(), "Clicks", "#60a5fa")}
              {metric(summary.impressions.toLocaleString(), "Impressions", "#fbbf24")}
              {metric(`${(summary.ctr * 100).toFixed(2)}%`, "CTR")}
              {metric(summary.position.toFixed(2), "Avg Position")}
              {metric(summary.activeUsers.toLocaleString(), "Active Users")}
              {metric(formatSeconds(summary.averageSessionDuration), "Avg Session")}
              {metric(summary.screenPageViews.toLocaleString(), "Page Views")}
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                background: "#111317",
                padding: "14px 14px 4px",
                marginBottom: 18,
              }}
            >
              <h2 style={{ color: "#fff", margin: "0 0 8px", fontSize: 15 }}>
                Clicks vs Impressions (28 days)
              </h2>
              <Chart
                width="100%"
                height="300px"
                chartType="LineChart"
                data={chartData}
                options={{
                  fontName: "Inter",
                  legend: { position: "top", textStyle: { color: "#cbd5e1" } },
                  backgroundColor: "#111317",
                  chartArea: { left: 50, right: 12, top: 36, bottom: 44 },
                  colors: ["#60a5fa", "#fbbf24"],
                  hAxis: { textStyle: { color: "#9ca3af" } },
                  vAxis: { textStyle: { color: "#9ca3af" } },
                }}
              />
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                background: "#111317",
                overflow: "hidden",
                marginBottom: 18,
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 style={{ margin: 0, color: "#fff", fontSize: 15 }}>Top Queries</h2>
              </div>
              <div style={{ maxHeight: 360, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px" }}>Query</th>
                      <th style={{ padding: "10px 12px" }}>Page</th>
                      <th style={{ padding: "10px 12px" }}>Clicks</th>
                      <th style={{ padding: "10px 12px" }}>Impr.</th>
                      <th style={{ padding: "10px 12px" }}>CTR</th>
                      <th style={{ padding: "10px 12px" }}>Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.topQueries.slice(0, 40).map((row, index) => (
                      <tr
                        key={`${row.query}-${row.page}-${index}`}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <td style={{ padding: "10px 12px", color: "#f3f4f6" }}>{row.query}</td>
                        <td style={{ padding: "10px 12px", color: "#a5b4fc" }}>{row.page}</td>
                        <td style={{ padding: "10px 12px" }}>{row.clicks.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px" }}>{row.impressions.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px" }}>{(row.ctr * 100).toFixed(2)}%</td>
                        <td style={{ padding: "10px 12px" }}>{row.position.toFixed(2)}</td>
                      </tr>
                    ))}
                    {!data?.topQueries.length && (
                      <tr>
                        <td colSpan={6} style={{ padding: "16px 12px", color: "#94a3b8" }}>
                          No query data for this filter and period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            background: "#111317",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, color: "#fff", fontSize: 15 }}>Static SEO Pages</h2>
            <a
              href="/studio/intent/create/template=staticPage;type=staticPage"
              style={{ color: "#8ab4f8", fontSize: 12, textDecoration: "none" }}
            >
              New Static SEO Page
            </a>
          </div>

          <div style={{ maxHeight: 340, overflow: "auto" }}>
            {staticPagesError && (
              <div
                style={{
                  border: "1px solid rgba(248,113,113,0.35)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#fecaca",
                  borderRadius: 10,
                  padding: "10px 12px",
                  margin: 12,
                  fontSize: 12,
                }}
              >
                {staticPagesError}
              </div>
            )}

            {!staticPagesError && !staticPages.length && (
              <div style={{ color: "#94a3b8", fontSize: 12, padding: "12px 14px" }}>
                No static SEO pages yet. Create one per route you want to control.
              </div>
            )}

            {!staticPagesError && staticPages.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px" }}>Route</th>
                    <th style={{ padding: "10px 12px" }}>Title</th>
                    <th style={{ padding: "10px 12px" }}>Updated</th>
                    <th style={{ padding: "10px 12px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staticPages.map((page) => (
                    <tr
                      key={page._id}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <td style={{ padding: "10px 12px", color: "#a5b4fc" }}>
                        {page.route || "/"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#f3f4f6" }}>
                        {page.title || "Untitled"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>
                        {formatDateTime(page._updatedAt)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <a
                          href={toStaticPageIntentHref(page._id)}
                          style={{
                            color: "#8ab4f8",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Edit
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
