import { useEffect, useState, useCallback } from "react";
import { useClient, useCurrentUser } from "sanity";

// ── Types ────────────────────────────────────────────────────────────

interface RecentDoc {
  _id: string;
  _type: string;
  _updatedAt: string;
  title: string;
  slug?: string;
  status: "published" | "draft";
}

interface Stats {
  posts: number;
  pages: number;
  drafts: number;
  authors: number;
  categories: number;
  redirects: number;
}

interface SeoQuickSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SeoSetupCheck {
  key: string;
  present: boolean;
  required: boolean;
  description: string;
}

interface SeoSetupSummary {
  ready: boolean;
  googleCredentialsConfigured: boolean;
  sitesConfigured: boolean;
  analyticsConfigured: boolean;
}

interface SeoSetupStatus {
  ok: boolean;
  summary: SeoSetupSummary;
  checks: SeoSetupCheck[];
  recommendations: string[];
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function typeLabel(t: string): string {
  const labels: Record<string, string> = {
    post: "Post",
    page: "Page",
    author: "Author",
    category: "Category",
    redirect: "Redirect",
    siteSettings: "Settings",
  };
  return labels[t] || t;
}

function typeBadgeColor(t: string): string {
  const colors: Record<string, string> = {
    post: "#3b82f6",
    page: "#8b5cf6",
    author: "#f59e0b",
    category: "#10b981",
    redirect: "#6b7280",
    siteSettings: "#ef4444",
  };
  return colors[t] || "#6b7280";
}

function getStudioEditHref(doc: RecentDoc): string {
  if (doc._type === "siteSettings") {
    return "/studio/intent/edit/id=siteSettings;type=siteSettings";
  }
  const documentId = doc._id.replace(/^drafts\./, "");
  return `/studio/intent/edit/id=${encodeURIComponent(documentId)};type=${encodeURIComponent(doc._type)}`;
}

// ── Components ───────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  description,
  href,
}: {
  icon: string;
  label: string;
  description: string;
  href: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          background: hovered ? "#1e1f22" : "#161618",
          borderRadius: 12,
          padding: "24px 20px",
          border: `1px solid ${hovered ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.06)"}`,
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-1px)" : "none",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 12 }}>{icon}</div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12, color: "#777", lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </a>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "12px 20px",
        background: "#161618",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
        {value}
      </span>
      <span
        style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {label}
      </span>
    </div>
  );
}

