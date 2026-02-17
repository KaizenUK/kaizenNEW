import { useCallback, useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Image as ImageIcon,
  KeyRound,
  Ruler,
  Type,
  Users,
} from "lucide-react";

type TaskCategory = {
  key: string;
  title: string;
  description: string;
  icon: (props: { size?: number; color?: string; strokeWidth?: number }) => JSX.Element;
  gradient: string;
  count: number;
  items: TaskItem[];
};

type TaskItem = {
  _id: string;
  title?: string;
  _type?: string;
};

type SeoTaskData = {
  needsWork: TaskItem[];
  missingTitle: TaskItem[];
  shortTitle: TaskItem[];
  longTitle: TaskItem[];
  missingDescription: TaskItem[];
  shortDescription: TaskItem[];
  longDescription: TaskItem[];
  missingKeyword: TaskItem[];
  missingImage: TaskItem[];
  missingAuthorCat: TaskItem[];
  staticMissing: TaskItem[];
  pageMissing: TaskItem[];
};

const SEO_TASKS_QUERY = `{
  "needsWork": *[_type == "post" && (
    length(coalesce(seo.metaTitle, "")) < 40 ||
    length(coalesce(seo.metaDescription, "")) < 50 ||
    !defined(seo.focusKeyword) || seo.focusKeyword == "" ||
    (!defined(seo.shareImage) && !defined(mainImage) && !defined(coverImage))
  )] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "missingTitle": *[_type == "post" && !defined(seo.metaTitle)] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "shortTitle": *[_type == "post" && defined(seo.metaTitle) && length(seo.metaTitle) < 30] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "longTitle": *[_type == "post" && defined(seo.metaTitle) && length(seo.metaTitle) > 60] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "missingDescription": *[_type == "post" && !defined(seo.metaDescription)] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "shortDescription": *[_type == "post" && defined(seo.metaDescription) && length(seo.metaDescription) < 50] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "longDescription": *[_type == "post" && defined(seo.metaDescription) && length(seo.metaDescription) > 160] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "missingKeyword": *[_type == "post" && (!defined(seo.focusKeyword) || seo.focusKeyword == "")] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "missingImage": *[_type == "post" && !defined(seo.shareImage) && !defined(mainImage) && !defined(coverImage)] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "missingAuthorCat": *[_type == "post" && (!defined(author) || count(coalesce(categories, [])) == 0)] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "staticMissing": *[_type == "staticPage" && (!defined(seo.metaTitle) || !defined(seo.metaDescription))] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type },
  "pageMissing": *[_type == "page" && (!defined(seo.metaTitle) || !defined(seo.metaDescription))] | order(_updatedAt desc) [0...10]{ _id, "title": coalesce(title, "Untitled"), _type }
}`;

const EMPTY_DATA: SeoTaskData = {
  needsWork: [],
  missingTitle: [],
  shortTitle: [],
  longTitle: [],
  missingDescription: [],
  shortDescription: [],
  longDescription: [],
  missingKeyword: [],
  missingImage: [],
  missingAuthorCat: [],
  staticMissing: [],
  pageMissing: [],
};

