import React, { useEffect, useState, useSyncExternalStore } from "react";
import type { RepositoryInspection } from "../../scripts/builder-repository";
import type { PageInventory } from "../../shared/builderPageInventory";
import { companionConnection } from "./companionConnection";
import { storage, localMode } from "./storage";
import { activeProjectId } from "./projectStorage";
import { Card, Notice, Pill } from "./shell";

export type SitePage = {
  root: string;
  route: string;
  title: string;
  path: string;
};
export const siteRoutePath = (file: string) =>
  "/" +
  file
    .replace(/^src\/pages\//, "")
    .replace(/\.(astro|tsx|jsx|mdx?)$/, "")
    .replace(/(^|\/)index$/, "")
    .replace(/\/$/, "") +
  (file === "src/pages/index.astro" ? "" : "/");
const cache = new Map<string, RepositoryInspection>();
export default function SitePages({
  inventory,
  onOpen,
  onConnect,
  onOpenBuilder,
}: {
  onOpenBuilder: (path: string) => boolean;
  inventory?: PageInventory;
  onOpen: (page: SitePage) => void;
  onConnect: () => void;
}) {
  const connection = useSyncExternalStore(
    companionConnection.subscribe,
    companionConnection.snapshot,
    companionConnection.snapshot,
  );
  const [model, setModel] = useState<RepositoryInspection>(),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!localMode && connection.status !== "connected") return;
    let live = true;
    const root =
      connection.root ||
      localStorage.getItem(`kaizen-native-repository:${activeProjectId}`);
    const key = activeProjectId + ":" + (root || "current");
    if (cache.has(key)) setModel(cache.get(key));
    setError("");
    void storage
      .repository(
        root
          ? { action: "repository-inspect", root }
          : { action: "repository-inspect-current" },
      )
      .then((value) => {
        cache.set(key, value);
        if (live) setModel(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [connection.status, connection.root, connection.expiresAt, attempt]);
  const rows =
    model?.routes
      .filter(
        (r) =>
          /\.(astro|tsx|jsx)$/.test(r.file) &&
          !r.file.startsWith("src/pages/builder/"),
      )
      .map((r) => ({
        ...r,
        path: siteRoutePath(r.file),
        title:
          r.title ||
          inventory?.pages.find((p) => p.path === siteRoutePath(r.file))
            ?.title ||
          siteRoutePath(r.file),
      }))
      .filter((r) =>
        `${r.title} ${r.path}`.toLowerCase().includes(query.toLowerCase()),
      ) || [];
  return (
    <Card title="Pages from the website's code" ariaLabel="Website pages">
      {!localMode && connection.status !== "connected" && (
        <p>
          Connect the helper to open pages from a website folder.{" "}
          <button type="button" onClick={onConnect}>
            Connect helper
          </button>
        </p>
      )}
      {model && (
        <>
          <div className="builder-row">
            <label>
              Find an existing page
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Refresh website pages
            </button>
          </div>
          <ul className="builder-existing-list">
            {rows.map((row) => (
              <li key={row.file}>
                <div className="builder-existing-main">
                  <strong>{row.title}</strong>
                  <small>{row.path}</small>
                </div>
                <Pill
                  tone={row.ownership === "code-managed" ? "primary" : "grey"}
                >
                  {row.ownership === "builder-editable"
                    ? "Builder page"
                    : row.ownership === "code-managed"
                      ? "Managed in code"
                      : "Needs a developer"}
                </Pill>
                <button
                  type="button"
                  aria-label={`Edit existing ${row.path}`}
                  onClick={async () => {
                    if (row.ownership === "builder-editable") {
                      if (onOpenBuilder(row.path)) return;
                      try {
                        const project = await storage.repository({
                          action: "repository-open",
                          root: model.root,
                        });
                        const url = `/builder/?local=1&project=${encodeURIComponent(project.id)}`;
                        location.assign(
                          connection.origin
                            ? new URL(url, connection.origin).href
                            : url,
                        );
                      } catch (e) {
                        setError(e.message);
                      }
                      return;
                    }
                    onOpen({
                      root: model.root,
                      route: row.file,
                      title: row.title,
                      path: row.path,
                    });
                  }}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {!rows.length && <p>No website pages found.</p>}
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
