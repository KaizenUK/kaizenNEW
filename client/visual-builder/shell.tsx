import { helpTopics, type HelpTopic } from "./helpContent";
import HelpLink from "./HelpLink";
import React, { useEffect, useState, type ReactNode } from "react";
import { Brand } from "./Brand";
export { Brand } from "./Brand";
import { ProjectIdentity, useProjectCapabilities } from "./activeProject";
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
  Share2,
  UserRound,
  Sun,
} from "lucide-react";

/* Unity-styled shell for every workspace screen: sidebar, page head and small primitives. */

export type BuilderView =
  | "account"
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

type NavItem = {
  id: BuilderView;
  label: string;
  icon: ReactNode;
  hidden?: boolean;
  count?: number;
};

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
  const capabilities = useProjectCapabilities();
  const legacy = capabilities.legacyWorkspace;
  // Grouped by what the user is trying to do, in the order the work happens.
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Build",
      items: [
        { id: "pages", label: "Pages", icon: <FileText size={22} /> },
        { id: "site", label: "Site design", icon: <Paintbrush size={22} /> },
        { id: "assets", label: "Assets", icon: <ImageIcon size={22} /> },
      ],
    },
    {
      title: "Publish",
      items: [
        {
          id: "releases",
          label: "Releases",
          icon: <Rocket size={22} />,
          hidden: localMode && capabilities.publishPath === "github",
          count: pendingCount,
        },
        { id: "redirects", label: "Redirects", icon: <Link2 size={22} /> },
        { id: "previews", label: "Private previews", icon: <Eye size={22} /> },
      ],
    },
    {
      title: "Project",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: <Settings size={22} />,
        },
        { id: "backups", label: "Backups", icon: <Archive size={22} /> },
        {
          id: "repository",
          label: "Export & handoff",
          icon: <Share2 size={22} />,
        },
      ],
    },
  ];
  if (!localMode)
    groups.push({
      title: "Account",
      items: [
        { id: "account", label: "Account", icon: <UserRound size={22} /> },
      ],
    });
  const name = email ? email.split("@")[0] : "Local editor";
  const showLiveSite = hasInventory || legacy;
  return (
    <aside className="builder-sidebar-nav" aria-label="Builder navigation">
      <div className="builder-sidebar-logo">
        <Brand />
      </div>
      <div className="builder-sidebar-scroll">
        {(localMode || email) && (
          <ProjectIdentity
            current={view === "projects"}
            onSwitch={() => onNavigate("projects")}
          />
        )}
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.hidden);
          if (!items.length) return null;
          return (
            <React.Fragment key={group.title}>
              <p className="builder-nav-title">{group.title}</p>
              <nav className="builder-nav" aria-label={group.title}>
                {items.map((item) => (
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
            </React.Fragment>
          );
        })}
        {showLiveSite && (
          <>
            <p className="builder-nav-title">Live site</p>
            <nav className="builder-nav" aria-label="Live site">
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
              {legacy && (
                <a href="/" target="_blank" rel="noreferrer">
                  <ArrowUpRight size={22} />
                  <span>Open the live site</span>
                </a>
              )}
            </nav>
          </>
        )}
        <div className="builder-profile">
          <span className="builder-avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase() || "K"}
          </span>
          <span className="builder-profile-text">
            <strong>{name}</strong>
            <small>
              {localMode ? "Saved on this computer" : "Hosted workspace"}
            </small>
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
        <Pill>Private beta</Pill>
        <a
          href="/"
          className="builder-sidebar-exit"
          aria-label="Open the Kaizen website"
          title="Open the Kaizen website"
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

/* Every workspace screen starts with the same head: where you are, what this screen is for, and its actions. */
export function Head({
  info,
  title,
  description,
  help,
  status,
  children,
}: {
  info?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  help?: HelpTopic;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="builder-head">
      <div className="builder-head-text">
        {info && <p className="builder-head-info">{info}</p>}
        <div className="builder-head-titlerow">
          <h1 className="builder-head-title">{title}</h1>
          {status}
        </div>
        {(description || help) && (
          <p className="builder-head-description">
            {description || (help && helpTopics[help].description)}
            {help && (
              <>
                {" "}
                <HelpLink topic={help} />
              </>
            )}
          </p>
        )}
      </div>
      {children && <div className="builder-head-actions">{children}</div>}
    </div>
  );
}

/* A titled block inside a page body. Cards keep one job each. */
export function Card({
  title,
  description,
  children,
  className,
  ariaLabel,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      className={`builder-card builder-block${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      {(title || description) && (
        <div className="builder-block-head">
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({
  tone = "grey",
  children,
  title,
}: {
  tone?: "grey" | "green" | "orange" | "primary" | "blue";
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`builder-pill builder-pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

/* Status, error and success messages share one shape so every screen reads the same way. */
export function Notice({
  tone = "info",
  children,
  action,
  className,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`builder-notice builder-notice-${tone}${className ? ` ${className}` : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>{children}</span>
      {action}
    </div>
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
