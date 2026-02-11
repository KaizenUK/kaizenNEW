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

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: hovered ? "#1a1b1e" : "transparent",
        borderRadius: 8,
        cursor: "default",
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
  }, [client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
              href="/studio/structure/blog;posts"
            />
            <QuickAction
              icon="+"
              label="New Page"
              description="Build a landing page"
              href="/studio/structure/page"
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
              href="/studio/structure/site-settings"
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
