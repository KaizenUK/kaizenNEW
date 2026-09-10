import React, {
  useCallback,
  useContext,
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
import SectionLibrary from "./SectionLibrary";
import { cloud, localMode, storage } from "./storage";
import AssetLibrary, { downloadText } from "./AssetLibrary";
import { previewHtml as renderPreviewHtml } from "./previewHtml";
import { isPreviewId, previewLink } from "../../shared/builderPreviews";
import {
  PrivatePreviewControls,
  PrivatePreviewList,
  PrivatePreviewViewer,
} from "./PrivatePreviews";
import { downloadProject, exportProject } from "./exportProject";
import "@puckeditor/core/puck.css";
import "./builder.css";
import SitePanel from "./SitePanel";
import ProjectBackups from "./ProjectBackups";
import ReleasesPanel from "./ReleasesPanel";
import RedirectsPanel from "./RedirectsPanel";
import ExistingPages from "./ExistingPages";
import type { PageInventory } from "../../shared/builderPageInventory";
import { ImageContext } from "./ImageContext";
import { imageIndex, materializeImages } from "../../shared/builderImages";
import ContentProvider from "./ContentProvider";
import { ContentContext } from "./ContentContext";
import {
  hasContentBindings,
  resolveContentDocument,
} from "../../shared/builderContent";
import { SiteContext, ThemeTokensContext } from "./SiteContext";
import {
  resolveShared,
  resolveSiteDocument,
  sharedInstance,
} from "../../shared/builderSite";

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
export default function BuilderApp({
  inventory,
}: { inventory?: PageInventory } = {}) {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [active, setActive] = useState<BuilderPage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(localMode);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [releasesOpen, setReleasesOpen] = useState(false);
  const [previewsOpen, setPreviewsOpen] = useState(false);
  const [redirectsOpen, setRedirectsOpen] = useState(false);
  const [previewId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("preview"),
  );
  const [editingComponent, setEditingComponent] = useState<string>();
  const workspaceRef = useRef<Workspace>(undefined);
  workspaceRef.current = workspace;
  const replaceWorkspace = (next: Workspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  };
  const libraryReplaced = (next: Workspace) => {
    replaceWorkspace(next);
    setActive(undefined);
    setEditingComponent(undefined);
    setSiteOpen(false);
    setNotice(
      "Asset replaced in drafts and reusable content. Published pages are unchanged.",
    );
  };
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
      if (previewId) setLoading(false);
      else void reload();
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
      if (data.session && !previewId) void reload();
      else setLoading(false);
    });
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      if (session && !previewId) setTimeout(() => void reload(), 0);
      else setWorkspace(undefined);
    });
    return () => data.subscription.unsubscribe();
  }, [reload, previewId]);
  const onPage = (page: BuilderPage) =>
    setWorkspace((w) => ({
      ...w,
      pages: [...w.pages.filter((p) => p.id !== page.id), page],
    }));
  const onAssets = (items: Asset[]) =>
    setWorkspace((w) => {
      const merged = new Map(w.assets.map((asset) => [asset.id, asset]));
      items.forEach((asset) => merged.set(asset.id, asset));
      return { ...w, assets: [...merged.values()] };
    });
  const onAsset = (asset: Asset) => onAssets([asset]);
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
  if (previewId && signedIn) return <PrivatePreviewViewer id={previewId} />;
  if (redirectsOpen && workspace)
    return (
      <div className="builder-app builder-dashboard">
        <header>
          <Brand />
        </header>
        <main>
          <RedirectsPanel
            workspace={workspace}
            onWorkspace={replaceWorkspace}
            onClose={() => {
              setRedirectsOpen(false);
              void reload();
            }}
            onReleases={() => {
              setRedirectsOpen(false);
              setReleasesOpen(true);
            }}
          />
        </main>
      </div>
    );
  if (previewsOpen && workspace)
    return (
      <div className="builder-app builder-dashboard">
        <header>
          <Brand />
        </header>
        <main>
          <PrivatePreviewList onClose={() => setPreviewsOpen(false)} />
        </main>
      </div>
    );
  if (editingComponent && workspace?.site) {
    const definition = workspace.site.draft.components.find(
      (item) => item.id === editingComponent,
    );
    if (definition) {
      const componentPage: BuilderPage = {
        id: definition.id,
        version: 0,
        draft: {
          ...newDocument(definition.name, `shared-${definition.id}`, false),
          theme: workspace.site.draft.theme,
          data: { root: {}, content: definition.blocks },
        },
        published: null,
        revisions: [],
        updatedAt: "",
      };
      return (
        <LibraryContext.Provider value={workspace.assets}>
          <Editor
            key={`shared-${definition.id}`}
            page={componentPage}
            workspace={workspace}
            onPage={() => {}}
            onAsset={onAsset}
            onAssets={onAssets}
            onLibraryReplaced={libraryReplaced}
            onSaved={onSaved}
            isComponent
            saveOverride={async (id, version, document) => {
              const current = workspaceRef.current;
              const design = {
                ...current.site.draft,
                components: current.site.draft.components.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        name: document.title,
                        blocks: document.data.content,
                      }
                    : item,
                ),
              };
              const site = await storage.saveSite(current.site.version, design);
              replaceWorkspace({ ...current, site });
              return {
                ...componentPage,
                version: version + 1,
                draft: document,
              };
            }}
            onBack={() => {
              setEditingComponent(undefined);
              setSiteOpen(true);
            }}
          />
        </LibraryContext.Provider>
      );
    }
  }
  if (releasesOpen && workspace && !localMode)
    return (
      <div className="builder-app builder-dashboard">
        <header>
          <Brand />
        </header>
        <main>
          <ReleasesPanel
            workspace={workspace}
            onClose={() => {
              setReleasesOpen(false);
              void reload();
            }}
          />
        </main>
      </div>
    );
  if (backupsOpen && workspace)
    return (
      <div className="builder-app builder-dashboard">
        <header>
          <Brand />
        </header>
        <main>
          <ProjectBackups
            onWorkspace={replaceWorkspace}
            onClose={() => {
              setBackupsOpen(false);
              void reload();
            }}
          />
        </main>
      </div>
    );
  if (siteOpen && workspace)
    return (
      <div className="builder-app builder-dashboard">
        <header>
          <Brand />
        </header>
        <main>
          <SitePanel
            workspace={workspace}
            onWorkspace={replaceWorkspace}
            onEdit={setEditingComponent}
            onBack={() => {
              setSiteOpen(false);
              void reload();
            }}
          />
        </main>
      </div>
    );
  if (active && workspace)
    return (
      <LibraryContext.Provider value={workspace.assets}>
        <Editor
          key={active.id}
          page={active}
          workspace={workspace}
          onPage={onPage}
          onAsset={onAsset}
          onAssets={onAssets}
          onLibraryReplaced={libraryReplaced}
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
                  emailRedirectTo: isPreviewId(previewId)
                    ? previewLink(location.origin, previewId)
                    : `${location.origin}/builder/`,
                },
              });
              if (error) setError(error.message);
              else setNotice("Check your email for a sign-in link.");
            }}
          >
            <h2>Welcome back</h2>
            <p>Sign in with your authorised editor account.</p>
            {previewId && (
              <p>
                Sign in to open this saved private preview. The link does not
                grant access by itself.
              </p>
            )}
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
                <button onClick={() => setSiteOpen(true)}>Site design</button>
                {inventory && (
                  <button
                    onClick={() => {
                      const panel = window.document.getElementById(
                        "builder-existing-pages",
                      ) as HTMLDetailsElement;
                      panel.open = true;
                      panel.scrollIntoView({ block: "start" });
                    }}
                  >
                    Existing site pages
                  </button>
                )}
                <button
                  onClick={() => {
                    void storage
                      .load()
                      .then((next) => {
                        replaceWorkspace(next);
                        setRedirectsOpen(true);
                      })
                      .catch((error) => setError(errorMessage(error)));
                  }}
                >
                  URL redirects
                </button>
                <button onClick={() => setPreviewsOpen(true)}>
                  Private previews
                </button>
                {!localMode && (
                  <button onClick={() => setReleasesOpen(true)}>
                    Releases
                  </button>
                )}
                <button onClick={() => setBackupsOpen(true)}>
                  Project backups
                </button>
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
            {inventory && <ExistingPages inventory={inventory} />}
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