function truncate(value: string, limit = 50): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}...`;
}

function TaskCategoryCard({
  category,
  expanded,
  onToggle,
}: {
  category: TaskCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasIssues = category.count > 0;

  return (
    <div
      style={{
        background: "#18181b",
        border: `1px solid ${hasIssues ? "#27272a" : "rgba(34,197,94,0.3)"}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all 200ms ease",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#f4f4f5",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: hasIssues ? category.gradient : "linear-gradient(135deg, #166534 0%, #15803d 100%)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {hasIssues ? (
            <category.icon size={20} color="#fff" strokeWidth={2.2} />
          ) : (
            <CheckCircle2 size={20} color="#fff" strokeWidth={2.2} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
            {category.title}
          </div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>
            {category.description}
          </div>
        </div>
        <div
          style={{
            minWidth: 36,
            height: 28,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 700,
            background: hasIssues ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            color: hasIssues ? "#fca5a5" : "#86efac",
            flexShrink: 0,
            padding: "0 8px",
          }}
        >
          {category.count}
        </div>
        <span
          style={{
            fontSize: 14,
            color: "#71717a",
            transition: "transform 200ms ease",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          &#9660;
        </span>
      </button>

      {expanded && category.count > 0 && (
        <div style={{ padding: "0 18px 14px", borderTop: "1px solid #27272a" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 10 }}>
            {category.items.map((item) => (
              <a
                key={item._id}
                href={`/studio/intent/edit/id=${item._id.replace(/^drafts\./, "")};type=${item._type || "post"}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  color: "#d4d4d8",
                  fontSize: 13,
                  textDecoration: "none",
                  transition: "background 120ms ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileWarning size={14} color="#71717a" />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {truncate(item.title || "Untitled")}
                </span>
                <span style={{ fontSize: 11, color: "#52525b" }}>
                  {item._type === "staticPage" ? "Static" : item._type === "page" ? "Page" : "Post"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SeoTasksDashboard() {
  const client = useClient({ apiVersion: "2025-01-01" });
  const [data, setData] = useState<SeoTaskData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await client.fetch<SeoTaskData>(SEO_TASKS_QUERY);
      setData({
        needsWork: Array.isArray(payload?.needsWork) ? payload.needsWork : [],
        missingTitle: Array.isArray(payload?.missingTitle) ? payload.missingTitle : [],
        shortTitle: Array.isArray(payload?.shortTitle) ? payload.shortTitle : [],
        longTitle: Array.isArray(payload?.longTitle) ? payload.longTitle : [],
        missingDescription: Array.isArray(payload?.missingDescription) ? payload.missingDescription : [],
        shortDescription: Array.isArray(payload?.shortDescription) ? payload.shortDescription : [],
        longDescription: Array.isArray(payload?.longDescription) ? payload.longDescription : [],
        missingKeyword: Array.isArray(payload?.missingKeyword) ? payload.missingKeyword : [],
        missingImage: Array.isArray(payload?.missingImage) ? payload.missingImage : [],
        missingAuthorCat: Array.isArray(payload?.missingAuthorCat) ? payload.missingAuthorCat : [],
        staticMissing: Array.isArray(payload?.staticMissing) ? payload.staticMissing : [],
        pageMissing: Array.isArray(payload?.pageMissing) ? payload.pageMissing : [],
      });
    } catch {
      // Silently fail — individual categories will show 0
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const categories = useMemo<TaskCategory[]>(
    () => [
      {
        key: "needsWork",
        title: "Posts Needing SEO Work",
        description: "Posts with multiple SEO gaps",
        icon: AlertTriangle,
        gradient: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
        count: data.needsWork.length,
        items: data.needsWork,
      },
      {
        key: "missingTitle",
        title: "Missing Meta Title",
        description: "No meta title defined",
        icon: Type,
        gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        count: data.missingTitle.length,
        items: data.missingTitle,
      },
      {
        key: "shortTitle",
        title: "Short Meta Title (<30 chars)",
        description: "Title too short for optimal SEO",
        icon: Ruler,
        gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        count: data.shortTitle.length,
        items: data.shortTitle,
      },
      {
        key: "longTitle",
        title: "Long Meta Title (>60 chars)",
        description: "Title may be truncated in search results",
        icon: Ruler,
        gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        count: data.longTitle.length,
        items: data.longTitle,
      },
      {
        key: "missingDescription",
        title: "Missing Meta Description",
        description: "No meta description defined",
        icon: Type,
        gradient: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        count: data.missingDescription.length,
        items: data.missingDescription,
      },
      {
        key: "shortDescription",
        title: "Short Meta Description (<50 chars)",
        description: "Description too short to be effective",
        icon: Ruler,
        gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        count: data.shortDescription.length,
        items: data.shortDescription,
      },
      {
        key: "longDescription",
        title: "Long Meta Description (>160 chars)",
        description: "Description may be truncated",
        icon: Ruler,
        gradient: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        count: data.longDescription.length,
        items: data.longDescription,
      },
      {
        key: "missingKeyword",
        title: "Missing Focus Keyword",
        description: "No focus keyword set for SEO targeting",
        icon: KeyRound,
        gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        count: data.missingKeyword.length,
        items: data.missingKeyword,
      },
      {
        key: "missingImage",
        title: "Missing Social Image",
        description: "No share image, main image, or cover image",
        icon: ImageIcon,
        gradient: "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
        count: data.missingImage.length,
        items: data.missingImage,
      },
      {
        key: "missingAuthorCat",
        title: "Missing Author or Category",
        description: "Posts without author or categories assigned",
        icon: Users,
        gradient: "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)",
        count: data.missingAuthorCat.length,
        items: data.missingAuthorCat,
      },
      {
        key: "staticMissing",
        title: "Static Pages Missing Meta",
        description: "Static SEO pages without meta title or description",
        icon: FileWarning,
        gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        count: data.staticMissing.length,
        items: data.staticMissing,
      },
      {
        key: "pageMissing",
        title: "Pages Missing SEO Meta",
        description: "Managed pages without SEO metadata",
        icon: FileWarning,
        gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        count: data.pageMissing.length,
        items: data.pageMissing,
      },
    ],
    [data],
  );

  const totalIssues = categories.reduce((sum, c) => sum + c.count, 0);
  const passedCount = categories.filter((c) => c.count === 0).length;

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
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
            maxWidth: 900,
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
                fontSize: 30,
                fontWeight: 650,
                background: "linear-gradient(90deg, #ffffff 0%, #d4d4d8 72%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              SEO Tasks
            </h1>
            <p style={{ margin: "4px 0 0", color: "#a1a1aa", fontSize: 13 }}>
              Review and fix SEO issues across your content
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                borderRadius: 10,
                padding: "8px 14px",
                background: totalIssues > 0 ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                border: `1px solid ${totalIssues > 0 ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
              }}
            >
              <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Issues
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: totalIssues > 0 ? "#fca5a5" : "#86efac" }}>
                {totalIssues}
              </div>
            </div>
            <div
              style={{
                borderRadius: 10,
                padding: "8px 14px",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Passed
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#86efac" }}>
                {passedCount}/{categories.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 40px" }}>
        {loading && (
          <div style={{ color: "#94a3b8", fontSize: 13, padding: "16px 0" }}>
            Loading SEO tasks...
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((category) => (
            <TaskCategoryCard
              key={category.key}
              category={category}
              expanded={expanded.has(category.key)}
              onToggle={() => toggleExpanded(category.key)}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            background: "#18181b",
            border: "1px solid #27272a",
            textAlign: "center",
          }}
        >
          <a
            href="/studio/seo"
            style={{
              color: "#93c5fd",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Open SEO Analytics Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
