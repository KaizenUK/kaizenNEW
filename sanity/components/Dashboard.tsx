import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useClient, useCurrentUser } from "sanity";
import {
  Calendar,
  FileClock,
  FileCode,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Layers,
  SearchCheck,
  Upload,
  X,
} from "lucide-react";
import { pageTemplates } from "../templates";

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

type DraftPage = {
  _id: string;
  title?: string;
  _updatedAt?: string;
};

type DashboardData = {
  draftCount: number;
  drafts: DraftPost[];
  scheduledCount: number;
  scheduled: ScheduledPost[];
  publishedCount: number;
  seoNeedsCount: number;
  mediaCount: number;
  media: MediaAsset[];
  staticPageCount: number;
  staticPages: StaticPage[];
  pageCount: number;
  draftPageCount: number;
  draftPages: DraftPage[];
};

const DASHBOARD_QUERY = `{
  "draftCount": count(*[_type == "post" && _id in path("drafts.**")]),
  "drafts": *[_type == "post" && _id in path("drafts.**")] | order(_updatedAt desc)[0...3]{
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
  ] | order(publishedAt asc)[0...3]{
    _id,
    "title": coalesce(title, "Untitled"),
    publishedAt
  },
  "publishedCount": count(*[
    _type == "post" &&
    !(_id in path("drafts.**")) &&
    defined(publishedAt) &&
    dateTime(publishedAt) <= dateTime(now())
  ]),
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
  "mediaCount": count(*[_type == "sanity.imageAsset"]),
  "media": *[_type == "sanity.imageAsset"] | order(_updatedAt desc)[0...4]{
    _id,
    url,
    originalFilename
  },
  "staticPageCount": count(*[_type == "staticPage" && !(_id in path("drafts.**"))]),
  "staticPages": *[_type == "staticPage" && !(_id in path("drafts.**"))] | order(slug.current asc)[0...3]{
    _id,
    "title": coalesce(title, "Untitled"),
    "route": coalesce(slug.current, "/")
  },
  "pageCount": count(*[_type == "page" && !(_id in path("drafts.**"))]),
  "draftPageCount": count(*[_type == "page" && _id in path("drafts.**")]),
  "draftPages": *[_type == "page" && _id in path("drafts.**")] | order(_updatedAt desc)[0...3]{
    _id,
    "title": coalesce(title, "Untitled"),
    _updatedAt
  }
}`;

const EMPTY_DATA: DashboardData = {
  draftCount: 0,
  drafts: [],
  scheduledCount: 0,
  scheduled: [],
  publishedCount: 0,
  seoNeedsCount: 0,
  mediaCount: 0,
  media: [],
  staticPageCount: 0,
  staticPages: [],
  pageCount: 0,
  draftPageCount: 0,
  draftPages: [],
};

type DeployState = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
};

const INITIAL_DEPLOY_STATE: DeployState = {
  status: "idle",
  message: "",
};

type CardModel = {
  key: string;
  title: string;
  description: string;
  statLabel: string;
  statValue: string;
  actionLabel: string;
  actionHref?: string;
  onClick?: () => void;
  detail: string;
  gradient: string;
  icon: (props: { size?: number; color?: string; strokeWidth?: number }) => ReactNode;
};

