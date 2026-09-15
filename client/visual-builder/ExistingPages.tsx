import React, { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { PageInventory } from "../../shared/builderPageInventory";
import { Card, Head, Pill } from "./shell";
import { ProjectName } from "./activeProject";

/* Pages that belong to the site's own code and CMS rather than to the builder. */

const kindLabel = {
  cms: "CMS content",
  redirect: "Site redirect",
  site: "Site page",
} as const;

export default function ExistingPages({
  inventory,
  onEdit,
}: {
  inventory: PageInventory;
  open?: boolean;
  onEdit?: (path: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [showRedirects, setShowRedirects] = useState(false),
    [limit, setLimit] = useState(25);
  const filtered = useMemo(
    () =>
      inventory.pages.filter(
        (page) =>
          (showRedirects || page.kind !== "redirect") &&
          `${page.title} ${page.path} ${page.destination || ""}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [inventory, search, showRedirects],
  );
  return (
    <>
      <Head
        info={<ProjectName fallback="Kaizen workspace" />}
        title="Existing site pages"
        help="existing"
      >
        <a
          className="builder-secondary builder-button-link"
          href={inventory.studioUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open site CMS ↗
        </a>
      </Head>
      <div className="builder-page-body">
        <Card
          className="builder-existing-pages"
          ariaLabel="Existing site pages list"
        >
          <div className="builder-existing-filters">
            <label>
              Find an existing page
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(25);
                }}
                placeholder="Search names or URLs"
              />
            </label>
            <label className="builder-existing-checkbox">
              <input
                type="checkbox"
                checked={showRedirects}
                onChange={(event) => {
                  setShowRedirects(event.target.checked);
                  setLimit(25);
                }}
              />
              Include site redirects
            </label>
          </div>
          <p className="builder-hint">
            {filtered.length} pages found · Recorded{" "}
            {new Date(inventory.generatedAt).toLocaleDateString()}.
            {inventory.cmsStatus !== "available" &&
              (inventory.cmsStatus === "not-configured"
                ? " The CMS connection is not configured in this build, so only known site routes are listed."
                : " CMS routes could not be listed when this site was built, so only known site routes are listed.")}
          </p>
          <ul className="builder-existing-list">
            {filtered.slice(0, limit).map((page) => (
              <li key={page.path}>
                <div className="builder-existing-main">
                  <strong>{page.title}</strong>
                  <small>
                    {page.path}
                    {page.destination && ` → ${page.destination}`}
                  </small>
                </div>
                <Pill tone={page.kind === "site" ? "primary" : "grey"}>
                  {kindLabel[page.kind] || "Site page"}
                </Pill>
                <div className="builder-existing-actions">
                  <a
                    href={page.path}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open existing ${page.path}`}
                  >
                    Open page <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                  {onEdit && page.kind === "site" && (
                    <button
                      type="button"
                      onClick={() => onEdit(page.path)}
                      aria-label={`Edit existing ${page.path}`}
                    >
                      Edit text and links
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p className="builder-empty">No pages match your search.</p>
          )}
          {limit < filtered.length && (
            <button type="button" onClick={() => setLimit(limit + 25)}>
              Show more pages
            </button>
          )}
        </Card>
      </div>
    </>
  );
}
