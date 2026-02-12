import { useCallback, useEffect, useMemo, useState } from "react";
import { useClient, useCurrentUser } from "sanity";

type DraftPost = {
  _id: string;
  title?: string;
  _updatedAt?: string;
};

type ScheduledPost = {
  _id: string;
  title?: string;
  publishedAt?: string;
};

type MediaAsset = {
  _id: string;
  url?: string;
  originalFilename?: string;
};

type StaticPage = {
  _id: string;
  title?: string;
  route?: string;
};

type DashboardData = {
  draftCount: number;
  drafts: DraftPost[];
  scheduledCount: number;
  scheduled: ScheduledPost[];
  seoNeedsCount: number;
  media: MediaAsset[];
  staticPages: StaticPage[];
};

const DASHBOARD_QUERY = `{
  "draftCount": count(*[_type == "post" && _id in path("drafts.**")]),
  "drafts": *[_type == "post" && _id in path("drafts.**")] | order(_updatedAt desc)[0...5]{
    _id,
    "title": coalesce(title, "Untitled"),
    _updatedAt
  },
  "scheduledCount": count(*[
    _type == "post" &&
    !(_id in path("drafts.**")) &&
    defined(publishedAt) &&
    dateTime(publishedAt) > dateTime(now())
  ]),
  "scheduled": *[
    _type == "post" &&
    !(_id in path("drafts.**")) &&
    defined(publishedAt) &&
    dateTime(publishedAt) > dateTime(now())
  ] | order(publishedAt asc)[0...5]{
    _id,
    "title": coalesce(title, "Untitled"),
    publishedAt
  },
  "seoNeedsCount": count(*[
    _type in ["post", "page", "staticPage"] &&
    !(_id in path("drafts.**")) &&
    (
      !defined(seo.metaTitle) ||
      length(coalesce(seo.metaTitle, "")) < 30 ||
      !defined(seo.metaDescription) ||
      length(coalesce(seo.metaDescription, "")) < 50
    )
  ]),
  "media": *[_type == "sanity.imageAsset"] | order(_updatedAt desc)[0...6]{
    _id,
    url,
    originalFilename
  },
  "staticPages": *[_type == "staticPage" && !(_id in path("drafts.**"))] | order(slug.current asc)[0...6]{
    _id,
    "title": coalesce(title, "Untitled"),
    "route": coalesce(slug.current, "/")
  }
}`;

const EMPTY_DATA: DashboardData = {
  draftCount: 0,
  drafts: [],
  scheduledCount: 0,
  scheduled: [],
  seoNeedsCount: 0,
  media: [],
  staticPages: [],
};

