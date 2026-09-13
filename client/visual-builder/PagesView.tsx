import React, { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  LayoutTemplate,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { BuilderPage, Workspace } from "../../shared/visualBuilder";
import { Head, Notice, Pill, formatWhen } from "./shell";
import { ProjectName } from "./activeProject";
import PageThumbnail from "./PageThumbnail";
import { useProjectCapabilities } from "./activeProject";
import { builderStatuses, savedPageStatus } from "./builderStatus";

/* The workspace home: every page with its status, plus the two ways to start a new one. */

type Filter = "all" | "drafts" | "published" | "changed";
type Sort = "updated" | "title";
const tones = [
  "#A0D7E7",
  "#FFCE73",
  "#FFA2C0",
  "#CFC8FF",
  "#7FBA7A",
  "#B8E0F2",
];

export function pageStatus(
  page: BuilderPage,
  localPreview = false,
): {
  label: string;
  tone: "grey" | "green" | "orange" | "blue";
  filter: Filter;
  detail: string;
} {
  const state = localPreview ? "saved" : savedPageStatus(page);
  return {
    ...builderStatuses[state],
    filter:
      state === "live" ? "published" : page.published ? "changed" : "drafts",
  };
}

export default function PagesView({
  sitePages,
  workspace,
  localMode,
  email,
  loading,
  error,
  creating,
  onCreate,
  onOpen,
  onRetry,
  login,
}: {
  sitePages?: React.ReactNode;
  workspace?: Workspace;
  localMode: boolean;
  email?: string;
  loading: boolean;
  error: string;
  creating: boolean;
  onCreate: (template: boolean) => void;
  onOpen: (page: BuilderPage) => void;
  onRetry: () => void;
  login?: ReactNode;
}) {
  const capabilities = useProjectCapabilities();
  const localPreview = localMode && capabilities.publishPath === "github";
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [query, setQuery] = useState("");
  const pages = workspace?.pages || [];
  const counts = useMemo(() => {
    const result = { all: pages.length, drafts: 0, published: 0, changed: 0 };
    pages.forEach((page) => {
      const category = pageStatus(page, localPreview).filter;
      result[category] += 1;
      if (category === "changed") result.drafts += 1;
    });
    return result;
  }, [pages, localPreview]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pages
      .filter(
        (page) =>
          filter === "all" ||
          (filter === "drafts"
            ? pageStatus(page, localPreview).filter !== "published"
            : pageStatus(page, localPreview).filter === filter),
      )
      .filter(
        (page) =>
          !needle ||
          `${page.draft.title} /${page.draft.slug}/`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) =>
        sort === "title"
          ? a.draft.title.localeCompare(b.draft.title)
          : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
  }, [pages, filter, query, sort, localPreview]);
  const signedIn = Boolean(workspace) || localMode;
  return (
    <>
      <Head
        info={
          signedIn ? (
            <ProjectName
              fallback={localMode ? "Kaizen workspace" : "Kaizen Builder"}
            />
          ) : (
            "Kaizen Builder"
          )
        }
        title="Pages"
        description={
          workspace
            ? "Every page in this project. Drafts stay private until you publish them."
            : undefined
        }
        status={
          workspace ? (
            <Pill
              tone={localMode ? "blue" : "primary"}
              title={
                localMode
                  ? "Pages and files are saved in this computer's local workspace. Publishing here updates the local site only."
                  : `Signed in as ${email || "an editor"}. Pages are saved to the hosted workspace.`
              }
            >
              {localMode ? "Saved on this computer" : "Hosted workspace"}
            </Pill>
          ) : undefined
        }
      >
        {workspace && (
          <label className="builder-search-field">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search pages"
              placeholder="Search pages"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
      </Head>
      <div className="builder-page-body">
        {loading && (
          <p role="status" className="builder-hint">
            Opening your workspace…
          </p>
        )}
        {error && (
          <Notice
            tone="error"
            action={
              <button type="button" onClick={onRetry}>
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}
        {login}
        {workspace && (
          <>
            <section className="builder-banner" aria-label="Add a page">
              <div className="builder-banner-text">
                <h2>Add a page</h2>
                <p>
                  Start with a blank page, or with the starter template that
                  already has a hero, features and a call to action in place.
                </p>
                <div className="builder-banner-actions">
                  <button
                    type="button"
                    className="builder-banner-primary"
                    disabled={creating}
                    onClick={() => onCreate(false)}
                  >
                    <Plus size={18} /> Blank page
                  </button>
                  <button
                    type="button"
                    className="builder-banner-secondary"
                    disabled={creating}
                    onClick={() => onCreate(true)}
                  >
                    <Sparkles size={18} /> Use starter template
                  </button>
                </div>
              </div>
              <Orb className="builder-orb-large" />
              <Orb className="builder-orb-small" />
            </section>
            <section className="builder-card builder-pages-card">
              <div className="builder-pages-toolbar">
                <div
                  className="builder-filter-tabs"
                  role="group"
                  aria-label="Filter pages"
                >
                  {(
                    [
                      ["all", "All"],
                      ["drafts", "Saved"],
                      ["published", "Live"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={filter === id}
                      onClick={() => setFilter(id)}
                    >
                      {label} <span>{counts[id]}</span>
                    </button>
                  ))}
                </div>
                <label className="builder-select-field">
                  <span className="builder-sr">Sort pages</span>
                  <select
                    aria-label="Sort pages"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as Sort)}
                  >
                    <option value="updated">Last edited</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </label>
              </div>
              <div className="builder-page-list-head" aria-hidden="true">
                <span>Page</span>
                <span>Status</span>
                <span>Last edited</span>
                <span className="builder-page-row-published">
                  Last published
                </span>
                <span />
              </div>
              <div className="builder-page-list">
                {visible.map((page, index) => {
                  const status = pageStatus(page, localPreview);
                  return (
                    <button
                      type="button"
                      className="builder-page-row"
                      key={page.id}
                      onClick={() => onOpen(page)}
                    >
                      <span className="builder-page-row-page">
                        <PageThumbnail
                          document={page.draft}
                          workspace={workspace}
                          tone={tones[index % tones.length]}
                        />
                        <span className="builder-page-row-main">
                          <span className="builder-page-row-title">
                            {page.draft.title || "Untitled page"}
                          </span>
                          <small>/{page.draft.slug}/</small>
                        </span>
                      </span>
                      <Pill tone={status.tone} title={status.detail}>
                        {status.label}
                      </Pill>
                      <span className="builder-page-row-date">
                        {formatWhen(page.updatedAt)}
                      </span>
                      <span className="builder-page-row-date builder-page-row-published">
                        {page.published
                          ? formatWhen(page.publishedAt) === "—"
                            ? "Published"
                            : formatWhen(page.publishedAt)
                          : "—"}
                      </span>
                      <ArrowRight size={20} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              {!pages.length && (
                <div className="builder-empty-pages">
                  <LayoutTemplate size={28} aria-hidden="true" />
                  <strong>No pages yet</strong>
                  <span>
                    Add a blank page or use the starter template above.
                  </span>
                </div>
              )}
              {pages.length > 0 && !visible.length && (
                <p className="builder-empty">No pages match your search.</p>
              )}
            </section>
          </>
        )}
        {sitePages}
      </div>
    </>
  );
}

function Orb({ className }: { className: string }) {
  const id = className.replace(/[^a-z]/g, "");
  return (
    <svg
      viewBox="0 0 200 200"
      className={`builder-orb ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-a`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#C8BFFF" />
          <stop offset="0.45" stopColor="#8B7BEA" />
          <stop offset="1" stopColor="#3A2C9E" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${id}-a)`} />
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
        <ellipse cx="100" cy="100" rx="96" ry="26" />
        <ellipse cx="100" cy="100" rx="96" ry="52" />
        <ellipse cx="100" cy="100" rx="96" ry="78" />
        <ellipse cx="100" cy="100" rx="26" ry="96" />
        <ellipse cx="100" cy="100" rx="52" ry="96" />
        <ellipse cx="100" cy="100" rx="78" ry="96" />
      </g>
      <ellipse
        cx="66"
        cy="52"
        rx="22"
        ry="12"
        fill="rgba(255,255,255,0.35)"
        transform="rotate(-30 66 52)"
      />
    </svg>
  );
}
