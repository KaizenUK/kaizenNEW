import { useState, useCallback } from "react";
import type { NavbarProps } from "sanity";

/**
 * Custom Studio navbar that wraps the default navbar with a
 * collapsible left sidebar for tool navigation.
 *
 * Toggles a slide-out panel on the left with the tool items
 * (Home, SEO, Structure, Media, Vision).
 */
export default function StudioNavbar(props: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggle = useCallback(() => setSidebarOpen((prev) => !prev), []);

  return (
    <div style={{ position: "relative" }}>
      {/* Compact top bar with toggle + default navbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#131415",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Sidebar toggle button */}
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
            background: sidebarOpen
              ? "rgba(255,255,255,0.08)"
              : "transparent",
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

        {/* Default navbar fills the rest */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {props.renderDefault(props)}
        </div>
      </div>

      {/* Overlay backdrop */}
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

      {/* Sidebar panel */}
      <div
        style={{
          position: "fixed",
          top: 49,
          left: 0,
          bottom: 0,
          width: 240,
          background: "#141516",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          zIndex: 1001,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 0",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "0 16px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Navigation
        </div>

        {[
          { label: "Home", href: "/studio/home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" },
          { label: "SEO Analytics", href: "/studio/seo", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m14 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m-4 0h12" },
          { label: "Structure", href: "/studio/structure", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
          { label: "Media", href: "/studio/media", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
          { label: "Vision", href: "/studio/vision", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={toggle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              color: "#d1d5db",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 0,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, color: "#6b7280" }}
            >
              <path d={item.icon} />
            </svg>
            {item.label}
          </a>
        ))}

        <div
          style={{
            margin: "16px 16px 0",
            padding: "12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            Press <kbd style={{
              background: "rgba(255,255,255,0.08)",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: 10,
              color: "#9ca3af",
            }}>Ctrl</kbd> + <kbd style={{
              background: "rgba(255,255,255,0.08)",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: 10,
              color: "#9ca3af",
            }}>K</kbd> to search
          </div>
        </div>
      </div>
    </div>
  );
}