function ActivityRow({ doc }: { doc: RecentDoc }) {
  const [hovered, setHovered] = useState(false);
  const color = typeBadgeColor(doc._type);
  const href = getStudioEditHref(doc);

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: hovered ? "#1a1b1e" : "transparent",
        borderRadius: 8,
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      {/* Type badge */}
      <div
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />

      {/* Title + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#e0e0e0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {doc.title || "Untitled"}
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
          {typeLabel(doc._type)}
          {doc.status === "draft" && (
            <span
              style={{
                marginLeft: 8,
                padding: "1px 6px",
                fontSize: 10,
                borderRadius: 4,
                background: "rgba(245,158,11,0.15)",
                color: "#f59e0b",
              }}
            >
              Draft
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div
        style={{ flexShrink: 0, fontSize: 12, color: "#555", whiteSpace: "nowrap" }}
      >
        {timeAgo(doc._updatedAt)}
      </div>
    </a>
  );
}

function SetupStatusPill({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: `1px solid ${active ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.35)"}`,
        background: active ? "rgba(34,197,94,0.08)" : "rgba(248,113,113,0.08)",
        color: active ? "#86efac" : "#fca5a5",
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "#22c55e" : "#ef4444",
          display: "inline-block",
        }}
      />
      {label}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────

export default function Dashboard() {
  const client = useClient({ apiVersion: "2025-01-01" });
  const user = useCurrentUser();
  const [activity, setActivity] = useState<RecentDoc[]>([]);
  const [stats, setStats] = useState<Stats>({
    posts: 0,
    pages: 0,
    drafts: 0,
    authors: 0,
    categories: 0,
    redirects: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [seoSummary, setSeoSummary] = useState<SeoQuickSummary | null>(null);
  const [seoSummaryLoading, setSeoSummaryLoading] = useState(false);
  const [seoSummaryError, setSeoSummaryError] = useState("");
  const [seoSetup, setSeoSetup] = useState<SeoSetupStatus | null>(null);
  const [seoSetupError, setSeoSetupError] = useState("");

  const fetchData = useCallback(() => {
    // Recent activity: last 10 edited documents across all types
    client
      .fetch<RecentDoc[]>(
        `*[_type in ["post","page","author","category","redirect","siteSettings"]]
          | order(_updatedAt desc)[0...10] {
            _id,
            _type,
            _updatedAt,
            "title": coalesce(title, siteTitle, source, name, "Untitled"),
            "slug": slug.current,
            "status": select(
              _id in path("drafts.**") => "draft",
              "published"
            )
          }`,
      )
      .then((docs) => {
        setActivity(docs);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    // Stats
    client
      .fetch<Stats>(
        `{
          "posts": count(*[_type == "post" && !(_id in path("drafts.**"))]),
          "pages": count(*[_type == "page" && !(_id in path("drafts.**"))]),
          "drafts": count(*[_id in path("drafts.**")]),
          "authors": count(*[_type == "author"]),
          "categories": count(*[_type == "category"]),
          "redirects": count(*[_type == "redirect"])
        }`,
      )
      .then(setStats)
      .catch(() => {});

    // Fetch SEO setup status only. Stats are loaded on demand.
    fetch("/api/seo/status", { credentials: "include" })
      .then(async (response) => {
        const payload = (await response.json()) as SeoSetupStatus;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load SEO setup status");
        }
        setSeoSetup(payload);
        setSeoSetupError("");
        if (!payload.summary?.ready) {
          setSeoSummary(null);
          setSeoSummaryError("");
        }
      })
      .catch((error) => {
        setSeoSetup(null);
        setSeoSummary(null);
        setSeoSetupError(
          error instanceof Error ? error.message : "Failed to load SEO setup status",
        );
      });
  }, [client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadSeoSummary = useCallback(async () => {
    if (!seoSetup?.summary.ready || seoSummaryLoading) return;

    setSeoSummaryLoading(true);
    setSeoSummaryError("");

    try {
      const response = await fetch("/api/seo/stats?days=28", {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        summary?: SeoQuickSummary;
        error?: string;
        details?: string;
        hint?: string;
      };

      if (!response.ok || !payload.ok || !payload.summary) {
        const details = payload.details ? ` (${payload.details})` : "";
        const hint = payload.hint ? ` ${payload.hint}` : "";
        throw new Error(
          `${payload.error || "Failed to load SEO snapshot"}${details}${hint}`,
        );
      }

      setSeoSummary(payload.summary);
      setSeoSummaryError("");
    } catch (error) {
      setSeoSummary(null);
      setSeoSummaryError(
        error instanceof Error ? error.message : "Failed to load SEO snapshot",
      );
    } finally {
      setSeoSummaryLoading(false);
    }
  }, [seoSetup?.summary.ready, seoSummaryLoading]);

  const firstName = user?.name?.split(" ")[0] || "";
  const greeting = getGreeting();

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        background: "#101112",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "56px 40px 80px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: "#e0e0e0",
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#fff",
              margin: "0 0 6px",
            }}
          >
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p style={{ fontSize: 15, color: "#777", margin: 0 }}>
            Manage your content, media, and site settings.
          </p>
        </div>

        {/* ── Quick Actions ──────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 16px",
            }}
          >
            Quick Actions
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <QuickAction
              icon="+"
              label="New Post"
              description="Write a new blog article"
              href="/studio/intent/create/template=post;type=post"
            />
            <QuickAction
              icon="+"
              label="New Page"
              description="Build a landing page"
              href="/studio/intent/create/template=page;type=page"
            />
            <QuickAction
              icon="+"
              label="Media Library"
              description="Upload & manage images"
              href="/studio/media"
            />
            <QuickAction
              icon="+"
              label="Site Settings"
              description="Navigation, logo, footer"
              href="/studio/intent/edit/id=siteSettings;type=siteSettings"
            />
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 16px",
            }}
          >
            Content Overview
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <StatPill value={stats.posts} label="Posts" />
            <StatPill value={stats.pages} label="Pages" />
            <StatPill value={stats.drafts} label="Drafts" />
            <StatPill value={stats.authors} label="Authors" />
            <StatPill value={stats.categories} label="Categories" />
            <StatPill value={stats.redirects} label="Redirects" />
          </div>
        </div>

        {/* ── Two-column layout ──────────────────────────── */}
        {seoSetup?.summary.ready && (
          <div style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 16px",
              }}
            >
              SEO Snapshot (28d)
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => void loadSeoSummary()}
                disabled={seoSummaryLoading}
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(59,130,246,0.7)",
                  background: seoSummaryLoading
                    ? "rgba(59,130,246,0.35)"
                    : "rgba(59,130,246,0.85)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 12px",
                  cursor: seoSummaryLoading ? "default" : "pointer",
                }}
              >
                {seoSummaryLoading
                  ? "Loading..."
                  : seoSummary
                    ? "Refresh Snapshot"
                    : "Load Snapshot"}
              </button>
              <a
                href="/studio/seo"
                style={{
                  color: "#8ab4f8",
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Open full SEO dashboard
              </a>
            </div>

            {seoSummaryError && (
              <div
                style={{
                  border: "1px solid rgba(248,113,113,0.35)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#fecaca",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                {seoSummaryError}
              </div>
            )}

            {seoSummary && (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                }}
              >
                <StatPill value={Math.round(seoSummary.clicks)} label="Clicks" />
                <StatPill value={Math.round(seoSummary.impressions)} label="Impressions" />
                <StatPill value={Math.round(seoSummary.ctr * 100)} label="CTR %" />
                <StatPill value={Number(seoSummary.position.toFixed(1))} label="Avg Pos" />
              </div>
            )}

            {!seoSummary && !seoSummaryLoading && !seoSummaryError && (
              <div style={{ color: "#6b7280", fontSize: 12 }}>
                Snapshot is loaded on demand to reduce API usage.
              </div>
            )}
          </div>
        )}

        {(seoSetup || seoSetupError) && (
          <div style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 16px",
              }}
            >
              SEO Setup Status
            </h2>

            <div
              style={{
                background: "#161618",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "18px 18px 16px",
              }}
            >
              {seoSetupError && (
                <div
                  style={{
                    border: "1px solid rgba(248,113,113,0.35)",
                    background: "rgba(248,113,113,0.08)",
                    color: "#fecaca",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {seoSetupError}
                </div>
              )}

              {seoSetup && (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <SetupStatusPill
                      label="SEO API Ready"
                      active={seoSetup.summary.ready}
                    />
                    <SetupStatusPill
                      label="Google Credentials"
                      active={seoSetup.summary.googleCredentialsConfigured}
                    />
                    <SetupStatusPill
                      label="Sites Configured"
                      active={seoSetup.summary.sitesConfigured}
                    />
                    <SetupStatusPill
                      label="GA4 Metrics"
                      active={seoSetup.summary.analyticsConfigured}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                    {seoSetup.checks.map((check) => (
                      <div
                        key={check.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.06)",
                          padding: "9px 10px",
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: "#f3f4f6",
                              fontSize: 12,
                              fontWeight: 700,
                              marginBottom: 2,
                            }}
                          >
                            {check.key}
                            {check.required && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: "#fbbf24",
                                  fontWeight: 600,
                                  fontSize: 10,
                                }}
                              >
                                REQUIRED
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              color: "#8f96a3",
                              fontSize: 11,
                              lineHeight: 1.35,
                            }}
                          >
                            {check.description}
                          </div>
                        </div>

                        <SetupStatusPill
                          label={check.present ? "Detected" : "Missing"}
                          active={check.present}
                        />
                      </div>
                    ))}
                  </div>

                  {seoSetup.recommendations.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      {seoSetup.recommendations.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          style={{
                            color: "#94a3b8",
                            fontSize: 12,
                            lineHeight: 1.4,
                          }}
                        >
                          - {item}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {/* Recent Activity */}
          <div
            style={{
              background: "#161618",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "24px 8px 16px",
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                margin: "0 0 16px",
                padding: "0 12px",
              }}
            >
              Recent Activity
            </h2>

            {!loaded && (
              <div style={{ padding: "16px 12px", color: "#555", fontSize: 13 }}>
                Loading...
              </div>
            )}

            {loaded && activity.length === 0 && (
              <div style={{ padding: "16px 12px", color: "#555", fontSize: 13 }}>
                No recent activity yet.
              </div>
            )}

            {activity.map((doc) => (
              <ActivityRow key={doc._id} doc={doc} />
            ))}
          </div>

          {/* Quick Links + Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* View Site */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #1e3a5f 0%, #162032 100%)",
                  borderRadius: 14,
                  border: "1px solid rgba(59,130,246,0.2)",
                  padding: "28px 24px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <div
                  style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 6 }}
                >
                  View Live Site
                </div>
                <div style={{ fontSize: 13, color: "#8ab4f8" }}>
                  Open your published website in a new tab
                </div>
              </div>
            </a>

            {/* Keyboard shortcuts */}
            <div
              style={{
                background: "#161618",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  margin: "0 0 16px",
                }}
              >
                Tips
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Ctrl + \\", "Toggle the sidebar"],
                  ["Ctrl + K", "Search across all content"],
                  ["Structure tab", "Edit posts, pages & settings"],
                  ["Media tab", "Upload and manage images"],
                ].map(([key, desc]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "#999" }}>{desc}</span>
                    <code
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#ccc",
                        fontFamily: "monospace",
                      }}
                    >
                      {key}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {/* Content types legend */}
            <div
              style={{
                background: "#161618",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  margin: "0 0 14px",
                }}
              >
                Content Types
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    ["post", "Posts"],
                    ["page", "Pages"],
                    ["author", "Authors"],
                    ["category", "Categories"],
                    ["redirect", "Redirects"],
                  ] as const
                ).map(([type, label]) => (
                  <div
                    key={type}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.04)",
                      fontSize: 12,
                      color: "#aaa",
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: typeBadgeColor(type),
                      }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