function Editor(props) {
  const images = useMemo(
    () => imageIndex(props.workspace.assets),
    [props.workspace.assets],
  );
  return (
    <ImageContext.Provider value={images}>
      <ContentProvider>
        <EditorInner {...props} />
      </ContentProvider>
    </ImageContext.Provider>
  );
}
function EditorInner({
  page,
  workspace,
  onPage,
  onAsset,
  onAssets,
  onLibraryReplaced,
  onSaved,
  onBack,
  saveOverride = undefined,
  isComponent = false,
}) {
  const [document, setDocument] = useState<PageDocument>(clone(page.draft));
  const content = useContext(ContentContext);
  useEffect(() => {
    if (content.status !== "idle") return;
    try {
      if (
        hasContentBindings(
          resolveSiteDocument(document, workspace.site?.draft).data.content,
        )
      )
        void content.load?.().catch(() => {});
    } catch {
      /* Missing shared components are reported by the canvas. */
    }
  }, [document, workspace.site?.draft, content.status, content.load]);
  const canvasTheme = {
    ...(document.site?.useTheme
      ? workspace.site?.draft.theme || document.theme
      : document.theme),
    tokens: workspace.site?.draft.theme.tokens || document.theme.tokens,
  };
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
        const next = await (saveOverride || storage.save)(
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
    [onPage, saveOverride],
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
    () =>
      configWithAssets(
        workspace.assets,
        workspace.site?.draft.components.filter(
          (item) => !isComponent || item.id !== page.id,
        ) || [],
      ),
    [workspace.assets, workspace.site],
  );
  return (
    <ThemeTokensContext.Provider
      value={
        (document.site?.useTheme ? workspace.site?.draft.theme : document.theme)
          ?.tokens || {}
      }
    >
      <SiteContext.Provider value={workspace.site?.draft || null}>
        <div className="builder-app builder-editor">
          <Puck
            key={generation}
            config={editorConfig}
            data={document.data as any}
            metadata={{
              theme: canvasTheme,
              site: document.site,
            }}
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
              isComponent={isComponent}
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
              onAssets={onAssets}
              onLibraryReplaced={onLibraryReplaced}
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
      </SiteContext.Provider>
    </ThemeTokensContext.Provider>
  );
}