function truncate(value: string, limit = 44): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}...`;
}

function formatPublishedDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
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

function normalizeRoute(route?: string): string {
  const value = String(route ?? "").trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function DashboardCard({
  card,
  hovered,
  onHoverChange,
}: {
  card: CardModel;
  hovered: boolean;
  onHoverChange: (key: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHoverChange(card.key)}
      onMouseLeave={() => onHoverChange(null)}
      style={{
        position: "relative",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: hovered
          ? "0 22px 46px rgba(0,0,0,0.4)"
          : "0 10px 22px rgba(0,0,0,0.22)",
        transform: hovered ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
        transition: "all 220ms ease",
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: card.gradient,
          opacity: hovered ? 0.12 : 0,
          transition: "opacity 220ms ease",
        }}
      />
      <div
        style={{
          position: "relative",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: card.gradient,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 10px 22px rgba(0,0,0,0.28)",
          }}
        >
          <card.icon size={28} color="#ffffff" strokeWidth={2.2} />
        </div>

        <div>
          <h3
            style={{
              margin: "2px 0 6px",
              color: "#ffffff",
              fontSize: 23,
              lineHeight: 1.2,
              fontWeight: 650,
            }}
          >
            {card.title}
          </h3>
          <p
            style={{
              margin: 0,
              color: "#a1a1aa",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {card.description}
          </p>
        </div>

        <div
          style={{
            marginTop: 4,
            marginBottom: 2,
            paddingBottom: 12,
            borderBottom: "1px solid #27272a",
          }}
        >
          <div style={{ color: "#71717a", fontSize: 12 }}>{card.statLabel}</div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 30,
              lineHeight: 1.1,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {card.statValue}
          </div>
        </div>

        <p
          style={{
            margin: 0,
            color: "#d4d4d8",
            fontSize: 12,
            minHeight: 18,
          }}
        >
          {card.detail}
        </p>

        {card.onClick ? (
          <button
            type="button"
            onClick={card.onClick}
            style={{
              marginTop: "auto",
              border: "none",
              cursor: "pointer",
              borderRadius: 12,
              background: card.gradient,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 650,
              textAlign: "center",
              padding: "11px 14px",
              boxShadow: "0 10px 16px rgba(0,0,0,0.25)",
              width: "100%",
            }}
          >
            {card.actionLabel}
          </button>
        ) : (
          <a
            href={card.actionHref}
            style={{
              marginTop: "auto",
              textDecoration: "none",
              borderRadius: 12,
              background: card.gradient,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 650,
              textAlign: "center",
              padding: "11px 14px",
              boxShadow: "0 10px 16px rgba(0,0,0,0.25)",
              display: "block",
            }}
          >
            {card.actionLabel}
          </a>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -36,
          width: 170,
          height: 170,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 72%)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 280ms ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  const client = useClient({ apiVersion: "2025-01-01" });
  const user = useCurrentUser();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [deployState, setDeployState] = useState<DeployState>(INITIAL_DEPLOY_STATE);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

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
        publishedCount: Number(payload?.publishedCount ?? 0),
        seoNeedsCount: Number(payload?.seoNeedsCount ?? 0),
        mediaCount: Number(payload?.mediaCount ?? 0),
        media: Array.isArray(payload?.media) ? payload.media : [],
        staticPageCount: Number(payload?.staticPageCount ?? 0),
        staticPages: Array.isArray(payload?.staticPages) ? payload.staticPages : [],
        pageCount: Number(payload?.pageCount ?? 0),
        draftPageCount: Number(payload?.draftPageCount ?? 0),
        draftPages: Array.isArray(payload?.draftPages) ? payload.draftPages : [],
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

  const handlePublishDeploy = useCallback(async () => {
    setDeployState({
      status: "pending",
      message: "Queueing deploy...",
    });

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "workflow-dashboard" }),
      });

      let payload: Record<string, unknown> = {};
      try {
        payload = (await response.json()) as Record<string, unknown>;
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const fallbackMessage =
          typeof payload.error === "string"
            ? payload.error
            : `Deploy request failed (${response.status})`;
        throw new Error(fallbackMessage);
      }

      const target =
        typeof payload.target === "string" && payload.target.trim()
          ? payload.target.trim().toUpperCase()
          : "";

      setDeployState({
        status: "success",
        message: target ? `Deploy queued for ${target}.` : "Deploy queued.",
      });
    } catch (deployError) {
      setDeployState({
        status: "error",
        message:
          deployError instanceof Error
            ? deployError.message
            : "Failed to trigger deploy",
      });
    }
  }, []);

  const cards = useMemo<CardModel[]>(() => {
    const latestDraft = data.drafts[0];
    const nextScheduled = data.scheduled[0];
    const latestMedia = data.media[0];
    const firstStaticPage = data.staticPages[0];
    const latestDraftPage = data.draftPages[0];

    return [
      {
        key: "new-post",
        title: "New Post",
        description: "Create a new blog post or article",
        icon: FileText,
        gradient: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)",
        statLabel: "Quick start",
        statValue: "-",
        actionLabel: "Create",
        actionHref: "/studio/intent/create/type=post/",
        detail: "Open the post editor and publish when ready.",
      },
      {
        key: "new-page",
        title: "New Page",
        description: "Build a page from templates or start blank",
        icon: LayoutTemplate,
        gradient: "linear-gradient(135deg, #14b8a6 0%, #0284c7 100%)",
        statLabel: "Published",
        statValue: String(data.pageCount),
        actionLabel: "Choose Template",
        onClick: () => setShowTemplateModal(true),
        detail: "Pick a ready-made layout or start blank.",
      },
      {
        key: "draft-pages",
        title: "Draft Pages",
        description: "Pages in progress, not yet published",
        icon: Layers,
        gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        statLabel: "In progress",
        statValue: String(data.draftPageCount),
        actionLabel: "View All",
        actionHref: "/studio/structure/draft-pages",
        detail: latestDraftPage
          ? `Latest: ${truncate(latestDraftPage.title || "Untitled")} (${formatUpdated(latestDraftPage._updatedAt)})`
          : "No draft pages right now.",
      },
      {
        key: "drafts",
        title: "Drafts",
        description: "Continue working on unpublished content",
        icon: FileClock,
        gradient: "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)",
        statLabel: "In progress",
        statValue: String(data.draftCount),
        actionLabel: "View All",
        actionHref: "/studio/structure/draft-posts",
        detail: latestDraft
          ? `Latest: ${truncate(latestDraft.title || "Untitled")} (${formatUpdated(latestDraft._updatedAt)})`
          : "No draft posts right now.",
      },
      {
        key: "scheduled",
        title: "Scheduled",
        description: "Manage your scheduled publications",
        icon: Calendar,
        gradient: "linear-gradient(135deg, #a855f7 0%, #db2777 100%)",
        statLabel: "Upcoming",
        statValue: String(data.scheduledCount),
        actionLabel: "Schedule",
        actionHref: "/studio/structure/scheduled-posts",
        detail: nextScheduled
          ? `Next: ${formatPublishedDate(nextScheduled.publishedAt)} - ${truncate(nextScheduled.title || "Untitled")}`
          : "No scheduled posts in queue.",
      },
      {
        key: "seo",
        title: "SEO",
        description: "Optimize your content for search engines",
        icon: SearchCheck,
        gradient: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
        statLabel: "Needs work",
        statValue: String(data.seoNeedsCount),
        actionLabel: "Review",
        actionHref: "/studio/seoTasks",
        detail:
          data.seoNeedsCount > 0
            ? `${data.seoNeedsCount} documents are missing key SEO fields.`
            : "No immediate SEO metadata gaps found.",
      },
      {
        key: "media",
        title: "Media",
        description: "Browse and manage your media library",
        icon: ImageIcon,
        gradient: "linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)",
        statLabel: "Assets",
        statValue: String(data.mediaCount),
        actionLabel: "Browse",
        actionHref: "/studio/media",
        detail: latestMedia
          ? `Recent: ${truncate(latestMedia.originalFilename || "Image asset")}`
          : "No media assets uploaded yet.",
      },
      {
        key: "static-pages",
        title: "Static Pages",
        description: "Edit and maintain your static pages",
        icon: FileCode,
        gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        statLabel: "Pages",
        statValue: String(data.staticPageCount),
        actionLabel: "Manage",
        actionHref: "/studio/structure/staticPage",
        detail: firstStaticPage
          ? `First route: ${normalizeRoute(firstStaticPage.route)}`
          : "No static SEO pages created yet.",
      },
    ];
  }, [data]);

  const totalProjects = useMemo(
    () => data.publishedCount + data.draftCount + data.staticPageCount + data.pageCount,
    [data.draftCount, data.publishedCount, data.staticPageCount, data.pageCount],
  );

  const quickStats = useMemo(
    () => [
      {
        label: "Published Posts",
        value: String(data.publishedCount),
        note: "Live on site",
        color: "#22c55e",
      },
      {
        label: "Draft Posts",
        value: String(data.draftCount),
        note: "Awaiting publish",
        color: "#3b82f6",
      },
      {
        label: "Scheduled",
        value: String(data.scheduledCount),
        note: "Queued for future",
        color: "#a855f7",
      },
      {
        label: "SEO Items",
        value: String(data.seoNeedsCount),
        note: "Need metadata review",
        color: "#f97316",
      },
    ],
    [data.draftCount, data.publishedCount, data.scheduledCount, data.seoNeedsCount],
  );

  return (
    <>
    <div
      style={{
        minHeight: "100%",
        background: "#1a1a1a",
        color: "#f4f4f5",
        overflow: "auto",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          borderBottom: "1px solid #27272a",
          background: "rgba(15,15,15,0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "24px 24px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                lineHeight: 1.1,
                fontWeight: 650,
                background:
                  "linear-gradient(90deg, #ffffff 0%, #d4d4d8 72%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Workflow Dashboard
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                color: "#a1a1aa",
                fontSize: 14,
              }}
            >
              Manage your content with ease
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handlePublishDeploy()}
            disabled={deployState.status === "pending"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 18px",
              borderRadius: 10,
              border: "none",
              background:
                deployState.status === "pending"
                  ? "linear-gradient(90deg, #15803d 0%, #0f766e 100%)"
                  : "linear-gradient(90deg, #16a34a 0%, #0d9488 100%)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 650,
              cursor: deployState.status === "pending" ? "wait" : "pointer",
              boxShadow: "0 10px 18px rgba(16,185,129,0.24)",
              opacity: deployState.status === "pending" ? 0.88 : 1,
            }}
            title="Trigger deployment webhook"
          >
            <Upload size={16} />
            {deployState.status === "pending" ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px 40px" }}>
        <div
          style={{
            marginBottom: 22,
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </div>

        {deployState.status !== "idle" && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border:
                deployState.status === "error"
                  ? "1px solid rgba(248,113,113,0.55)"
                  : "1px solid rgba(34,197,94,0.45)",
              background:
                deployState.status === "error"
                  ? "rgba(127,29,29,0.25)"
                  : "rgba(21,128,61,0.22)",
              color: deployState.status === "error" ? "#fecaca" : "#bbf7d0",
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {deployState.message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.55)",
              background: "rgba(127,29,29,0.25)",
              color: "#fecaca",
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loading && !error && (
          <div style={{ marginBottom: 16, color: "#94a3b8", fontSize: 13 }}>
            Loading dashboard cards...
          </div>
        )}

        <div
          style={{
            marginBottom: 28,
            borderRadius: 24,
            padding: 28,
            background:
              "linear-gradient(90deg, #4f46e5 0%, #9333ea 50%, #db2777 100%)",
            color: "#ffffff",
            boxShadow: "0 22px 42px rgba(88,28,135,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 650 }}>
                Welcome back to your studio
              </h2>
              <p style={{ margin: 0, fontSize: 20, opacity: 0.9 }}>
                Your content control center is ready
              </p>
            </div>
            <div
              style={{
                borderRadius: 14,
                padding: "10px 16px",
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.88 }}>Total Projects</div>
              <div style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 700 }}>
                {totalProjects}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {cards.map((card) => (
            <DashboardCard
              key={card.key}
              card={card}
              hovered={hoveredCard === card.key}
              onHoverChange={setHoveredCard}
            />
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {quickStats.map((item) => (
            <div
              key={item.label}
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 4 }}>
                {item.label}
              </div>
              <div
                style={{
                  color: "#ffffff",
                  fontSize: 34,
                  lineHeight: 1.1,
                  fontWeight: 700,
                }}
              >
                {item.value}
              </div>
              <div style={{ color: item.color, fontSize: 13, marginTop: 8 }}>
                {item.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {showTemplateModal && (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowTemplateModal(false)}
        />
        <div
          style={{
            position: "relative",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 20,
            padding: 28,
            width: "100%",
            maxWidth: 800,
            maxHeight: "90vh",
            overflow: "auto",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#ffffff", fontSize: 22, fontWeight: 650 }}>
                Choose a page template
              </h2>
              <p style={{ margin: "6px 0 0", color: "#71717a", fontSize: 13 }}>
                Start with a ready-made layout, or create a blank page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplateModal(false)}
              style={{
                flexShrink: 0,
                background: "transparent",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                color: "#a1a1aa",
                cursor: "pointer",
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
              }}
            >
              <X size={14} />
              Close
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={() => {
                window.location.href = "/studio/intent/create/type=page/";
                setShowTemplateModal(false);
              }}
              style={{
                background: "#27272a",
                border: "1px solid #3f3f46",
                borderRadius: 12,
                padding: "18px 16px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #3f3f46 0%, #52525b 100%)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <FileCode size={20} color="#ffffff" />
              </div>
              <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 650 }}>Blank Page</div>
              <div style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                Start from scratch with an empty canvas.
              </div>
            </button>
            {pageTemplates.map((tmpl) => {
              const Icon = tmpl.icon as (props: { size?: number; color?: string }) => ReactNode;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    window.location.href = `/studio/intent/create/template=${tmpl.id};type=page/`;
                    setShowTemplateModal(false);
                  }}
                  style={{
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: 12,
                    padding: "18px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #14b8a6 0%, #0284c7 100%)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon size={20} color="#ffffff" />
                  </div>
                  <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 650 }}>{tmpl.title}</div>
                  {tmpl.description && (
                    <div style={{ color: "#71717a", fontSize: 12, lineHeight: 1.5 }}>
                      {tmpl.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
