import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FieldProps } from "sanity";
import { useFormValue } from "sanity";

type SeoStatsPayload = {
  ok: boolean;
  range?: { startDate: string; endDate: string; days: number };
  context?: {
    siteLabel?: string;
    gscProperty?: string;
    pagePath?: string;
    pageUrl?: string;
  };
  summary?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    activeUsers: number;
    screenPageViews: number;
  };
  error?: string;
  details?: string;
  hint?: string;
};

type SeoStatusPayload = {
  ok: boolean;
  summary?: { ready: boolean };
  recommendations?: string[];
  error?: string;
};

function chip(label: string, value: string) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "8px 10px",
        minWidth: 80,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ color: "#e0e0e0", fontSize: 13, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          color: "#6b7280",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatDateRange(
  range: SeoStatsPayload["range"] | undefined,
): string {
  if (!range?.startDate || !range?.endDate) return "Last 28 days";
  return `${range.startDate} to ${range.endDate} (${range.days}d)`;
}

export function PostSeoStatsField(_props: FieldProps<string>) {
  const slugValue = useFormValue(["slug", "current"]);
  const slug = useMemo(
    () => (typeof slugValue === "string" ? slugValue.trim() : ""),
    [slugValue],
  );

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SeoStatsPayload["summary"]>();
  const [context, setContext] = useState<SeoStatsPayload["context"]>();
  const [range, setRange] = useState<SeoStatsPayload["range"]>();
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const fetchingRef = useRef(false);

  useEffect(() => {
    setSummary(undefined);
    setContext(undefined);
    setRange(undefined);
    setError("");
    setRequested(false);
  }, [slug]);

  const loadStats = useCallback(async () => {
    if (!slug || fetchingRef.current) return;

    fetchingRef.current = true;
    setRequested(true);
    setLoading(true);
    setError("");

    try {
      const statusRes = await fetch("/api/seo/status", {
        credentials: "include",
      });
      const statusData = (await statusRes.json()) as SeoStatusPayload;
      if (!statusRes.ok || !statusData.ok || !statusData.summary?.ready) {
        const recommendation = statusData.recommendations?.[0];
        const message =
          statusData.error ||
          recommendation ||
          "SEO stats unavailable because Google API setup is incomplete.";
        throw new Error(message);
      }

      const pagePath = `/blog/${slug}`;
      const response = await fetch(
        `/api/seo/stats?page=${encodeURIComponent(pagePath)}&days=28`,
        { credentials: "include" },
      );
      const payload = (await response.json()) as SeoStatsPayload;
      if (!response.ok || !payload.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const hint = payload.hint ? ` ${payload.hint}` : "";
        throw new Error(
          `${payload.error || "Failed to load SEO stats."}${details}${hint}`,
        );
      }

      setSummary(payload.summary);
      setContext(payload.context);
      setRange(payload.range);
      setError("");
    } catch (err) {
      setSummary(undefined);
      setContext(undefined);
      setRange(undefined);
      setError(err instanceof Error ? err.message : "Failed to load SEO stats.");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void loadStats();
  }, [slug, loadStats]);

  if (!slug) return null;

  const rangeLabel = formatDateRange(range);
  const pageScope = context?.pagePath || `/blog/${slug}`;
  const siteLabel = context?.siteLabel || "Primary Site";
  const propertyLabel = context?.gscProperty || "-";

  return (
    <div
      style={{
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: 12,
      }}
    >
      <div
        style={{ color: "#e0e0e0", fontSize: 13, fontWeight: 700, marginBottom: 4 }}
      >
        SEO Stats (28 days)
      </div>

      <div style={{ display: "grid", gap: 3, marginBottom: 10 }}>
        <div style={{ color: "#94a3b8", fontSize: 11 }}>
          Site: <strong>{siteLabel}</strong>
        </div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>
          Property: <strong>{propertyLabel}</strong>
        </div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>
          Page scope: <strong>{pageScope}</strong>
        </div>
        <div style={{ color: "#6b7280", fontSize: 11 }}>
          Date range: <strong>{rangeLabel}</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => void loadStats()}
          disabled={loading}
          style={{
            borderRadius: 8,
            border: "1px solid rgba(59,130,246,0.7)",
            background: loading ? "rgba(59,130,246,0.35)" : "rgba(59,130,246,0.85)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Loading..." : requested ? "Refresh Stats" : "Load Stats"}
        </button>
      </div>

      {!loading && error && (
        <div style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      {!loading && summary && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chip("Clicks", summary.clicks.toLocaleString())}
          {chip("Impressions", summary.impressions.toLocaleString())}
          {chip("CTR", `${(summary.ctr * 100).toFixed(1)}%`)}
          {chip("Position", summary.position.toFixed(1))}
          {chip("Users", summary.activeUsers.toLocaleString())}
          {chip("Views", summary.screenPageViews.toLocaleString())}
        </div>
      )}

      {!loading && !summary && !error && (
        <div style={{ color: "#6b7280", fontSize: 12 }}>
          Loading current stats...
        </div>
      )}

      <a
        href={`/studio/seo?page=${encodeURIComponent(`/blog/${slug}`)}`}
        style={{
          marginTop: 10,
          display: "inline-block",
          color: "#93c5fd",
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        Full SEO dashboard
      </a>
    </div>
  );
}
