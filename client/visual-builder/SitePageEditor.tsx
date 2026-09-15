import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Sun,
  Moon,
  X,
} from "lucide-react";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import { sourceAssetPath } from "../../shared/builderSourceEditing";
import type { RepositoryPlan } from "../../scripts/builder-repository";
import type { PageInventory } from "../../shared/builderPageInventory";
import type { Workspace } from "../../shared/visualBuilder";
import { storage, localMode } from "./storage";
import {
  Brand,
  IconButton,
  Notice,
  Segmented,
  type BuilderTheme,
} from "./shell";
import { ProjectIdentity } from "./ProjectsView";
import { companionConnection } from "./companionConnection";
import { useSourceEditingDraft } from "./useSourceEditingDraft";
import { useSourceCanvas, type SourceImagePreview } from "./useSourceCanvas";
import { useSiteBuild } from "./useSiteBuild";
import { useSourceSelection } from "./useSourceSelection";
import type { SitePage } from "./SitePages";
import type { RepositoryGitStatus } from "../../scripts/builder-repository-git";
import AssetLibrary from "./AssetLibrary";
import { fieldKindLabel, fieldSourceLabel, groupTitle } from "./sourceLabels";

export default function SitePageEditor({
  page,
  workspace,
  onWorkspace,
  onBack,
  theme,
  onToggleTheme,
  inventory,
}: {
  page: SitePage;
  workspace: Workspace;
  onWorkspace: (workspace: Workspace) => void;
  onBack: () => void;
  theme: BuilderTheme;
  onToggleTheme: () => void;
  inventory?: PageInventory;
}) {
  const [inspection, setInspection] = useState<SourceInspection>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<RepositoryPlan>(),
    [busy, setBusy] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false);
  const [width, setWidth] = useState(1280),
    [tab, setTab] = useState("outline"),
    [rightTab, setRightTab] = useState("selected"),
    [mobilePanel, setMobilePanel] = useState("canvas");
  const [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [tick, setTick] = useState(Date.now());
  const [git, setGit] = useState<RepositoryGitStatus>(),
    [appliedPlan, setAppliedPlan] = useState<string>(),
    [commitMessage, setCommitMessage] = useState(`Update text on ${page.path}`);
  const [imagePreviews, setImagePreviews] = useState<
    Record<string, SourceImagePreview>
  >({});
  const connection = useSyncExternalStore(
    companionConnection.subscribe,
    companionConnection.snapshot,
    companionConnection.snapshot,
  );
  const draft = useSourceEditingDraft(inspection);
  const build = useSiteBuild(inspection);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const canvas = useSourceCanvas(
    inspection,
    frameRef,
    draft,
    build.frame,
    imagePreviews,
  );
  const popup = useSourceSelection(inspection);
  const surface = useRef<HTMLDivElement>(null),
    [available, setAvailable] = useState(900),
    [availableHeight, setAvailableHeight] = useState(800);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected =
    inspection?.fields.filter((f) => canvas.ids.includes(f.id)) || [];
  const changed =
    Object.keys(draft.values).length + Object.keys(draft.orders).length;
  const locked = busy || !draft.ready || Boolean(draft.stale);
  const disconnected = !localMode && connection.status !== "connected";
  const expiring =
    connection.expiresAt && connection.expiresAt - tick < 10 * 60 * 1000;
  const filtered =
    inspection?.fields.filter((f) =>
      `${draft.values[f.id] ?? f.value} ${f.label} ${f.file}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  const virtual = filtered.length > 150,
    first = virtual ? Math.max(0, Math.floor(offset / 64) - 3) : 0;
  const visible = virtual ? filtered.slice(first, first + 18) : filtered;
  const zoom = Math.min(1, available / width);
  useEffect(() => {
    if (query.trim() && filtered.length === 1) {
      canvas.select(filtered[0].id);
      setRightTab("selected");
    }
  }, [query, inspection, draft.ready]);
  useEffect(() => {
    let live = true;
    void storage
      .repository({
        action: "repository-source-inspect",
        root: page.root,
        route: page.route,
      })
      .then((value) => {
        if (live) setInspection(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [page.root, page.route]);
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let live = true;
    void storage
      .repository({ action: "repository-git-status", root: page.root })
      .then((value) => {
        if (live) setGit(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [page.root, inspection, appliedPlan]);
  useEffect(() => {
    if (connection.status === "connected" && draft.ready && draft.error)
      void draft.retry().catch(() => {});
  }, [connection.status, connection.expiresAt]);
  // After "Apply", the applied notice waits for the rebuild it triggers and then settles.
  const rebuild = useRef<"idle" | "waiting" | "building">("idle");
  useEffect(() => {
    if (rebuild.current === "waiting" && build.busy)
      rebuild.current = "building";
    else if (rebuild.current === "building" && !build.busy) {
      rebuild.current = "idle";
      if (build.job?.status === "succeeded")
        setNotice("Changes applied to the folder. The preview shows them now.");
      else if (build.error)
        setNotice(
          "Changes applied to the folder, but the preview did not rebuild.",
        );
    }
  }, [build.busy, build.job?.status, build.error]);
  useEffect(() => {
    let live = true;
    void Promise.all(
      draft.assets.map(async (replacement) => {
        const asset = workspace.assets.find(
          (a) => a.id === replacement.assetId,
        );
        if (!asset)
          throw new Error(
            "A replacement image is missing from Assets. Choose it again.",
          );
        const response = await fetch(await storage.download(asset));
        if (!response.ok) throw new Error("The image could not be loaded.");
        const blob = await response.blob();
        if (blob.size > 32 * 1024 * 1024)
          throw new Error("Choose an image smaller than 32 MB.");
        const mime = asset.mime || blob.type;
        if (!/^image\/(png|jpeg|webp|avif|gif|svg\+xml)$/i.test(mime))
          throw new Error("Choose a PNG, JPEG, WebP, AVIF, GIF or SVG image.");
        return [
          replacement.fieldId,
          {
            assetId: asset.id,
            key: `${asset.id}:${asset.hash}`,
            blob: blob.slice(0, blob.size, mime),
          },
        ] as const;
      }),
    )
      .then((entries) => {
        if (live) setImagePreviews(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [draft.assets, workspace.assets]);
  useEffect(() => {
    if (!surface.current) return;
    let animation = 0;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(() => {
        setAvailable(Math.max(200, entries[0].contentRect.width));
        setAvailableHeight(Math.max(320, entries[0].contentRect.height));
      });
    });
    observer.observe(surface.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animation);
    };
  }, []);
  async function review() {
    setBusy(true);
    setError("");
    try {
      await draft.flush();
      const media = await Promise.all(
        draft.assets.map(async (replacement) => {
          const asset = workspace.assets.find(
            (a) => a.id === replacement.assetId,
          );
          if (!asset)
            throw new Error("Choose the missing image again from Assets.");
          const response = await fetch(await storage.download(asset));
          if (!response.ok) throw new Error("The image could not be read.");
          const blob = await response.blob();
          if (blob.size > 32 * 1024 * 1024)
            throw new Error("Choose an image smaller than 32 MB.");
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () =>
              reject(new Error("The image could not be read."));
            reader.readAsDataURL(blob);
          });
          return { assetId: asset.id, name: asset.name, base64 };
        }),
      );
      const next = await storage.repository({
        action: "repository-source-prepare",
        edits: {
          inspection,
          values: draft.values,
          orders: draft.orders,
          ...(draft.assets.length ? { assets: draft.assets } : {}),
        },
        media,
        draftVersion: draft.version.current,
      });
      setPlan(next);
      setReviewOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const result = await storage.repository({
        action: "repository-apply",
        planId: plan.id,
      });
      setAppliedPlan(result.planId);
      setPlan(undefined);
      setReviewOpen(false);
      rebuild.current = "waiting";
      setNotice("Changes applied to the folder. Building the updated preview…");
      const next = await storage.repository({
        action: "repository-source-inspect",
        root: page.root,
        route: page.route,
      });
      setInspection(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`builder-app builder-site-editor builder-theme-${theme}`}
      data-theme={theme}
      role="region"
      aria-label="Existing page content editor"
    >
      <header className="builder-editor-header">
        <div className="builder-editor-left">
          <IconButton
            label="Back to pages"
            icon={<ArrowLeft size={18} />}
            onClick={() => {
              if (!inspection || (!draft.ready && !changed)) {
                onBack();
                return;
              }
              void draft
                .flush()
                .then(onBack)
                .catch((e) => setError(e.message));
            }}
          />
          <Brand compact />
          <ProjectIdentity variant="header" />
          <strong className="builder-header-page">{page.title}</strong>
          <span
            className="builder-save-status"
            role="status"
            aria-label="Source editing draft"
          >
            {draft.status.startsWith("Edits saved")
              ? "Edits saved on this computer."
              : draft.status || "Reading the page…"}
          </span>
        </div>
        <div className="builder-editor-center builder-canvas-toolbar">
          <Segmented
            ariaLabel="Preview width"
            value={String(width)}
            onChange={(value) => setWidth(Number(value))}
            items={[
              {
                id: "1280",
                icon: <Monitor size={16} />,
                ariaLabel: "Desktop preview",
              },
              {
                id: "768",
                icon: <Tablet size={16} />,
                ariaLabel: "Tablet preview",
              },
              {
                id: "390",
                icon: <Smartphone size={16} />,
                ariaLabel: "Mobile preview",
              },
            ]}
          />
        </div>
        <div className="builder-editor-right">
          <IconButton
            label="Undo"
            icon={<Undo2 size={18} />}
            disabled={!canvas.canUndo || locked}
            onClick={canvas.undo}
          />
          <IconButton
            label="Redo"
            icon={<Redo2 size={18} />}
            disabled={!canvas.canRedo || locked}
            onClick={canvas.redo}
          />
          <IconButton
            label="Toggle editor theme"
            icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            onClick={onToggleTheme}
          />
          <button
            type="button"
            className="builder-primary"
            disabled={locked || !changed || disconnected}
            onClick={() => void review()}
          >
            Review my changes
          </button>
        </div>
      </header>
      <div className="builder-site-notices">
        {disconnected && (
          <Notice
            tone="error"
            action={
              <button
                type="button"
                onClick={() => {
                  try {
                    companionConnection.reconnect();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Reconnect
              </button>
            }
          >
            Not connected. Keep editing here, or download your unapplied edits.
          </Notice>
        )}
        {!disconnected && expiring && (
          <Notice
            action={
              <button
                type="button"
                onClick={() => companionConnection.reconnect()}
              >
                Keep connected
              </button>
            }
          >
            Your helper connection ends in less than ten minutes.
          </Notice>
        )}
        {(error || draft.error) && (
          <Notice
            tone="error"
            action={
              <button
                type="button"
                onClick={() => void draft.retry().catch(() => {})}
              >
                Retry saving edits
              </button>
            }
          >
            {error || draft.error}
          </Notice>
        )}
        {notice && (
          <Notice
            tone={
              /applied|committed|replaced|saved/i.test(notice)
                ? "success"
                : "info"
            }
            action={
              <button type="button" onClick={() => setNotice("")}>
                Dismiss
              </button>
            }
          >
            {notice}
          </Notice>
        )}
        {draft.stale && (
          <Notice tone="error">
            The website's files changed. Your earlier edits are kept.{" "}
            <button type="button" onClick={draft.download}>
              Download my unapplied edits
            </button>
            <details>
              <summary>Recover saved changes</summary>
              <pre>{JSON.stringify(draft.stale.values, null, 2)}</pre>
            </details>
            <button
              type="button"
              onClick={() =>
                void draft.discardStale().catch((e) => setError(e.message))
              }
            >
              Discard saved edits
            </button>
          </Notice>
        )}
      </div>
      <nav className="builder-site-mobile-tabs" aria-label="Editor panels">
        {["outline", "canvas", "selected"].map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={mobilePanel === id}
            onClick={() => setMobilePanel(id)}
          >
            {id === "canvas"
              ? "Page"
              : id === "outline"
                ? "Outline"
                : "Selected"}
          </button>
        ))}
      </nav>
      <div className="builder-site-layout" data-panel={mobilePanel}>
        <aside className="builder-site-outline">
          <Segmented
            className="builder-site-segmented"
            ariaLabel="Sidebar panels"
            value={tab}
            onChange={setTab}
            items={[
              { id: "outline", label: "Outline" },
              { id: "assets", label: "Assets" },
              { id: "sections", label: "Sections" },
            ]}
          />
          {tab === "outline" && (
            <>
              <label className="builder-site-search">
                <input
                  aria-label="Find page content"
                  placeholder="Find page content"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOffset(0);
                    const needle = e.target.value.trim().toLowerCase();
                    const matches = inspection?.fields.filter((f) =>
                      `${draft.values[f.id] ?? f.value} ${f.label} ${f.file}`
                        .toLowerCase()
                        .includes(needle),
                    );
                    if (needle && matches?.length === 1) {
                      canvas.select(matches[0].id);
                      setRightTab("selected");
                    }
                  }}
                />
              </label>
              <div
                className="builder-site-field-list"
                onScroll={(e) => setOffset(e.currentTarget.scrollTop)}
              >
                <div
                  style={
                    virtual
                      ? { height: filtered.length * 64, position: "relative" }
                      : undefined
                  }
                >
                  {visible.map((field, index) => (
                    <button
                      type="button"
                      key={field.id}
                      className={`builder-site-field${draft.values[field.id] !== undefined ? " is-edited" : ""}`}
                      data-source-field={field.id}
                      style={
                        virtual
                          ? {
                              position: "absolute",
                              top: (first + index) * 64,
                              height: 64,
                              left: 0,
                              right: 0,
                            }
                          : undefined
                      }
                      aria-pressed={canvas.ids.includes(field.id)}
                      onClick={(e) => {
                        returnFocus.current = e.currentTarget;
                        canvas.select(field.id);
                        setRightTab("selected");
                        setMobilePanel("selected");
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLElement>(
                              ".builder-site-field-editor textarea,.builder-site-field-editor input",
                            )
                            ?.focus(),
                        );
                      }}
                    >
                      <small>
                        {fieldKindLabel(field)}
                        {draft.values[field.id] !== undefined
                          ? " · Edited"
                          : ""}
                      </small>
                      <span>{draft.values[field.id] ?? field.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === "sections" && (
            <div className="builder-site-panel-content">
              {inspection?.groups.map((group) => (
                <section key={group.id}>
                  <h3>{groupTitle(group)}</h3>
                  {(draft.orders[group.id] || group.items.map((i) => i.id)).map(
                    (id, index, array) => (
                      <div className="builder-site-section" key={id}>
                        <span>
                          {group.items.find((i) => i.id === id)!.label}
                        </span>
                        {[-1, 1].map((by) => (
                          <button
                            type="button"
                            key={by}
                            disabled={
                              locked ||
                              index + by < 0 ||
                              index + by >= array.length
                            }
                            aria-label={`Move ${group.items.find((i) => i.id === id)!.label} ${by < 0 ? "up" : "down"}`}
                            onClick={() => {
                              const order = [...array];
                              [order[index], order[index + by]] = [
                                order[index + by],
                                order[index],
                              ];
                              canvas.order(group.id, order);
                            }}
                          >
                            {by < 0 ? "↑" : "↓"}
                          </button>
                        ))}
                      </div>
                    ),
                  )}
                </section>
              ))}
              {!inspection?.groups.length && (
                <p className="builder-hint">
                  Nothing on this page can be reordered safely.
                </p>
              )}
            </div>
          )}
          {tab === "assets" && (
            <AssetLibrary
              compact
              assets={workspace.assets}
              workspace={workspace}
              prepareWorkspace={() => storage.load()}
              onReplacementComplete={onWorkspace}
              onAsset={(asset) =>
                onWorkspace({
                  ...workspace,
                  assets: [asset, ...workspace.assets],
                })
              }
              onAssets={(assets) =>
                onWorkspace({
                  ...workspace,
                  assets: [...assets, ...workspace.assets],
                })
              }
              onUse={(asset) => {
                const field = selected.find(
                  (f) =>
                    f.kind === "image" && !/srcset/i.test(f.attribute || ""),
                );
                if (!field) {
                  setNotice("Select an image on the page to replace it.");
                  return;
                }
                try {
                  canvas.replaceAsset(
                    field.id,
                    asset.id,
                    sourceAssetPath(field.value, asset.name, asset.hash),
                  );
                  setNotice(
                    "Image replaced in your draft. Review it before applying.",
                  );
                  setMobilePanel("canvas");
                } catch (e) {
                  setError(e.message);
                }
              }}
              onUseBlock={() =>
                setNotice(
                  "Sections can be added to builder pages. This page keeps its original source.",
                )
              }
              notify={setNotice}
            />
          )}
        </aside>
        <main className="builder-site-canvas" ref={surface}>
          {(!build.frame || build.plan || build.busy || build.error) && (
            <div className="builder-site-build">
              <h2>
                {build.busy
                  ? build.job?.status === "building"
                    ? "Building the preview…"
                    : "Checking the preview…"
                  : "Build a preview to edit on the page"}
              </h2>
              {build.plan && (
                <>
                  <p>
                    <code>{build.plan.command}</code>
                  </p>
                  <dl>
                    {build.plan.scripts.map((script) => (
                      <React.Fragment key={script.name}>
                        <dt>{script.name}</dt>
                        <dd>
                          <code>{script.command}</code>
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                  <p className="builder-hint">
                    Runs the website's own build on this computer so you can
                    edit on the page. Nothing goes live.
                  </p>
                  <button
                    type="button"
                    className="builder-primary"
                    disabled={build.busy || disconnected}
                    onClick={() => void build.build()}
                  >
                    Build
                  </button>
                </>
              )}
              {build.job?.status === "building" && (
                <p role="status">
                  {Math.max(
                    0,
                    Math.floor((tick - Date.parse(build.job.startedAt)) / 1000),
                  )}{" "}
                  seconds
                </p>
              )}
              {build.error && (
                <>
                  <Notice tone="error">{build.error}</Notice>
                  <button type="button" onClick={build.retry}>
                    Try building again
                  </button>
                </>
              )}
              {build.job && (
                <details>
                  <summary>Build log</summary>
                  <pre>{build.job.log || "Waiting for output…"}</pre>
                </details>
              )}
            </div>
          )}
          {build.job?.status === "succeeded" && !build.busy && (
            <span className="builder-site-live-status" role="status">
              Preview built.
            </span>
          )}
          {build.frame && (
            <div
              className="builder-site-frame-wrap"
              style={{
                width: width * zoom,
                height: Math.max(420, availableHeight - 48),
              }}
            >
              <iframe
                ref={frameRef}
                title="Website canvas"
                src={build.frame.url}
                sandbox="allow-scripts allow-same-origin"
                allow="local-network-access; local-network; loopback-network"
                referrerPolicy="no-referrer"
                onLoad={canvas.hello}
                style={{
                  width,
                  height: Math.max(420, availableHeight - 48) / zoom,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}
          {canvas.error && (
            <Notice tone="error">
              {canvas.error}{" "}
              <button type="button" onClick={build.retry}>
                Retry preview
              </button>
              <button type="button" onClick={() => void popup.open()}>
                Open the preview in a window
              </button>
              {!localMode && connection.origin && (
                <a
                  href={`${connection.origin}/builder/?local=1&view=repository`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in the local builder
                </a>
              )}
            </Notice>
          )}
        </main>
        <aside className="builder-site-selected">
          <Segmented
            className="builder-site-segmented"
            ariaLabel="Inspector panels"
            value={rightTab}
            onChange={setRightTab}
            items={[
              { id: "selected", label: "Selected" },
              { id: "page", label: "Page" },
            ]}
          />
          <div className="builder-site-panel-content">
            {rightTab === "selected" && (
              <>
                {canvas.reason && (
                  <p>
                    {inventory?.pages.some(
                      (p) => p.path === page.path && p.kind === "cms",
                    )
                      ? "Managed elsewhere: this page uses Sanity content. Edit it in the CMS."
                      : canvas.reason}
                  </p>
                )}
                {canvas.registration && (
                  <>
                    <h3>{canvas.registration.name}</h3>
                    <p className="builder-hint">
                      Registered component. Its supported content and existing
                      design values are editable here.
                    </p>
                  </>
                )}
                {!selected.length && !canvas.reason && (
                  <p>
                    Click words, a link or an image on the page. Double-click
                    words to type directly.
                  </p>
                )}
                {selected.map((field) => (
                  <section key={field.id} className="builder-site-field-editor">
                    <h3>{fieldKindLabel(field)}</h3>
                    <label>
                      {field.design
                        ? `${field.design.property} · ${field.design.device}`
                        : field.kind === "link"
                          ? "Current address"
                          : field.kind === "image"
                            ? "Image file"
                            : /^alt$/i.test(field.label)
                              ? "Current description"
                              : "Current text"}
                      {field.design ? (
                        <input
                          aria-label={`${field.file} ${field.label} line ${field.line}`}
                          type={
                            field.design.min !== undefined ? "number" : "text"
                          }
                          min={field.design.min}
                          max={field.design.max}
                          step="any"
                          value={draft.values[field.id] ?? field.value}
                          disabled={locked}
                          onChange={(e) => {
                            setPlan(undefined);
                            canvas.edit(field.id, e.target.value);
                          }}
                        />
                      ) : (
                        <textarea
                          aria-label={`${field.file} ${field.label} line ${field.line}`}
                          rows={field.kind === "text" ? 4 : 2}
                          value={draft.values[field.id] ?? field.value}
                          maxLength={20000}
                          disabled={locked}
                          onChange={(e) => {
                            setPlan(undefined);
                            canvas.edit(field.id, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              const fieldId = field.id;
                              setQuery("");
                              setOffset(0);
                              canvas.clear();
                              setMobilePanel("outline");
                              requestAnimationFrame(() => {
                                const row = document.querySelector<HTMLElement>(
                                  `[data-source-field="${CSS.escape(fieldId)}"]`,
                                );
                                (row || returnFocus.current)?.focus();
                              });
                            }
                          }}
                        />
                      )}
                    </label>
                    {field.kind === "link" &&
                      !/^(\/[^/]|\/$|https:\/\/)/.test(
                        draft.values[field.id] ?? field.value,
                      ) && (
                        <p role="alert">
                          Use /path/ or https:// for this address.
                        </p>
                      )}
                    {draft.values[field.id] !== undefined && (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => canvas.edit(field.id, field.value)}
                      >
                        Undo this change
                      </button>
                    )}
                    <details>
                      <summary>Original text</summary>
                      <p>{field.value}</p>
                    </details>
                    <h4>Where it comes from</h4>
                    <p className="builder-hint">
                      {fieldSourceLabel(field)} · {field.file}
                    </p>
                    {field.file !== page.route && (
                      <p className="builder-hint">
                        Shared: changing this updates every page that uses it.
                      </p>
                    )}
                    {field.kind === "image" &&
                      !/srcset/i.test(field.attribute || "") && (
                        <button
                          type="button"
                          onClick={() => {
                            setTab("assets");
                            setMobilePanel("outline");
                          }}
                        >
                          Replace image
                        </button>
                      )}
                  </section>
                ))}
                {selected.length > 0 &&
                  !canvas.registration &&
                  !selected.some((f) => f.registration) && (
                    <p className="builder-hint">
                      Only text, links and images can change here. The design
                      stays as it is.
                    </p>
                  )}
                {canvas.reason &&
                  inventory?.pages.some(
                    (p) => p.path === page.path && p.kind === "cms",
                  ) &&
                  inventory?.studioUrl && (
                    <a
                      href={inventory.studioUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in CMS
                    </a>
                  )}
              </>
            )}
            {rightTab === "page" && (
              <>
                <h3>{page.title}</h3>
                <p>{page.path}</p>
                <h4>Files involved</h4>
                {inspection?.files.map((file) => (
                  <p key={file.file} className="builder-hint">
                    {file.file}
                    {file.file !== page.route ? " · Shared component" : ""}
                  </p>
                ))}
                <details>
                  <summary>Managed content</summary>
                  {inspection?.boundaries.map((reason, i) => (
                    <p key={i}>{reason}</p>
                  ))}
                </details>
              </>
            )}
          </div>
        </aside>
      </div>
      <footer className="builder-site-footer">
        <span className="builder-site-footer-meta" title={page.route}>
          <strong>{page.path}</strong>
          <span className="builder-hint">{page.route}</span>
          <span>
            {changed} unapplied {changed === 1 ? "change" : "changes"}
          </span>
          {git?.isRepository && (
            <span>
              Branch {git.branch} · {git.files.length}{" "}
              {git.files.length === 1 ? "file" : "files"} changed since the last
              commit
            </span>
          )}
        </span>
        {changed > 0 && (
          <button type="button" onClick={draft.download}>
            Download my unapplied edits
          </button>
        )}
        {appliedPlan && git?.isRepository && (
          <form
            className="builder-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const result = await storage.repository({
                  action: "repository-commit",
                  planId: appliedPlan,
                  message: commitMessage,
                });
                setAppliedPlan(undefined);
                setNotice(result.message);
              } catch (error) {
                setError(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Commit message
              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Say what you changed"
                maxLength={2000}
              />
            </label>
            <button
              type="submit"
              className="builder-primary"
              disabled={busy || disconnected}
            >
              Commit these changes
            </button>
          </form>
        )}
      </footer>
      <Dialog.Root open={reviewOpen} onOpenChange={setReviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="builder-modal-overlay" />
          <Dialog.Content
            className="builder-app builder-modal builder-site-review"
            data-theme={theme}
          >
            <Dialog.Close
              className="builder-icon-button builder-modal-close"
              aria-label="Close review"
            >
              <X size={18} />
            </Dialog.Close>
            <Dialog.Title className="builder-modal-title">
              Review my changes
            </Dialog.Title>
            <Dialog.Description className="builder-modal-lede">
              These files change in the website folder. Nothing is committed or
              published yet.
            </Dialog.Description>
            {plan?.changes
              .filter((c) => c.action !== "unchanged")
              .map((change, index) => (
                <details key={change.file} open={index === 0}>
                  <summary>
                    {change.action === "update"
                      ? "Update"
                      : change.action === "create"
                        ? "Add"
                        : change.action === "delete"
                          ? "Remove"
                          : change.action}{" "}
                    {change.file}
                  </summary>
                  {(() => {
                    const edits =
                      inspection?.fields.filter(
                        (f) =>
                          f.file === change.file &&
                          draft.values[f.id] !== undefined &&
                          draft.values[f.id] !== f.value,
                      ) || [];
                    const reordered =
                      inspection?.groups.filter(
                        (g) => g.file === change.file && draft.orders[g.id],
                      ) || [];
                    if (!edits.length && !reordered.length) return null;
                    return (
                      <ul className="builder-review-edits">
                        {edits.map((f) => (
                          <li key={f.id}>
                            <strong>{fieldKindLabel(f)}</strong>
                            <del>{f.value || "(empty)"}</del>
                            <ins>{draft.values[f.id] || "(empty)"}</ins>
                          </li>
                        ))}
                        {reordered.map((g) => (
                          <li key={g.id}>
                            <strong>{groupTitle(g)}</strong>
                            <span>Put in a new order</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {change.preview && (
                    <details className="builder-review-file">
                      <summary>
                        {change.action === "create"
                          ? "File details"
                          : "Show the whole file"}
                      </summary>
                      <pre>{change.preview}</pre>
                    </details>
                  )}
                  {change.conflict && (
                    <Notice tone="error">{change.conflict}</Notice>
                  )}
                </details>
              ))}
            {error && <Notice tone="error">{error}</Notice>}
            <button
              type="button"
              className="builder-primary"
              disabled={busy || Boolean(plan?.conflicts.length)}
              onClick={() => void apply()}
            >
              Apply changes to the folder
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
