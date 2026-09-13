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
import { storage } from "./storage";
import {
  Brand,
  IconButton,
  Notice,
  Segmented,
  type BuilderTheme,
} from "./shell";
import { ProjectIdentity } from "./ProjectsView";
import { repositoryConnection } from "./repositoryConnection";
import { useSourceEditingDraft } from "./useSourceEditingDraft";
import { useSourceCanvas, type SourceImagePreview } from "./useSourceCanvas";
import { useSiteBuild } from "./useSiteBuild";
import { useSourceSelection } from "./useSourceSelection";
import type { SitePage } from "./SitePages";
import type { RepositoryGitStatus } from "../../scripts/builder-repository-git";
import AssetLibrary from "./AssetLibrary";
import RepositorySave from "./RepositorySave";

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
    [savedCommit, setSavedCommit] = useState<string>(),
    [commitMessage, setCommitMessage] = useState(`Update text on ${page.path}`);
  const [imagePreviews, setImagePreviews] = useState<
    Record<string, SourceImagePreview>
  >({});
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
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
    [available, setAvailable] = useState(900);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selected =
    inspection?.fields.filter((f) => canvas.ids.includes(f.id)) || [];
  const changed =
    Object.keys(draft.values).length + Object.keys(draft.orders).length;
  const locked = busy || !draft.ready || Boolean(draft.stale);
  const disconnected = connection.status !== "connected";
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
  }, [page.root, inspection, appliedPlan, savedCommit]);
  useEffect(() => {
    if (connection.status === "connected" && draft.ready && draft.error)
      void draft.retry().catch(() => {});
  }, [connection.status, connection.expiresAt]);
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
      animation = requestAnimationFrame(() =>
        setAvailable(Math.max(200, entries[0].contentRect.width)),
      );
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
      setNotice("Changes applied to the folder.");
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
            disabled={busy || (!draft.ready && changed > 0)}
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
              ? repositoryConnection.savedLabel
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
                    void repositoryConnection
                      .reconnect()
                      .catch((e) => setError(e.message));
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
                onClick={() =>
                  void repositoryConnection
                    .reconnect()
                    .catch((e) => setError(e.message))
                }
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
        {notice && <p role="status">{notice}</p>}
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
          <div className="builder-site-tabs">
            {["outline", "assets", "sections"].map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
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
                      className="builder-site-field"
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
                        {field.label}{" "}
                        {draft.values[field.id] !== undefined ? "· Edited" : ""}
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
                  <h3>{group.label}</h3>
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
                <p>This page has no safely reorderable sections.</p>
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
                  ? build.cancelling
                    ? "Cancelling the build…"
                    : build.job?.status === "queued"
                      ? "Waiting to build the preview…"
                      : build.job?.status === "building"
                        ? "Building the preview…"
                        : "Checking the preview…"
                  : build.job?.status === "cancelled"
                    ? "Build cancelled. Your edits are kept."
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
              {build.job?.status === "queued" && (
                <p role="status">
                  Position {build.job.queuePosition || 1} in this website’s
                  build queue.
                </p>
              )}
              {build.job?.status === "building" && build.job.startedAt && (
                <p role="status">
                  {Math.max(
                    0,
                    Math.floor((tick - Date.parse(build.job.startedAt)) / 1000),
                  )}{" "}
                  seconds
                </p>
              )}
              {build.job &&
                ["queued", "building"].includes(build.job.status) && (
                  <button
                    type="button"
                    disabled={build.cancelling || disconnected}
                    onClick={() => void build.cancel()}
                  >
                    Cancel build
                  </button>
                )}
              {build.job?.status === "cancelled" && !build.busy && (
                <button type="button" onClick={build.retry}>
                  Build again
                </button>
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
          {build.frame && build.job?.status === "succeeded" && !build.busy && (
            <span className="builder-site-live-status" role="status">
              Preview built.
            </span>
          )}
          {build.frame && (
            <div
              className="builder-site-frame-wrap"
              style={{ width: width * zoom, height: Math.max(600, 800 * zoom) }}
            >
              <iframe
                ref={frameRef}
                title="Website canvas"
                src={build.frame.url}
                sandbox={repositoryConnection.frameSandbox}
                allow="local-network-access; local-network; loopback-network"
                referrerPolicy="no-referrer"
                onLoad={canvas.hello}
                style={{
                  width,
                  height: Math.max(800, 600 / zoom),
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
              {repositoryConnection.localBuilderOrigin() && (
                <a
                  href={`${repositoryConnection.localBuilderOrigin()}/builder/?local=1&view=repository`}
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
          <div className="builder-site-tabs">
            {["selected", "page"].map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={rightTab === id}
                onClick={() => setRightTab(id)}
              >
                {id === "selected" ? "Selected" : "Page"}
              </button>
            ))}
          </div>
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
                    <h3>
                      {field.kind === "link"
                        ? "Address"
                        : field.kind === "image"
                          ? "Image"
                          : field.label}
                    </h3>
                    <label>
                      {field.design
                        ? `${field.design.property} · ${field.design.device}`
                        : `Current ${field.kind === "link" ? "address" : "text"}`}
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
                      {field.file} · line {field.line}
                    </p>
                    {field.file !== page.route && (
                      <p>Shared with other pages</p>
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
                      This component keeps its design. Layout controls require a
                      registered component.
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
        <span title={page.route}>
          {page.path} · <span className="builder-hint">{page.route}</span> ·{" "}
          {changed} unapplied {changed === 1 ? "change" : "changes"}
          {git?.isRepository &&
            ` · Branch ${git.branch} · ${git.files.length} files changed since the last commit`}
        </span>
        {changed > 0 && (
          <button type="button" onClick={draft.download}>
            Download my unapplied edits
          </button>
        )}
        {"canSaveToWebsite" in connection && connection.canSaveToWebsite ? (
          <RepositorySave
            root={page.root}
            route={page.route}
            appliedPlan={appliedPlan}
            disabled={busy || build.busy}
            hasUnappliedChanges={changed > 0 || draft.assets.length > 0}
            onCommit={setSavedCommit}
          />
        ) : (
          appliedPlan &&
          git?.isRepository && (
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
                  maxLength={2000}
                />
              </label>
              <button type="submit" disabled={busy || disconnected}>
                Commit these changes
              </button>
            </form>
          )
        )}
      </footer>
      <Dialog.Root open={reviewOpen} onOpenChange={setReviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="builder-modal-overlay" />
          <Dialog.Content
            className="builder-app builder-modal builder-site-review"
            data-theme={theme}
          >
            <Dialog.Title>Review my changes</Dialog.Title>
            <Dialog.Description>
              These changes will be applied to the website folder.
            </Dialog.Description>
            <Dialog.Close
              className="builder-icon-button"
              aria-label="Close review"
            >
              <X size={18} />
            </Dialog.Close>
            {plan?.changes
              .filter((c) => c.action !== "unchanged")
              .map((change) => (
                <details key={change.file}>
                  <summary>
                    {change.action} · {change.file}
                  </summary>
                  {change.preview && <pre>{change.preview}</pre>}
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
