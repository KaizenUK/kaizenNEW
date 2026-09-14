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
import { Card, Head, Notice, Pill } from "./shell";
import { ProjectName, useProjectCapabilities } from "./activeProject";

/* Shared design for the whole site: styles, tokens, headers/footers and reusable components. */

const hex = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
const kindLabels: Record<SharedComponent["kind"], string> = {
  header: "Header",
  footer: "Footer",
  section: "Section",
};

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
  // One starting design so a fresh workspace does not look "unsaved" before anything changes.
  const capabilities = useProjectCapabilities();
  const [initial] = useState<SiteDesign>(
    () => workspace.site?.draft || initialSiteDesign(),
  );
  const [design, setDesign] = useState<SiteDesign>(() => clone(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Workspace>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SharedComponent["kind"]>("header");
  const [source, setSource] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenGroup, setTokenGroup] = useState("colors");
  const changed =
    JSON.stringify(design) !== JSON.stringify(workspace.site?.draft || initial);
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
  const theme = (patch: Partial<SiteDesign["theme"]>) =>
    update({ ...design, theme: { ...design.theme, ...patch } });
  const affected = review ? siteAffectedPages(review) : [];
  return (
    <>
      <Head
        info={<ProjectName />}
        title="Site design"
        help="site"
        status={
          <Pill tone={changed ? "orange" : "green"}>
            {changed ? "Unsaved changes" : "Draft saved"}
          </Pill>
        }
      >
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const fresh = await storage.load();
              onWorkspace(fresh);
              setDesign(clone(fresh.site?.draft || initial));
              setReview(undefined);
              setMessage("Reloaded the latest saved site design.");
            })
          }
        >
          Discard edits and reload
        </button>
        <button
          type="button"
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
          type="button"
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
        <button
          type="button"
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
      </Head>
      <div className="builder-page-body builder-site-panel">
        {message && (
          <Notice tone="success" className="builder-site-message">
            {message}
          </Notice>
        )}
        {review && (
          <Card
            className="builder-review builder-site-review"
            title="Review publication"
            description="Publishing the site design also publishes the current drafts of every page that uses it, including any other pending edits on those pages."
          >
            {affected.length ? (
              <ul className="builder-review-list">
                {affected.map((page) => (
                  <li key={page.id}>
                    {page.draft.title} · /{page.draft.slug}/
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No pages use this design yet. It becomes available for page
                publishing.
              </p>
            )}
            <div className="builder-row builder-actions">
              <button
                type="button"
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
                Publish site design and {affected.length} pages
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReview(undefined)}
              >
                Cancel
              </button>
            </div>
          </Card>
        )}
        <fieldset
          disabled={busy}
          className="builder-fieldset builder-site-grid"
        >
          <Card title="Site styles">
            <div className="builder-form">
              {(
                [
                  ["accent", "Accent colour"],
                  ["background", "Page background"],
                  ["color", "Text colour"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <div className="builder-color">
                    <input
                      aria-label={`Site ${label} swatch`}
                      type="color"
                      value={hex(design.theme[key])}
                      onChange={(event) =>
                        theme({ [key]: event.target.value } as Partial<
                          SiteDesign["theme"]
                        >)
                      }
                    />
                    <input
                      aria-label={`Site ${label}`}
                      value={design.theme[key]}
                      onChange={(event) =>
                        theme({ [key]: event.target.value } as Partial<
                          SiteDesign["theme"]
                        >)
                      }
                    />
                  </div>
                </label>
              ))}
              <label>
                Font family
                <input
                  aria-label="Site font family"
                  value={design.theme.fontFamily}
                  onChange={(event) =>
                    theme({ fontFamily: event.target.value })
                  }
                />
              </label>
              <label>
                Uploaded site font
                <select
                  aria-label="Uploaded site font"
                  value={design.theme.fontUrl || ""}
                  onChange={(event) =>
                    theme({
                      fontUrl: event.target.value || undefined,
                      fontFamily: event.target.value
                        ? "BuilderFont, system-ui, sans-serif"
                        : "Inter, system-ui, sans-serif",
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

              <label>
                Corner radius
                <input
                  aria-label="Site corner radius"
                  type="number"
                  min="0"
                  max="100"
                  value={design.theme.radius}
                  onChange={(event) =>
                    theme({ radius: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </Card>
          <Card title="Shared components">
            {design.components.length > 0 && (
              <ul className="builder-component-list">
                {design.components.map((component) => (
                  <li className="builder-site-component" key={component.id}>
                    <strong>{component.name}</strong>
                    <Pill>{kindLabels[component.kind] || component.kind}</Pill>
                    <button
                      type="button"
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
                  </li>
                ))}
              </ul>
            )}
            <div className="builder-form">
              <h3>New shared component</h3>
              <label>
                Component name
                <input
                  aria-label="Shared component name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                />
              </label>
              <div className="builder-control-grid">
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
              </div>
              <div className="builder-row builder-actions">
                <button
                  type="button"
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
              </div>
            </div>
          </Card>
          <Card title="Design tokens">
            <div className="builder-form">
              {Object.entries(design.theme.tokens || {}).map(
                ([group, values]) => (
                  <details key={group} open className="builder-token-group">
                    <summary>{group}</summary>
                    <div className="builder-control-grid">
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
                                      [key]: ["colors", "fontFamily"].includes(
                                        group,
                                      )
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
                    </div>
                  </details>
                ),
              )}
              <h3>Add a token</h3>
              <div className="builder-control-grid">
                <label>
                  Group
                  <select
                    aria-label="New token group"
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
                  Name
                  <input
                    aria-label="New token name"
                    placeholder="e.g. large"
                    value={tokenName}
                    onChange={(event) => setTokenName(event.target.value)}
                  />
                </label>
              </div>
              <div className="builder-row builder-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (!/^[a-z][\w-]{0,40}$/.test(tokenName)) {
                      setMessage(
                        "Use a token name starting with a lower-case letter, followed by letters, numbers or hyphens.",
                      );
                      return;
                    }
                    if (
                      design.theme.tokens?.[tokenGroup]?.[tokenName] !==
                      undefined
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
            </div>
          </Card>
          <Card title="Version history">
            {workspace.site?.revisions.length ? (
              <div className="builder-revision-list">
                {workspace.site.revisions
                  .slice()
                  .reverse()
                  .map((revision) => (
                    <div className="builder-revision" key={revision.id}>
                      <span>
                        {new Date(revision.createdAt).toLocaleString()}
                      </span>
                      <button
                        type="button"
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
              </div>
            ) : (
              <p className="builder-empty">No saved versions yet.</p>
            )}
            <div className="builder-row builder-actions">
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    "kaizen-site-design-draft.json",
                    JSON.stringify(design, null, 2),
                  )
                }
              >
                Download site draft (JSON)
              </button>
            </div>
            {capabilities.hasInventory && (
              <p className="builder-hint">
                Open existing website pages from Pages to edit supported text,
                links and images. Site design controls apply to builder pages.
              </p>
            )}
          </Card>
        </fieldset>
      </div>
    </>
  );
}
