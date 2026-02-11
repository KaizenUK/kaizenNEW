import { useEffect, useMemo, useState } from "react";
import type { FieldProps } from "sanity";
import { useFormValue } from "sanity";

type SeoStatsPayload = {
  ok: boolean;
  summary?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    activeUsers: number;
    screenPageViews: number;
  };
  error?: string;
};

type SeoStatusPayload = {
  ok: boolean;
  summary?: { ready: boolean };
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
      <div style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          color: "#6b7280",
          fontSize: 10,
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

export function PostSeoStatsField(_props: FieldProps<string>) {
  const slugValue = useFormValue(["slug", "current"]);
  const slug = useMemo(
    () => (typeof slugValue === "string" ? slugValue.trim() : ""),
    [slugValue],
  );

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SeoStatsPayload["summary"]>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!slug) {
      setSummary(undefined);
      setUnavailable(false);
      return;
    }

    const controller = new AbortController();

    (async () => {
      // Check if SEO API is configured before fetching stats
      try {
        const statusRes = await fetch("/api/seo/status", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!statusRes.ok) {
          setUnavailable(true);
          return;
        }
        const statusData = (await statusRes.json()) as SeoStatusPayload;
        if (!statusData.ok || !statusData.summary?.ready) {
          setUnavailable(true);
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUnavailable(true);
        return;
      }

      // API is ready — fetch stats for this slug
      setLoading(true);
      const pagePath = `/blog/${slug}`;
      try {
        const res = await fetch(
          `/api/seo/stats?page=${encodeURIComponent(pagePath)}&days=28`,
          { credentials: "include", signal: controller.signal },
        );
        const payload = (await res.json()) as SeoStatsPayload;
        if (!res.ok || !payload.ok) {
          setUnavailable(true);
          return;
        }
        setSummary(payload.summary);
        setUnavailable(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [slug]);

  // Don't render anything if no slug
  if (!slug) return null;

  // Quiet message if Google API isn't configured
  if (unavailable) {
    return (
      <div
        style={{
          borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 12px",
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        SEO stats unavailable — Google API not configured.
        <a
          href="/studio/seo"
          style={{ marginLeft: 6, color: "#93c5fd", textDecoration: "none" }}
        >
          Check setup
        </a>
      </div>
    );
  }

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
      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 10 }}>
        /blog/{slug}
      </div>

      {loading && (
        <div style={{ color: "#6b7280", fontSize: 12 }}>Loading...</div>
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
