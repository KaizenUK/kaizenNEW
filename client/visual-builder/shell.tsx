import React, { useEffect, useState, type ReactNode } from "react";
import { ProjectIdentity } from "./ProjectsView";
import { activeProjectId } from "./projectStorage";
import {
  Archive,
  ArrowUpRight,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  LogOut,
  Moon,
  Network,
  Paintbrush,
  Rocket,
  Settings,
  Sun,
} from "lucide-react";

/* Unity-styled shell for every workspace screen: sidebar, page head and small primitives. */

export type BuilderView =
  | "settings"
  | "projects"
  | "repository"
  | "pages"
  | "site"
  | "assets"
  | "releases"
  | "redirects"
  | "previews"
  | "backups"
  | "existing";
export type BuilderTheme = "light" | "dark";

const THEME_KEY = "kaizen-builder-theme";
function readTheme(): BuilderTheme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    /* Storage can be unavailable in private windows. */
  }
  return "light";
}
export function useBuilderTheme(): [BuilderTheme, () => void] {
  const [theme, setTheme] = useState<BuilderTheme>(readTheme);
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* Preference simply resets next time. */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`builder-brand${compact ? " builder-brand-compact" : ""}`}>
      <span className="builder-brand-mark" aria-hidden="true">
        改
      </span>
      {!compact && (
        <span className="builder-brand-text">
          <strong>kaizen</strong>
          <small>Builder</small>
        </span>
      )}
    </span>
  );
}

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: BuilderTheme;
  onToggle: () => void;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="builder-theme-toggle"
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
    >
      {dark ? <Moon size={22} /> : <Sun size={22} />}
      <span className="builder-theme-track">
        <span className="builder-theme-knob" />
      </span>
    </button>
  );
}

export function Sidebar({
  view,
  onNavigate,
  localMode,
  email,
  onSignOut,
  theme,
  onToggleTheme,
  hasInventory,
  pendingCount,
}: {
  view: BuilderView;
  onNavigate: (view: BuilderView) => void;
  localMode: boolean;
  email?: string;
  onSignOut?: () => void;
  theme: BuilderTheme;
  onToggleTheme: () => void;
  hasInventory: boolean;
  pendingCount: number;
}) {
  const items: {
    id: BuilderView;
    label: string;
    icon: ReactNode;
    hidden?: boolean;
    count?: number;
  }[] = [
    {
      id: "repository",
      label: "Export & repositories",
      icon: <Network size={22} />,
      hidden: !localMode,
    },
    {
      id: "projects",
      label: "Client projects",
      icon: <Archive size={22} />,
    },
    { id: "pages", label: "Pages", icon: <FileText size={22} /> },
    { id: "site", label: "Site design", icon: <Paintbrush size={22} /> },
    {
      id: "settings",
      label: "Client settings",
      icon: <Settings size={22} />,
      hidden: activeProjectId === "kaizen",
    },
    { id: "assets", label: "Asset library", icon: <ImageIcon size={22} /> },
    {
      id: "releases",
      label: "Releases",
      icon: <Rocket size={22} />,
      hidden: localMode && activeProjectId === "kaizen",
      count: pendingCount,
    },
    { id: "redirects", label: "URL redirects", icon: <Link2 size={22} /> },
    { id: "previews", label: "Private previews", icon: <Eye size={22} /> },
    { id: "backups", label: "Project backups", icon: <Archive size={22} /> },
  ];
  const name = email ? email.split("@")[0] : "Local editor";
  return (
    <aside className="builder-sidebar-nav" aria-label="Builder navigation">
      <div className="builder-sidebar-logo">
        <Brand />
      </div>
      <div className="builder-sidebar-scroll">
        {(localMode || email) && <ProjectIdentity />}
        <p className="builder-nav-title">Workspace</p>
        <nav className="builder-nav">
          {items
            .filter((item) => !item.hidden)
            .map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.count ? (
                  <span
                    className="builder-nav-count"
                    aria-label={`${item.count} pages with changes to publish`}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
        </nav>
        <hr className="builder-nav-divider" />
        <p className="builder-nav-title">Live site</p>
        <nav className="builder-nav">
          {hasInventory && (
            <button
              type="button"
              aria-current={view === "existing" ? "page" : undefined}
              onClick={() => onNavigate("existing")}
            >
              <Network size={22} />
              <span>Existing site pages</span>
            </button>
          )}
          {activeProjectId === "kaizen" && (
            <a href="/" target="_blank" rel="noreferrer">
              <ArrowUpRight size={22} />
              <span>Open the live site</span>
            </a>
          )}
        </nav>
        <div className="builder-profile">
          <span className="builder-avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase() || "K"}
          </span>
          <span className="builder-profile-text">
            <strong>{name}</strong>
            <small>{localMode ? "Local workspace" : "Shared workspace"}</small>
          </span>
          {onSignOut && (
            <button
              type="button"
              className="builder-icon-button builder-signout"
              aria-label="Sign out"
              title="Sign out"
              onClick={onSignOut}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="builder-sidebar-footer">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <a
          href="/"
          className="builder-sidebar-exit"
          aria-label="Back to Kaizen"
          title="Back to Kaizen"
        >
          <ArrowUpRight size={22} />
        </a>
      </div>
    </aside>
  );
}

export function Shell({
  theme,
  sidebar,
  children,
}: {
  theme: BuilderTheme;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="builder-app builder-shell" data-theme={theme}>
      {sidebar}
      <div className="builder-main">{children}</div>
    </div>
  );
}

export function Head({
  info,
  title,
  children,
}: {
  info: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="builder-head">
      <div>
        <p className="builder-head-info">{info}</p>
        <h1 className="builder-head-title">{title}</h1>
      </div>
      {children && <div className="builder-head-actions">{children}</div>}
    </div>
  );
}

export function Pill({
  tone = "grey",
  children,
}: {
  tone?: "grey" | "green" | "orange" | "primary" | "blue";
  children: ReactNode;
}) {
  return (
    <span className={`builder-pill builder-pill-${tone}`}>{children}</span>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: { id: T; label?: string; icon?: ReactNode; ariaLabel?: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`builder-segmented${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-pressed={value === item.id}
          aria-label={item.ariaLabel}
          title={item.ariaLabel}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label && <span>{item.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  className,
  tone,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      className={`builder-icon-button${tone ? ` builder-icon-button-${tone}` : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export const formatWhen = (value?: string) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
