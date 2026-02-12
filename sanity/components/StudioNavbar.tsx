import { useCallback, useMemo, useState } from "react";
import type { NavbarProps } from "sanity";

type NavLink = {
  label: string;
  href: string;
  icon: string;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Home",
    links: [
      {
        label: "Workflow Dashboard",
        href: "/studio/home",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
      },
    ],
  },
  {
    title: "Content",
    links: [
      {
        label: "New Post",
        href: "/studio/intent/create/template=post;type=post",
        icon: "M12 5v14 M5 12h14",
      },
      {
        label: "New Page",
        href: "/studio/intent/create/template=page;type=page",
        icon: "M12 5v14 M5 12h14",
      },
      {
        label: "New Static Page",
        href: "/studio/intent/create/template=staticPage;type=staticPage",
        icon: "M12 5v14 M5 12h14",
      },
      {
        label: "Posts",
        href: "/studio/structure/blog;post",
        icon: "M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm0 4h14M9 2v4",
      },
      {
        label: "Static Pages",
        href: "/studio/structure/staticPage",
        icon: "M4 5h16v14H4z M8 5v14 M16 9H8",
      },
      {
        label: "Pages",
        href: "/studio/structure/page",
        icon: "M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z M14 2v6h6",
      },
      {
        label: "Categories",
        href: "/studio/structure/blog;category",
        icon: "M4 7h8v8H4z M14 4h6v6h-6z M14 12h6v8h-6z",
      },
      {
        label: "Authors",
        href: "/studio/structure/blog;author",
        icon: "M16 11c1.66 0 3-1.79 3-4s-1.34-4-3-4-3 1.79-3 4 1.34 4 3 4z M8 11c1.66 0 3-1.79 3-4S9.66 3 8 3 5 4.79 5 7s1.34 4 3 4z M8 13c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z M16 13c-.29 0-.62.02-.97.05 1.34.97 2.97 2.48 2.97 4.95v1h6v-2c0-2.66-5.33-4-8-4z",
      },
    ],
  },
  {
    title: "SEO",
    links: [
      {
        label: "SEO Dashboard",
        href: "/studio/seo",
        icon: "M3 17l6-6 4 4 8-8 M14 7h7v7",
      },
      {
        label: "SEO Tasks",
        href: "/studio/seoTasks",
        icon: "M9 5h11 M9 12h11 M9 19h11 M3 5h.01 M3 12h.01 M3 19h.01",
      },
    ],
  },
  {
    title: "Media",
    links: [
      {
        label: "Media Library",
        href: "/studio/media",
        icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      },
    ],
  },
  {
    title: "Settings",
    links: [
      {
        label: "Site Settings",
        href: "/studio/intent/edit/id=siteSettings;type=siteSettings",
        icon: "M10.325 4.317a1 1 0 011.35-.936 8.03 8.03 0 012.258.94 1 1 0 001.246-.145 1 1 0 011.415 0l.57.57a1 1 0 010 1.415 1 1 0 00-.145 1.246 8.03 8.03 0 01.94 2.258 1 1 0 00.936 1.35 1 1 0 011 1v.806a1 1 0 01-1 1 1 1 0 00-.936 1.35 8.03 8.03 0 01-.94 2.258 1 1 0 00.145 1.246 1 1 0 010 1.415l-.57.57a1 1 0 01-1.415 0 1 1 0 00-1.246-.145 8.03 8.03 0 01-2.258.94 1 1 0 00-1.35.936 1 1 0 01-1 1h-.806a1 1 0 01-1-1 1 1 0 00-1.35-.936 8.03 8.03 0 01-2.258-.94 1 1 0 00-1.246.145 1 1 0 01-1.415 0l-.57-.57a1 1 0 010-1.415 1 1 0 00.145-1.246 8.03 8.03 0 01-.94-2.258 1 1 0 00-.936-1.35 1 1 0 01-1-1v-.806a1 1 0 011-1 1 1 0 00.936-1.35 8.03 8.03 0 01.94-2.258 1 1 0 00-.145-1.246 1 1 0 010-1.415l.57-.57a1 1 0 011.415 0 1 1 0 001.246.145 8.03 8.03 0 012.258-.94 1 1 0 001.35-.936 1 1 0 011-1h.806a1 1 0 011 1z M12 15a3 3 0 100-6 3 3 0 000 6z",
      },
    ],
  },
  {
    title: "Utilities",
    links: [
      {
        label: "Redirects",
        href: "/studio/structure/redirect",
        icon: "M4 7h10 M10 3l4 4-4 4 M20 17H10 M14 13l-4 4 4 4",
      },
      {
        label: "Structure (Advanced)",
        href: "/studio/structure",
        icon: "M4 6h16 M4 10h16 M4 14h16 M4 18h16",
      },
      {
        label: "Vision",
        href: "/studio/vision",
        icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
      },
    ],
  },
];

/**
 * Custom Studio navbar with collapsible left navigation.
 * Focused on editor-first workflow categories.
 */
export default function StudioNavbar(props: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggle = useCallback(() => setSidebarOpen((prev) => !prev), []);

  const currentPath = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.pathname}${window.location.search}`.toLowerCase();
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#131415",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle navigation"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            marginLeft: 8,
            background: sidebarOpen ? "rgba(255,255,255,0.08)" : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            color: "#9ca3af",
            transition: "all 0.15s ease",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            {sidebarOpen ? (
              <>
                <line x1="4" y1="4" x2="14" y2="14" />
                <line x1="14" y1="4" x2="4" y2="14" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="15" y2="5" />
                <line x1="3" y1="9" x2="15" y2="9" />
                <line x1="3" y1="13" x2="15" y2="13" />
              </>
            )}
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>{props.renderDefault(props)}</div>
      </div>

      {sidebarOpen && (
        <div
          onClick={toggle}
          style={{
            position: "fixed",
            inset: 0,
            top: 49,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
            transition: "opacity 0.15s ease",
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 49,
          left: 0,
          bottom: 0,
          width: 286,
          background: "#141516",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          zIndex: 1001,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 0 14px",
          overflowY: "auto",
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: "0 16px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {section.title}
            </div>

            {section.links.map((item) => {
              const isActive = currentPath.startsWith(item.href.toLowerCase());
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={toggle}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: "0 10px 4px",
                    padding: "10px 10px",
                    color: isActive ? "#e2e8f0" : "#cbd5e1",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: 8,
                    border: isActive
                      ? "1px solid rgba(96,165,250,0.35)"
                      : "1px solid transparent",
                    background: isActive
                      ? "rgba(59,130,246,0.16)"
                      : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(event) => {
                    if (isActive) return;
                    (event.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(event) => {
                    if (isActive) return;
                    (event.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: isActive ? "#93c5fd" : "#6b7280" }}
                  >
                    <path d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        ))}

        <div
          style={{
            margin: "10px 14px 0",
            padding: "12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
            Press{" "}
            <kbd
              style={{
                background: "rgba(255,255,255,0.08)",
                padding: "1px 5px",
                borderRadius: 4,
                fontSize: 10,
                color: "#9ca3af",
              }}
            >
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd
              style={{
                background: "rgba(255,255,255,0.08)",
                padding: "1px 5px",
                borderRadius: 4,
                fontSize: 10,
                color: "#9ca3af",
              }}
            >
              K
            </kbd>{" "}
            to search any content
          </div>
        </div>
      </div>
    </div>
  );
}
