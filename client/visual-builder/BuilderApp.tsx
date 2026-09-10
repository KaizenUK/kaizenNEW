import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Puck, usePuck } from "@puckeditor/core";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  Globe,
  Layers,
  LayoutTemplate,
  Monitor,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import {
  clone,
  freshBlocks,
  newId,
  normalizeSlug,
  type Asset,
  type Block,
  type BuilderData,
  type BuilderPage,
  type PageDocument,
  type SavedBlock,
  type Workspace,
} from "../../shared/visualBuilder";
import {
  canonicalBlocks,
  configWithAssets,
  insertBlocks,
  LibraryContext,
} from "./config";
import { block, newDocument } from "./starters";
import { cloud, localMode, storage } from "./storage";
import AssetLibrary, { downloadText } from "./AssetLibrary";
import PublishedPage from "./Renderer";
import pageCss from "./page.css?inline";
import { downloadProject, exportProject } from "./exportProject";
import "@puckeditor/core/puck.css";
import "./builder.css";

function Brand() {
  return (
    <span className="builder-brand">
      <span>改</span> kaizen
      <span className="builder-brand-light"> / builder</span>
    </span>
  );
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export default function BuilderApp() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [active, setActive] = useState<BuilderPage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(localMode);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setWorkspace(await storage.load());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (localMode) {
      void reload();
      return;
    }
    if (!cloud) {
      setLoading(false);
      setError(
        "Configure Supabase to enable the shared builder. Setup instructions are in docs/visual-builder.md.",
      );
      return;
    }
    cloud.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      if (data.session) void reload();
      else setLoading(false);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      if (session) setTimeout(() => void reload(), 0);
      else setWorkspace(undefined);
    });
    return () => data.subscription.unsubscribe();
  }, [reload]);
  const onPage = (page: BuilderPage) =>
    setWorkspace((w) => ({
      ...w,
      pages: [...w.pages.filter((p) => p.id !== page.id), page],
    }));
  const onAsset = (asset: Asset) =>
    setWorkspace((w) => ({
      ...w,
      assets: [...w.assets.filter((a) => a.id !== asset.id), asset],
    }));
  const onSaved = (item: SavedBlock) =>
    setWorkspace((w) => ({
      ...w,
      saved: [...w.saved.filter((s) => s.id !== item.id), item],
    }));
  async function create(template: boolean) {
    setCreating(true);
    try {
      const page = await storage.save(
        newId(),
        0,
        newDocument(
          template ? "A fresh beginning" : "Untitled page",
          undefined,
          template,
        ),
        "Created page",
      );
      onPage(page);
      setActive(page);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }
  if (active && workspace)
    return (
      <LibraryContext.Provider value={workspace.assets}>
        <Editor
          key={active.id}
          page={active}
          workspace={workspace}
          onPage={onPage}
          onAsset={onAsset}
          onSaved={onSaved}
          onBack={() => {
            setActive(undefined);
            void reload();
          }}
        />
      </LibraryContext.Provider>
    );
  return (
    <div className="builder-app builder-dashboard">
      <header>
        <Brand />
        <div className="builder-row">
          <span className="builder-pill">
            {localMode ? "Local workspace" : "Shared workspace"}
          </span>
          {signedIn && !localMode && (
            <button onClick={() => cloud.auth.signOut()}>Sign out</button>
          )}
          <a href="/">
            Back to Kaizen <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main>
        <div className="builder-dashboard-intro">
          <div>
            <span className="builder-eyebrow">
              YOUR IDEAS, READY FOR THE WEB
            </span>
            <h1>
              A little inspiration.
              <br />
              An entirely new page.
            </h1>
            <p>Bring your assets. Find your flow. Make something yours.</p>
          </div>
          <span className="builder-intro-mark" aria-hidden="true">
            ↗
          </span>
        </div>
        {localMode && (
          <p className="builder-local-note">
            Local workspace · Files and pages are saved on this computer.
            Publishing here updates your local site; production publishing uses
            the shared workspace.
          </p>
        )}
        {loading && <p role="status">Opening your workspace…</p>}
        {error && (
          <div role="alert" className="builder-error">
            {error}
            <button onClick={reload}>Try again</button>
          </div>
        )}
        {!signedIn && !localMode && cloud && (
          <form
            className="builder-login"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const { error } = await cloud.auth.signInWithOtp({
                email,
                options: {
                  shouldCreateUser: false,
                  emailRedirectTo: `${location.origin}/builder/`,
                },
              });
              if (error) setError(error.message);
              else setNotice("Check your email for a sign-in link.");
            }}
          >
            <h2>Welcome back</h2>
            <p>Sign in with your authorised editor account.</p>
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="builder-primary">Send sign-in link</button>
            {notice && <p role="status">{notice}</p>}
          </form>
        )}
        {workspace && (
          <>
            <div className="builder-section-heading">
              <h2>
                Your pages <span>{workspace.pages.length}</span>
              </h2>
              <div className="builder-row">
                <button disabled={creating} onClick={() => create(false)}>
                  <Plus size={16} /> Blank page
                </button>
                <button
                  disabled={creating}
                  className="builder-primary"
                  onClick={() => create(true)}
                >
                  <LayoutTemplate size={16} /> Use starter template
                </button>
              </div>
            </div>
            <div className="builder-page-list">
              {workspace.pages.map((page) => (
                <button
                  className="builder-page-card"
                  key={page.id}
                  onClick={() => setActive(page)}
                >
                  <div className="builder-page-thumbnail">
                    <div />
                    <div />
                    <div />
                    <ArrowUpRight size={30} />
                  </div>
                  <span className="builder-page-card-title">
                    {page.draft.title}
                  </span>
                  <small>/{page.draft.slug}/</small>
                  <div className="builder-row">
                    <span className="builder-pill">
                      {page.published ? "Published snapshot" : "Draft"}
                    </span>
                    <small>
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                </button>
              ))}
              {!workspace.pages.length && (
                <button
                  className="builder-new-page"
                  disabled={creating}
                  onClick={() => create(true)}
                >
                  <Plus size={28} />
                  <strong>Your first page starts here</strong>
                  <span>Start with an editable, responsive template</span>
                </button>
              )}
            </div>
            <div className="builder-workflow">
              {[
                "01 / Import your pack",
                "02 / Make it your own",
                "03 / Share it with the world",
              ].map((title, i) => (
                <div key={title}>
                  <h3>{title}</h3>
                  <p>
                    {
                      [
                        "Images, icons and fonts, all in one searchable library.",
                        "Drag real components onto a page. Fine-tune every screen size.",
                        "Save your draft, preview it, then publish when you’re ready.",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Editor({ page, workspace, onPage, onAsset, onSaved, onBack }) {
  const [document, setDocument] = useState<PageDocument>(clone(page.draft));
  const [status, setStatus] = useState("All changes saved");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const documentRef = useRef(document);
  const pageRef = useRef<BuilderPage>(page);
  const saved = useRef(JSON.stringify(page.draft));
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const saveError = useRef(false);
  const change = useCallback((value: PageDocument) => {
    documentRef.current = value;
    setDocument(value);
    setStatus(
      JSON.stringify(value) !== saved.current
        ? "Unsaved changes"
        : "All changes saved",
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(documentRef.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", warn);
    };
  }, []);
  const save = useCallback(
    (label = "Autosaved draft") => {
      const operation = async () => {
        const snapshot = clone(documentRef.current);
        if (JSON.stringify(snapshot) === saved.current) {
          if (mounted.current) setStatus("All changes saved");
          return pageRef.current;
        }
        if (mounted.current) setStatus("Saving…");
        const next = await storage.save(
          pageRef.current.id,
          pageRef.current.version,
          snapshot,
          label,
        );
        pageRef.current = next;
        saved.current = JSON.stringify(snapshot);
        saveError.current = false;
        onPage(next);
        if (mounted.current)
          setStatus(
            JSON.stringify(documentRef.current) === saved.current
              ? "All changes saved"
              : "Unsaved changes",
          );
        return next;
      };
      const promise = queue.current.then(operation);
      queue.current = promise.catch(() => undefined);
      return promise.catch((error) => {
        saveError.current = true;
        if (mounted.current) {
          setStatus("Save failed · draft still in editor");
          setNotice(errorMessage(error));
        }
        throw error;
      });
    },
    [onPage],
  );
  useEffect(() => {
    if (JSON.stringify(document) === saved.current) return;
    const timer = setTimeout(() => {
      void save().catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [document, save]);
  async function publish() {
    setBusy(true);
    try {
      const current = await save("Saved before publishing");
      const result = await storage.publish(current);
      pageRef.current = result.page;
      onPage(result.page);
      setNotice(result.message);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const onChange = useCallback(
    (data: any) => {
      const canonical = {
        ...data,
        content: canonicalBlocks(data.content),
      } as BuilderData;
      if (
        JSON.stringify(canonical) !== JSON.stringify(documentRef.current.data)
      )
        change({ ...documentRef.current, data: canonical });
    },
    [change],
  );
  const editorConfig = useMemo(
    () => configWithAssets(workspace.assets),
    [workspace.assets],
  );
  return (
    <div className="builder-app builder-editor">
      <Puck
        key={generation}
        config={editorConfig}
        data={document.data as any}
        metadata={{ theme: document.theme }}
        onChange={onChange}
        viewports={[
          { width: 1280, label: "Desktop", icon: "Monitor" },
          { width: 768, label: "Tablet", icon: "Tablet" },
          { width: 390, label: "Mobile", icon: "Smartphone" },
        ]}
        ui={{
          viewports: {
            current: { width: 1280, height: "auto" },
            controlsVisible: true,
            options: [],
          },
        }}
      >
        <EditorShell
          document={document}
          change={change}
          workspace={workspace}
          page={pageRef.current}
          status={status}
          notice={notice}
          busy={busy}
          setNotice={setNotice}
          save={() => save("Saved draft")}
          publish={publish}
          onAsset={onAsset}
          onSaved={onSaved}
          onBack={async () => {
            try {
              await save();
              onBack();
            } catch {}
          }}
          restore={(revision) => {
            change(clone(revision.document));
            setGeneration((n) => n + 1);
            setNotice(
              `Restored “${revision.label}” as a draft. Publish when ready.`,
            );
          }}
        />
      </Puck>
    </div>
  );
}

function EditorShell({
  document,
  change,
  workspace,
  page,
  status,
  notice,
  busy,
  setNotice,
  save,
  publish,
  onAsset,
  onSaved,
  onBack,
  restore,
}) {
  const { appState, dispatch, selectedItem, history, config } = usePuck();
  const [tab, setTab] = useState("blocks");
  const [rightTab, setRightTab] = useState("design");
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clipboard, setClipboard] = useState<Block[]>();
  const [savedName, setSavedName] = useState("");
  const add = (blocks: Block[]) =>
    dispatch({
      type: "set",
      state: {
        data: {
          ...appState.data,
          content: insertBlocks(
            appState.data.content as Block[],
            freshBlocks(blocks),
            selectedItem?.props.id,
          ),
        },
      },
      recordHistory: true,
    });
  const useAsset = (asset: Asset) => {
    if (asset.kind === "font") {
      change({
        ...document,
        theme: {
          ...document.theme,
          fontFamily: "BuilderFont, system-ui, sans-serif",
          fontUrl: asset.url,
        },
      });
      setRightTab("styles");
      setNotice(`${asset.name} applied to the page.`);
    } else
      add([
        block(asset.kind === "icon" ? "Icon" : "Image", {
          src: asset.url,
          alt: asset.name.replace(/\.[^.]+$/, ""),
        }),
      ]);
  };
  const copy = () => {
    if (!selectedItem) return;
    const copied = clone([selectedItem]) as Block[];
    setClipboard(copied);
    sessionStorage.setItem("kaizen-builder-clipboard", JSON.stringify(copied));
    setNotice("Component copied. Paste it on this page or another page.");
  };
  const paste = () => {
    try {
      const items =
        clipboard ||
        JSON.parse(
          sessionStorage.getItem("kaizen-builder-clipboard") || "null",
        );
      if (items) add(items);
      else setNotice("Select and copy a component first.");
    } catch {
      setNotice("Could not read copied components.");
    }
  };
  const width = appState.ui.viewports.current.width;
  const surface = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(700);
  useEffect(() => {
    if (!surface.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);
  const canvasWidth = typeof width === "number" ? width : availableWidth;
  const zoom = Math.min(1, availableWidth / canvasWidth);
  async function saveReusable(kind: "section" | "template") {
    try {
      const blocks =
        kind === "template"
          ? appState.data.content
          : selectedItem
            ? [selectedItem]
            : [];
      if (!blocks.length) throw new Error("Select a section first.");
      if (!savedName.trim())
        throw new Error("Name your reusable content first.");
      const item = await storage.saveBlock({
        id: newId(),
        name: savedName,
        kind,
        blocks: canonicalBlocks(clone(blocks) as Block[]),
        ...(kind === "template" ? { theme: document.theme } : {}),
      });
      onSaved(item);
      setSavedName("");
      setNotice(`${item.name} saved to your library.`);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }
  const changeField = (key: string, value: unknown) =>
    change({ ...document, [key]: value });
  const previewHtml = preview
    ? `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${pageCss}</style></head><body>${renderToStaticMarkup(<PublishedPage document={document} />)}</body></html>`
    : "";
  return (
    <>
      <header className="builder-editor-header">
        <div className="builder-row">
          <button aria-label="Back to pages" onClick={onBack}>
            <ArrowLeft size={17} />
          </button>
          <Brand />
          <span className="builder-header-page">{document.title}</span>
        </div>
        <div className="builder-row">
          <span className="builder-save-status" role="status">
            <Check size={13} />
            {status}
          </span>
          <button onClick={() => save().catch(() => {})}>
            <Save size={15} /> Save
          </button>
          <button onClick={() => setPreview(true)}>
            <Eye size={15} /> Preview
          </button>
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await save();
                const drafts = [
                  document,
                  ...workspace.pages
                    .filter((p) => p.id !== page.id)
                    .map((p) => p.draft),
                ];
                const result = await exportProject(
                  drafts,
                  workspace.assets,
                  setNotice,
                );
                downloadProject(result.blob);
                setNotice(
                  `Exported ${drafts.length} pages, React source and assets. Open HANDOFF.md in the ZIP.${result.warnings.length ? " Some external assets could not be bundled; see HANDOFF.md." : ""}`,
                );
              } catch (error) {
                setNotice(errorMessage(error));
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={15} />
            {exporting ? "Exporting…" : "Export ZIP"}
          </button>
          <button disabled={busy} className="builder-primary" onClick={publish}>
            <Globe size={15} />
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>
      <div className="builder-editor-body">
        <aside className="builder-sidebar builder-left">
          <div className="builder-tabs">
            {[
              ["blocks", "Blocks", LayoutTemplate],
              ["assets", "Assets", ImageIcon],
              ["layers", "Layers", Layers],
            ].map(([id, title, Icon]: any) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                {title}
              </button>
            ))}
          </div>
          <div className="builder-sidebar-content">
            {tab === "blocks" && (
              <>
                <div className="builder-panel-heading">
                  <h2>Make it yours</h2>
                  <p>Drag a block onto your page.</p>
                </div>
                <Puck.Components />
                <details className="builder-reusable" open>
                  <summary>Saved sections & templates</summary>
                  {workspace.saved.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        const data = {
                          ...appState.data,
                          content: insertBlocks(
                            appState.data.content as Block[],
                            freshBlocks(item.blocks),
                            selectedItem?.props.id,
                          ),
                        };
                        dispatch({
                          type: "set",
                          state: { data },
                          recordHistory: true,
                        });
                        change({
                          ...document,
                          data,
                          theme: item.theme || document.theme,
                        });
                      }}
                    >
                      <Plus size={14} /> {item.name} <small>{item.kind}</small>
                    </button>
                  ))}
                  {!workspace.saved.length && (
                    <p className="builder-hint">
                      Save a favourite section using the controls below.
                    </p>
                  )}
                  <input
                    aria-label="Reusable content name"
                    placeholder="Name your section or template"
                    value={savedName}
                    onChange={(e) => setSavedName(e.target.value)}
                  />
                  <div className="builder-row">
                    <button
                      disabled={!selectedItem}
                      onClick={() => saveReusable("section")}
                    >
                      Save section
                    </button>
                    <button onClick={() => saveReusable("template")}>
                      Save template
                    </button>
                  </div>
                </details>
              </>
            )}
            {tab === "assets" && (
              <AssetLibrary
                assets={workspace.assets}
                onAsset={onAsset}
                onUse={useAsset}
                notify={setNotice}
              />
            )}
            {tab === "layers" && (
              <>
                <div className="builder-panel-heading">
                  <h2>Page layers</h2>
                  <p>Select, reorder and nest your components.</p>
                </div>
                <Puck.Outline />
              </>
            )}
          </div>
        </aside>
        <main className="builder-canvas">
          <div className="builder-canvas-toolbar">
            <div className="builder-row">
              <button
                aria-label="Undo"
                disabled={!history.hasPast}
                onClick={history.back}
              >
                <Undo2 size={17} />
              </button>
              <button
                aria-label="Redo"
                disabled={!history.hasFuture}
                onClick={history.forward}
              >
                <Redo2 size={17} />
              </button>
              <span className="builder-hint">/{document.slug}/</span>
            </div>
            <div className="builder-row">
              {[
                [1280, "Desktop", Monitor],
                [768, "Tablet", Tablet],
                [390, "Mobile", Smartphone],
              ].map(([size, label, Icon]: any) => (
                <button
                  aria-label={`${label} preview`}
                  key={size}
                  aria-pressed={width === size}
                  onClick={() =>
                    dispatch({
                      type: "setUi",
                      ui: {
                        viewports: {
                          ...appState.ui.viewports,
                          current: { width: size, height: "auto" },
                        },
                      },
                    })
                  }
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <span className="builder-canvas-width">{width}px</span>
          </div>
          <div className="builder-preview-surface" ref={surface}>
            <div
              className="builder-frame"
              style={{
                width: canvasWidth,
                height: `calc(100% / ${zoom})`,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                marginLeft: Math.max(0, (availableWidth - canvasWidth) / 2),
              }}
            >
              <Puck.Preview />
            </div>
          </div>
          <div className="builder-canvas-footnote">
            {localMode ? "LOCAL WORKSPACE" : "SHARED WORKSPACE"}{" "}
            <span>Draft · changes go live only when you publish</span>
          </div>
        </main>
        <aside className="builder-sidebar builder-right">
          <div className="builder-tabs">
            {["design", "page", "styles", "revisions"].map((id) => (
              <button
                key={id}
                aria-pressed={rightTab === id}
                onClick={() => setRightTab(id)}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
          <div className="builder-sidebar-content">
            {rightTab === "design" && (
              <>
                <div className="builder-panel-heading">
                  <h2>
                    {selectedItem
                      ? config.components[selectedItem.type]?.label ||
                        selectedItem.type
                      : "Select a component"}
                  </h2>
                  <p>
                    {selectedItem
                      ? "Shape the details. Make it feel right."
                      : "Click the canvas or choose a layer to edit it."}
                  </p>
                </div>
                <div className="builder-selection-actions">
                  <button disabled={!selectedItem} onClick={copy}>
                    <Copy size={13} /> Copy
                  </button>
                  <button onClick={paste}>Paste</button>
                </div>
                <Puck.Fields />
              </>
            )}
            {rightTab === "page" && (
              <div className="builder-field">
                <h2>Page settings</h2>
                <label>
                  Page title
                  <input
                    value={document.title}
                    maxLength={200}
                    onChange={(e) => changeField("title", e.target.value)}
                  />
                </label>
                <label>
                  Page URL
                  <input
                    value={document.slug}
                    onChange={(e) => changeField("slug", e.target.value)}
                    onBlur={(e) => {
                      try {
                        changeField("slug", normalizeSlug(e.target.value));
                      } catch (error) {
                        setNotice(errorMessage(error));
                      }
                    }}
                  />
                </label>
                <p className="builder-hint">kaizenweb.co.uk/{document.slug}/</p>
                <label>
                  Search description
                  <textarea
                    value={document.description}
                    maxLength={320}
                    rows={4}
                    onChange={(e) => changeField("description", e.target.value)}
                  />
                </label>
                <label className="builder-checkbox">
                  <input
                    type="checkbox"
                    checked={document.noIndex}
                    onChange={(e) => changeField("noIndex", e.target.checked)}
                  />
                  Hide from search engines
                </label>
                <div className="builder-seo-preview">
                  <strong>{document.title}</strong>
                  <small>kaizenweb.co.uk/{document.slug}/</small>
                  <p>
                    {document.description ||
                      "Add a short description of this page."}
                  </p>
                </div>
                <button
                  onClick={() =>
                    downloadText(
                      `${document.slug.replaceAll("/", "-")}.json`,
                      JSON.stringify(document, null, 2),
                    )
                  }
                >
                  Export draft backup
                </button>
                {page.published && (
                  <a
                    className="builder-live-link"
                    href={`/${page.published.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open published page <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            )}
            {rightTab === "styles" && (
              <div className="builder-field">
                <h2>Global page styles</h2>
                <p className="builder-hint">
                  The foundation for every component. Individual overrides take
                  precedence.
                </p>
                {[
                  ["accent", "Accent colour"],
                  ["background", "Page background"],
                  ["color", "Text colour"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <div className="builder-color">
                      <input
                        aria-label={label}
                        type="color"
                        value={document.theme[key]}
                        onChange={(e) =>
                          changeField("theme", {
                            ...document.theme,
                            [key]: e.target.value,
                          })
                        }
                      />
                      <input
                        aria-label={`${label} value`}
                        value={document.theme[key]}
                        onChange={(e) =>
                          changeField("theme", {
                            ...document.theme,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </div>
                  </label>
                ))}
                <label>
                  Typography
                  <select
                    value={document.theme.fontFamily}
                    onChange={(e) =>
                      changeField("theme", {
                        ...document.theme,
                        fontFamily: e.target.value,
                        fontUrl: e.target.value.startsWith("BuilderFont")
                          ? document.theme.fontUrl
                          : undefined,
                      })
                    }
                  >
                    <option value="Inter, system-ui, sans-serif">
                      Modern sans
                    </option>
                    <option value="Georgia, serif">Editorial serif</option>
                    <option value="monospace">Monospace</option>
                    {document.theme.fontUrl && (
                      <option value="BuilderFont, system-ui, sans-serif">
                        Uploaded font
                      </option>
                    )}
                  </select>
                </label>
                <p className="builder-hint">
                  To use a web font, find it in Assets and click Use.
                </p>
                <label>
                  Default corner radius
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={document.theme.radius}
                    onChange={(e) =>
                      changeField("theme", {
                        ...document.theme,
                        radius: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
            {rightTab === "revisions" && (
              <div className="builder-field">
                <h2>Revision history</h2>
                <p className="builder-hint">
                  The last 50 saved versions. Restoring creates a draft and
                  leaves the live page unchanged.
                </p>
                {[...page.revisions].reverse().map((revision) => (
                  <div className="builder-revision" key={revision.id}>
                    <strong>{revision.label}</strong>
                    <time>{new Date(revision.createdAt).toLocaleString()}</time>
                    <button onClick={() => restore(revision)}>
                      Restore as draft
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
      {notice && (
        <div role="status" className="builder-toast">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {preview && (
        <div
          className="builder-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Page preview"
        >
          <header>
            <strong>Preview · {document.title}</strong>
            <span>{width}px</span>
            <button onClick={() => setPreview(false)}>Return to editor</button>
          </header>
          <div>
            <iframe
              title="Published page preview"
              sandbox="allow-same-origin allow-popups"
              srcDoc={previewHtml}
              style={{
                width: typeof width === "number" ? width : "100%",
                maxWidth: "100%",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
