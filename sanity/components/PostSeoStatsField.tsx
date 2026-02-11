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

function chip(label: string, value: string) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "8px 10px",
        minWidth: 96,
      }}
    >
      <div style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 700 }}>{value}</div>
      <div
        style={{
          color: "#8f96a3",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
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
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SeoStatsPayload["summary"]>();

  useEffect(() => {
    if (!slug) {
      setSummary(undefined);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const pagePath = `/blog/${slug}`;
    fetch(`/api/seo/stats?page=${encodeURIComponent(pagePath)}&days=28`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as SeoStatsPayload;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load SEO stats");
        }
        setSummary(payload.summary);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load SEO stats");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [slug]);

  if (!slug) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 12 }}>
        SEO stats appear after this post has a slug.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        padding: 12,
      }}
    >
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        SEO Stats (Last 28 Days)
      </div>
      <div style={{ color: "#8f96a3", fontSize: 11, marginBottom: 10 }}>
        Filtered for <code>/blog/{slug}</code>
      </div>

      {loading && <div style={{ color: "#94a3b8", fontSize: 12 }}>Loading...</div>}
      {!loading && error && (
        <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      {!loading && !error && summary && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chip("Clicks", summary.clicks.toLocaleString())}
          {chip("Impressions", summary.impressions.toLocaleString())}
          {chip("CTR", `${(summary.ctr * 100).toFixed(2)}%`)}
          {chip("Position", summary.position.toFixed(2))}
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
        Open full SEO dashboard
      </a>
    </div>
  );
}

