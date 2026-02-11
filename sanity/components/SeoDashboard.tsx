import { useCallback, useEffect, useMemo, useState } from "react";
import { Chart } from "react-google-charts";

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

export default function SeoDashboard() {
  const [data, setData] = useState<SeoResponse | null>(null);
  const [siteId, setSiteId] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(
    async (nextSiteId?: string, nextPageFilter?: string) => {
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
        if (!siteId) setSiteId(payload.site.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load SEO stats");
      } finally {
        setLoading(false);
      }
    },
    [pageFilter, siteId],
  );

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const summary = data?.summary;
  const sites = data?.availableSites ?? [];
  const chartData = useMemo(() => data?.chart ?? [["Date", "Clicks", "Impressions"]], [data]);

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
            marginBottom: 20,
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
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
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
      </div>
    </div>
  );
}