function normalizeRoute(route?: string): string {
  const value = String(route ?? "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function formatUpdated(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function formatScheduledDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function staticPageEditHref(id: string): string {
  const documentId = String(id).replace(/^drafts\./, "");
  return `/studio/intent/edit/id=${encodeURIComponent(documentId)};type=staticPage`;
}

function SectionTitle({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          color: "#f8fafc",
          fontSize: 24,
          lineHeight: 1.2,
          margin: 0,
          fontWeight: 650,
        }}
      >
        {title}
      </h2>
      {badge && (
        <span
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 999,
            color: "#cbd5e1",
            fontSize: 11,
            padding: "4px 9px",
            letterSpacing: "0.03em",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function CardShell({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        minHeight: 250,
        borderRadius: 14,
        padding: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: `radial-gradient(160% 120% at 85% 8%, ${accent}22 0%, rgba(12,14,18,0.92) 56%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

function ActionButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        borderRadius: 9,
        border: "1px solid rgba(147,197,253,0.55)",
        background: "rgba(59,130,246,0.28)",
        color: "#dbeafe",
        fontSize: 13,
        fontWeight: 700,
        padding: "9px 12px",
      }}
    >
      {label}
    </a>
  );
}

export default function Dashboard() {
  const client = useClient({ apiVersion: "2025-01-01" });
  const user = useCurrentUser();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = String(user?.name ?? "")
    .trim()
    .split(" ")
    .filter(Boolean)[0];

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await client.fetch<DashboardData>(DASHBOARD_QUERY);
      setData({
        draftCount: Number(payload?.draftCount ?? 0),
        drafts: Array.isArray(payload?.drafts) ? payload.drafts : [],
        scheduledCount: Number(payload?.scheduledCount ?? 0),
        scheduled: Array.isArray(payload?.scheduled) ? payload.scheduled : [],
        seoNeedsCount: Number(payload?.seoNeedsCount ?? 0),
        media: Array.isArray(payload?.media) ? payload.media : [],
        staticPages: Array.isArray(payload?.staticPages) ? payload.staticPages : [],
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load workflow dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        background:
          "radial-gradient(160% 120% at 15% 0%, #172338 0%, #0b0f17 52%, #090d14 100%)",
      }}
    >
      <div style={{ maxWidth: 1260, margin: "0 auto", padding: "34px 24px 42px" }}>
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                color: "#9fb4d8",
                fontSize: 13,
              }}
            >
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </p>
            <h1
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: 34,
                lineHeight: 1.1,
                fontWeight: 700,
              }}
            >
              Workflow Dashboard
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            style={{
              border: "1px solid rgba(148,163,184,0.45)",
              borderRadius: 10,
              background: "rgba(15,23,42,0.8)",
              color: "#dbeafe",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            style={{
              border: "1px solid rgba(248,113,113,0.45)",
              borderRadius: 12,
              background: "rgba(127,29,29,0.2)",
              color: "#fecaca",
              fontSize: 13,
              padding: "11px 12px",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading && !error && (
          <div
            style={{
              color: "#9fb4d8",
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            Loading workflow cards...
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          <CardShell accent="#6ea8ff">
            <SectionTitle title="New Post" />
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(147,197,253,0.2)",
                borderRadius: 12,
                background: "rgba(59,130,246,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#93c5fd",
                fontSize: 64,
                fontWeight: 300,
                marginBottom: 12,
              }}
            >
              +
            </div>
            <ActionButton
              href="/studio/intent/create/template=post;type=post"
              label="Create New Post"
            />
          </CardShell>

          <CardShell accent="#72d384">
            <SectionTitle title="Scheduled" badge={`${data.scheduledCount}`} />
            <div style={{ display: "grid", gap: 8, marginBottom: 12, flex: 1 }}>
              {data.scheduled.length === 0 && (
                <p style={{ margin: 0, color: "#86efac", fontSize: 13 }}>
                  No scheduled posts.
                </p>
              )}
              {data.scheduled.map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "68px 1fr",
                    gap: 10,
                    fontSize: 13,
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: "#86efac", fontWeight: 700 }}>
                    {formatScheduledDate(item.publishedAt)}
                  </span>
                  <span
                    style={{
                      color: "#d1fae5",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title || "Untitled"}
                  </span>
                </div>
              ))}
            </div>
            <a
              href="/studio/structure"
              style={{
                color: "#86efac",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Open Posts
            </a>
          </CardShell>

          <CardShell accent="#6ea8ff">
            <SectionTitle title="Media" badge={`${data.media.length}`} />
            <div
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {data.media.length === 0 &&
                [0, 1, 2].map((item) => (
                  <div
                    key={item}
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "rgba(148,163,184,0.08)",
                      minHeight: 66,
                    }}
                  />
                ))}
              {data.media.map((asset) => (
                <div
                  key={asset._id}
                  style={{
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: "rgba(15,23,42,0.45)",
                    minHeight: 66,
                  }}
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={asset.originalFilename || "Media item"}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <ActionButton href="/studio/media" label="Open Library" />
          </CardShell>

          <CardShell accent="#e3a764">
            <SectionTitle title="Drafts" badge={`${data.draftCount}`} />
            <div style={{ display: "grid", gap: 8, marginBottom: 12, flex: 1 }}>
              {data.drafts.length === 0 && (
                <p style={{ margin: 0, color: "#fcd9b7", fontSize: 13 }}>
                  No post drafts right now.
                </p>
              )}
              {data.drafts.map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    fontSize: 13,
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      color: "#fde7cf",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title || "Untitled"}
                  </span>
                  <span style={{ color: "#fdba74", fontSize: 11 }}>
                    {formatUpdated(item._updatedAt)}
                  </span>
                </div>
              ))}
            </div>
            <a
              href="/studio/structure"
              style={{
                color: "#fdba74",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Open Drafts
            </a>
          </CardShell>

          <CardShell accent="#94a3b8">
            <SectionTitle title="SEO" badge={`${data.seoNeedsCount}`} />
            <div
              style={{
                flex: 1,
                display: "grid",
                placeItems: "center",
                marginBottom: 12,
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.2)",
                background: "rgba(148,163,184,0.08)",
              }}
            >
              <div style={{ textAlign: "center", padding: 14 }}>
                <div
                  style={{
                    color: "#e2e8f0",
                    fontSize: 30,
                    lineHeight: 1,
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  SEO
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                  {data.seoNeedsCount} pages missing key meta fields
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ActionButton href="/studio/seo" label="Open SEO" />
              <ActionButton href="/studio/seoTasks" label="SEO Tasks" />
            </div>
          </CardShell>

          <CardShell accent="#94a3b8">
            <SectionTitle title="Static Pages" badge={`${data.staticPages.length}`} />
            <div style={{ display: "grid", gap: 8, marginBottom: 12, flex: 1 }}>
              {data.staticPages.length === 0 && (
                <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13 }}>
                  No static SEO pages created yet.
                </p>
              )}
              {data.staticPages.map((item) => (
                <a
                  key={item._id}
                  href={staticPageEditHref(item._id)}
                  style={{
                    textDecoration: "none",
                    color: "#dbeafe",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 8,
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: "#93c5fd" }}>edit</span>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {normalizeRoute(item.route)}
                    {item.title ? ` - ${item.title}` : ""}
                  </span>
                </a>
              ))}
            </div>
            <ActionButton
              href="/studio/intent/create/template=staticPage;type=staticPage"
              label="New Static Page"
            />
          </CardShell>
        </div>
      </div>
    </div>
  );
}
