import React, { useMemo, useState } from "react";
import type { PageInventory } from "../../shared/builderPageInventory";

export default function ExistingPages({
  inventory,
  open = false,
}: {
  inventory: PageInventory;
  open?: boolean;
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
    <details
      id="builder-existing-pages"
      className="builder-existing-pages"
      open={open}
    >
      <summary>Existing site pages · managed outside this builder</summary>
      <p>
        The pages above are editable here. Existing site layouts use their
        original templates. Creating a builder page does not replace them or
        make their source code editable.
      </p>
      <p>
        Use the site CMS for blog articles and CMS-managed content. Changes to
        existing page layouts need developer integration. To rebuild a page
        visually, create it at a new URL and review the route change separately.
      </p>
      <div className="builder-row">
        <a href={inventory.studioUrl} target="_blank" rel="noreferrer">
          Open site CMS ↗
        </a>
        <span className="builder-hint">
          Page list recorded{" "}
          {new Date(inventory.generatedAt).toLocaleDateString()}; it updates
          when this site is rebuilt.
        </span>
      </div>
      {inventory.cmsStatus !== "available" && (
        <p className="builder-hint">
          {inventory.cmsStatus === "not-configured"
            ? "The CMS connection is not configured in this build. This list contains the known site routes; additional CMS pages may exist."
            : "CMS routes could not be listed when this site was built. The known site routes are shown; additional CMS pages may exist."}
        </p>
      )}
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
      <p>
        {filtered.length} matching routes. Individual blog articles are managed
        in the CMS.
      </p>
      <ul className="builder-existing-list">
        {filtered.slice(0, limit).map((page) => (
          <li key={page.path}>
            <div>
              <strong>{page.title}</strong>
              <small>
                {page.path}
                {page.destination && ` → ${page.destination}`}
              </small>
            </div>
            <span className="builder-pill">
              {page.kind === "cms"
                ? "CMS content"
                : page.kind === "redirect"
                  ? "Site redirect"
                  : "Existing site layout"}
            </span>
            <a
              href={page.path}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open existing ${page.path}`}
            >
              Open page ↗
            </a>
          </li>
        ))}
      </ul>
      {!filtered.length && <p>No matching routes in this build.</p>}
      {limit < filtered.length && (
        <button onClick={() => setLimit(limit + 25)}>
          Show more existing pages
        </button>
      )}
    </details>
  );
}
