import React, { useEffect, useState } from "react";
import {
  clone,
  newId,
  type SiteDesign,
  type SharedComponent,
  type Workspace,
} from "../../shared/visualBuilder";
import { initialSiteDesign, siteAffectedPages } from "../../shared/builderSite";
import { starterBlocks } from "./starters";
import { storage } from "./storage";
import { downloadText } from "./AssetLibrary";

export default function SitePanel({
  workspace,
  onWorkspace,
  onEdit,
  onBack,
}: {
  workspace: Workspace;
  onWorkspace: (workspace: Workspace) => void;
  onEdit: (id: string) => void;
  onBack: () => void;
}) {
  const [design, setDesign] = useState<SiteDesign>(() =>
    clone(workspace.site?.draft || initialSiteDesign()),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Workspace>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SharedComponent["kind"]>("header");
  const [source, setSource] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenGroup, setTokenGroup] = useState("colors");
  const changed =
    JSON.stringify(design) !== JSON.stringify(workspace.site?.draft);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  async function save(next = design) {
    const site = await storage.saveSite(workspace.site?.version || 0, next);
    const updated = { ...workspace, site };
    onWorkspace(updated);
    setDesign(clone(site.draft));
    return updated;
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(next: SiteDesign) {
    setDesign(next);
    setReview(undefined);
  }
  return (
    <section className="builder-site-panel">
      <div className="builder-section-heading">
        <div>
          <h2>Site design</h2>
          <p>Shared styles, headers, footers and reusable components.</p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (changed) await save();
              onBack();
            })
          }
        >
          Back to pages
        </button>
      </div>
      <p className="builder-local-note">
        Shared changes stay in draft until you publish them. Page assignments
        and instance overrides are controlled in each page’s editor.
      </p>
      <div className="builder-row">
        <span className="builder-hint">
          {changed ? "Unsaved site changes" : "Site draft saved"}
        </span>
        <button
          onClick={() =>
            downloadText(
              "kaizen-site-design-draft.json",
              JSON.stringify(design, null, 2),
            )
          }
        >
          Download site draft
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const fresh = await storage.load();
              onWorkspace(fresh);
              setDesign(clone(fresh.site?.draft || initialSiteDesign()));
              setReview(undefined);
              setMessage("Reloaded the latest saved site design.");
            })
          }
        >
          Discard edits and reload
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await save();
              setMessage("Site design saved as a draft.");
            })
          }
        >
          Save site draft
        </button>
        <button
          disabled={busy}
          className="builder-primary"
          onClick={() =>
            run(async () => {
              const updated = changed ? await save() : workspace;
              const fresh = await storage.load();
              if (fresh.site?.version !== updated.site?.version)
                throw new Error(
                  "Site design changed. Reopen it before publishing.",
                );
              setReview(fresh);
            })
          }
        >
          Review site publication
        </button>
      </div>
      {message && (
        <p role="status" className="builder-site-message">
          {message}
        </p>
      )}
      {review && (
        <div className="builder-site-review">
          <h3>Review publication</h3>
          <p>
            This publishes the current drafts of these pages, including shared
            changes:
          </p>
          <ul>
            {siteAffectedPages(review).map((page) => (
              <li key={page.id}>
                {page.draft.title} · /{page.draft.slug}/
              </li>
            ))}
          </ul>
          {!siteAffectedPages(review).length && (
            <p>
              No pages currently use this design. It will become available for
              page publishing.
            </p>
          )}
          <button
            disabled={busy}
            className="builder-primary"
            onClick={() =>
              run(async () => {
                const result = await storage.publishSite(review);
                onWorkspace(result.workspace);
                setReview(undefined);
                setMessage(result.message);
              })
            }
          >
            Publish site design and {siteAffectedPages(review).length} pages
          </button>
          <button disabled={busy} onClick={() => setReview(undefined)}>
            Cancel
          </button>
        </div>
      )}
      <fieldset disabled={busy} className="builder-site-grid">
        <div className="builder-field">
          <h3>Site styles</h3>
          {(
            [
              ["accent", "Accent colour"],
              ["background", "Page background"],
              ["color", "Text colour"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                aria-label={`Site ${label}`}
                value={design.theme[key]}
                onChange={(event) =>
                  update({
                    ...design,
                    theme: { ...design.theme, [key]: event.target.value },
                  })
                }
              />
            </label>
          ))}
          <label>
            Font family
            <input
              aria-label="Site font family"
              value={design.theme.fontFamily}
              onChange={(event) =>
                update({
                  ...design,
                  theme: { ...design.theme, fontFamily: event.target.value },
                })
              }
            />
          </label>
          <label>
            Corner radius
            <input
              aria-label="Site corner radius"
              type="number"
              min="0"
              max="100"
              value={design.theme.radius}
              onChange={(event) =>
                update({
                  ...design,
                  theme: {
                    ...design.theme,
                    radius: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Uploaded site font
            <select
              aria-label="Uploaded site font"
              value={design.theme.fontUrl || ""}
              onChange={(event) =>
                update({
                  ...design,
                  theme: {
                    ...design.theme,
                    fontUrl: event.target.value || undefined,
                    fontFamily: event.target.value
                      ? "BuilderFont, system-ui, sans-serif"
                      : "Inter, system-ui, sans-serif",
                  },
                })
              }
            >
              <option value="">Use a system font</option>
              {workspace.assets
                .filter((asset) => asset.kind === "font")
                .map((asset) => (
                  <option key={asset.id} value={asset.url}>
                    {asset.pack} / {asset.name}
                  </option>
                ))}
            </select>
          </label>
          <h3>Shared tokens</h3>
          <p className="builder-hint">
            Use named values in a component’s appearance controls. Pages must
            have “Use site styles” enabled.
          </p>
          {Object.entries(design.theme.tokens || {}).map(([group, values]) => (
            <details key={group} open>
              <summary>{group}</summary>
              {Object.entries(values).map(([key, value]) => (
                <label key={key}>
                  {key}
                  <input
                    aria-label={`Token ${group} ${key}`}
                    type={
                      ["colors", "fontFamily"].includes(group)
                        ? "text"
                        : "number"
                    }
                    step={group === "lineHeight" ? "0.05" : "1"}
                    value={value}
                    onChange={(event) =>
                      update({
                        ...design,
                        theme: {
                          ...design.theme,
                          tokens: {
                            ...design.theme.tokens,
                            [group]: {
                              ...values,
                              [key]: ["colors", "fontFamily"].includes(group)
                                ? event.target.value
                                : Number(event.target.value),
                            },
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
            </details>
          ))}
          <label>
            New token group
            <select
              value={tokenGroup}
              onChange={(event) => setTokenGroup(event.target.value)}
            >
              {[
                "colors",
                "spacing",
                "fontFamily",
                "fontSize",
                "lineHeight",
              ].map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            New token name
            <input
              placeholder="e.g. large"
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
            />
          </label>
          <button
            onClick={() => {
              if (!/^[a-z][\w-]{0,40}$/.test(tokenName)) {
                setMessage(
                  "Use a token name starting with a lower-case letter, followed by letters, numbers or hyphens.",
                );
                return;
              }
              if (
                design.theme.tokens?.[tokenGroup]?.[tokenName] !== undefined
              ) {
                setMessage("That token already exists.");
                return;
              }
              update({
                ...design,
                theme: {
                  ...design.theme,
                  tokens: {
                    ...design.theme.tokens,
                    [tokenGroup]: {
                      ...design.theme.tokens?.[tokenGroup],
                      [tokenName]:
                        tokenGroup === "colors"
                          ? "#182421"
                          : tokenGroup === "fontFamily"
                            ? "system-ui, sans-serif"
                            : tokenGroup === "lineHeight"
                              ? 1.5
                              : 24,
                    },
                  },
                },
              });
              setTokenName("");
            }}
          >
            Add token
          </button>
        </div>
        <div className="builder-field">
          <h3>Shared components</h3>
          <p className="builder-hint">
            Edit a definition once to update linked instances. Saved section
            copies remain independent until you create a shared component from
            them.
          </p>
          {design.components.map((component) => (
            <div className="builder-site-component" key={component.id}>
              <strong>{component.name}</strong>
              <small>{component.kind}</small>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (changed) await save();
                    onEdit(component.id);
                  })
                }
              >
                Edit {component.name}
              </button>
            </div>
          ))}
          <label>
            Component name
            <input
              aria-label="Shared component name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            Used as
            <select
              aria-label="Shared component kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as SharedComponent["kind"])
              }
            >
              <option value="header">Header</option>
              <option value="footer">Footer</option>
              <option value="section">Section</option>
            </select>
          </label>
          <label>
            Start from
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Starter for this type</option>
              {workspace.saved
                .filter((item) => item.kind === "section")
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={busy || !name.trim()}
            onClick={() =>
              run(async () => {
                const component: SharedComponent = {
                  id: newId(),
                  name: name.trim(),
                  kind,
                  blocks: clone(
                    workspace.saved.find((item) => item.id === source)
                      ?.blocks || [
                      kind === "header"
                        ? starterBlocks.Menu()
                        : kind === "footer"
                          ? starterBlocks.Footer()
                          : starterBlocks.CallToAction(),
                    ],
                  ),
                };
                const next = {
                  ...design,
                  components: [...design.components, component],
                };
                await save(next);
                setName("");
                onEdit(component.id);
              })
            }
          >
            Create shared component
          </button>
          <details>
            <summary>Site design revisions</summary>
            {workspace.site?.revisions
              .slice()
              .reverse()
              .map((revision) => (
                <div className="builder-revision" key={revision.id}>
                  <span>{new Date(revision.createdAt).toLocaleString()}</span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      update(clone(revision.design));
                      setMessage(
                        "Site revision restored into the form. Save it as a draft, then review publication.",
                      );
                    }}
                  >
                    Restore site draft
                  </button>
                </div>
              ))}
          </details>
          <div className="builder-local-note">
            <strong>Existing Kaizen pages</strong>
            <p>
              Astro and Sanity pages keep their current editors. This builder
              owns newly created URLs and cannot automatically edit existing
              page source or uploaded code.
            </p>
          </div>
        </div>
      </fieldset>
    </section>
  );
}