function EditorShell({
  isComponent,
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
  onAssets,
  onLibraryReplaced,
  onSaved,
  onBack,
  restore,
}) {
  const content = useContext(ContentContext);
  const {
    appState,
    dispatch,
    selectedItem,
    history,
    config,
    getSelectorForId,
  } = usePuck();
  function selectedPath(blocks: Block[], id?: string): Block[] {
    for (const item of blocks) {
      if (item.props.id === id) return [item];
      const childPath = selectedPath(item.props.children || [], id);
      if (childPath.length) return [item, ...childPath];
    }
    return [];
  }
  const ancestors = selectedPath(
    appState.data.content as Block[],
    selectedItem?.props.id,
  );
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
      if (isComponent || document.site?.useTheme) {
        setNotice(
          "Choose an uploaded site font in Pages → Site design. To use a different font on this page, turn off Use site styles first.",
        );
        return;
      }
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
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save().catch(() => {});
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]',
        )
      )
        return;
      if (key === "c" && selectedItem) {
        event.preventDefault();
        copy();
      }
      if (key === "v") {
        event.preventDefault();
        paste();
      }
      if (key === "d" && selectedItem) {
        const selector = getSelectorForId(selectedItem.props.id);
        if (selector) {
          event.preventDefault();
          dispatch({
            type: "duplicate",
            sourceIndex: selector.index,
            sourceZone: selector.zone,
            recordHistory: true,
          });
        }
      }
    };
    const iframe = surface.current?.querySelector("iframe");
    let frameDocument: Document | null = null;
    const attachFrame = () => {
      frameDocument?.removeEventListener("keydown", handleKey);
      frameDocument = iframe?.contentDocument || null;
      frameDocument?.addEventListener("keydown", handleKey);
    };
    window.addEventListener("keydown", handleKey);
    iframe?.addEventListener("load", attachFrame);
    attachFrame();
    return () => {
      window.removeEventListener("keydown", handleKey);
      iframe?.removeEventListener("load", attachFrame);
      frameDocument?.removeEventListener("keydown", handleKey);
    };
  }, [selectedItem, appState.data, clipboard, save]);
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
  let resolvedPreview: PageDocument | undefined;
  const previewHtml = preview
    ? (() => {
        try {
          const shared = resolveSiteDocument(document, workspace.site?.draft);
          if (
            hasContentBindings(shared.data.content) &&
            content.status !== "ready"
          )
            throw new Error(
              content.error ||
                "Sanity content is still loading. Try Preview again when it is ready.",
            );
          const resolved = materializeImages(
            resolveContentDocument(shared, content.catalogue),
            workspace.assets,
          );
          const html = renderPreviewHtml(resolved);
          resolvedPreview = resolved;
          return html;
        } catch (error) {
          return renderToStaticMarkup(<p>{errorMessage(error)}</p>);
        }
      })()
    : "";
  return (
    <>
      <header className="builder-editor-header">
        <div className="builder-row">
          <button aria-label="Back to pages" onClick={onBack}>
            <ArrowLeft size={17} />
          </button>
          <Brand />
          <span className="builder-header-page">
            {isComponent ? "Shared component · " : ""}
            {document.title}
          </span>
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
          {!isComponent && (
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
                    undefined,
                    workspace.site?.draft,
                    undefined,
                    workspace.routes?.draft,
                  );
                  downloadProject(result.blob);
                  setNotice(
                    `Exported ${drafts.length} pages, React source and assets. Open HANDOFF.md in the ZIP.${result.warnings.length ? " Review the integration notes and any missing assets in HANDOFF.md." : ""}`,
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
          )}
          {isComponent && (
            <button
              onClick={() =>
                downloadText(
                  `shared-${page.id}-draft.json`,
                  JSON.stringify(document, null, 2),
                )
              }
            >
              Download component draft
            </button>
          )}
          {!isComponent && (
            <button
              disabled={busy}
              className="builder-primary"
              onClick={publish}
            >
              <Globe size={15} />
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
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
                <SectionLibrary
                  theme={document.theme}
                  onInsert={(item) => {
                    const data = {
                      ...appState.data,
                      content: insertBlocks(
                        appState.data.content as Block[],
                        freshBlocks([item]),
                        selectedItem?.props.id,
                      ),
                    };
                    dispatch({
                      type: "set",
                      state: { data },
                      recordHistory: true,
                    });
                    change({ ...document, data });
                  }}
                />
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
                workspace={{
                  ...workspace,
                  pages: workspace.pages.map((item) =>
                    item.id === page.id ? { ...item, draft: document } : item,
                  ),
                  ...(isComponent && workspace.site
                    ? {
                        site: {
                          ...workspace.site,
                          draft: {
                            ...workspace.site.draft,
                            components: workspace.site.draft.components.map(
                              (item) =>
                                item.id === page.id
                                  ? { ...item, blocks: document.data.content }
                                  : item,
                            ),
                          },
                        },
                      }
                    : {}),
                }}
                prepareWorkspace={async () => {
                  await save();
                  return storage.load();
                }}
                onReplacementComplete={onLibraryReplaced}
                assets={workspace.assets}
                onAsset={onAsset}
                onAssets={onAssets}
                onUse={useAsset}
                onUseBlock={(item) => add([item])}
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
            {(isComponent
              ? ["design"]
              : ["design", "page", "styles", "revisions"]
            ).map((id) => (
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
                {ancestors.length > 0 && (
                  <nav
                    className="builder-breadcrumbs"
                    aria-label="Selected component path"
                  >
                    {ancestors.map((item, index) => (
                      <React.Fragment key={item.props.id}>
                        {index > 0 && <span aria-hidden="true">›</span>}
                        <button
                          type="button"
                          aria-current={
                            item.props.id === selectedItem?.props.id
                              ? "true"
                              : undefined
                          }
                          onClick={() => {
                            const selector = getSelectorForId(item.props.id);
                            if (selector)
                              dispatch({
                                type: "setUi",
                                ui: { itemSelector: selector },
                              });
                          }}
                        >
                          {item.props.label ||
                            config.components[item.type]?.label ||
                            item.type}
                        </button>
                      </React.Fragment>
                    ))}
                  </nav>
                )}
                <Puck.Fields />
                {(selectedItem?.type === "Shared" ||
                  String(selectedItem?.type).startsWith("Shared_")) && (
                  <button
                    onClick={() => {
                      try {
                        const detached = resolveShared(
                          selectedItem as unknown as Block,
                          workspace.site.draft,
                        );
                        const replace = (blocks: Block[]): Block[] =>
                          blocks.map((item) =>
                            item.props.id === detached.props.id
                              ? detached
                              : {
                                  ...item,
                                  props: {
                                    ...item.props,
                                    ...(item.props.children
                                      ? {
                                          children: replace(
                                            item.props.children,
                                          ),
                                        }
                                      : {}),
                                  },
                                },
                          );
                        dispatch({
                          type: "set",
                          state: {
                            data: {
                              ...appState.data,
                              content: replace(
                                appState.data.content as Block[],
                              ),
                            },
                          },
                          recordHistory: true,
                        });
                        setNotice(
                          "Component detached. Its content can now be edited independently.",
                        );
                      } catch (error) {
                        setNotice(errorMessage(error));
                      }
                    }}
                  >
                    Detach shared component
                  </button>
                )}
              </>
            )}
            {rightTab === "page" && (
              <div className="builder-field">
                <h2>Page settings</h2>
                <h3>Shared site design</h3>
                <label className="builder-checkbox">
                  <input
                    type="checkbox"
                    checked={!!document.site?.useTheme}
                    disabled={!workspace.site}
                    onChange={(event) =>
                      changeField("site", {
                        ...document.site,
                        useTheme: event.target.checked,
                      })
                    }
                  />
                  Use site styles
                </label>
                {(
                  [
                    ["headerId", "header", "Shared header"],
                    ["footerId", "footer", "Shared footer"],
                  ] as const
                ).map(([key, kind, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      aria-label={label}
                      value={document.site?.[key] || ""}
                      onChange={(event) => {
                        const next = { ...document.site };
                        if (event.target.value) next[key] = event.target.value;
                        else delete next[key];
                        changeField("site", next);
                      }}
                    >
                      <option value="">None</option>
                      {workspace.site?.draft.components
                        .filter((item) => item.kind === kind)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <p className="builder-hint">
                  Manage shared definitions from Pages → Site design. Existing
                  sections remain on this page; remove any header or footer you
                  are replacing.
                </p>
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
                {document.site?.useTheme && (
                  <p className="builder-local-note">
                    This page uses Site design styles. Turn off “Use site
                    styles” in Page settings to use independent page styles.
                  </p>
                )}
                <fieldset
                  disabled={!!document.site?.useTheme}
                  className="builder-style-fieldset"
                >
                  <p className="builder-hint">
                    The foundation for every component. Individual overrides
                    take precedence.
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
                </fieldset>
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
          <PrivatePreviewControls document={resolvedPreview} />
          <div>
            <iframe
              title="Published page preview"
              sandbox="allow-same-origin allow-popups allow-scripts allow-forms"
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
