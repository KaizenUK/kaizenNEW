import React, { lazy, useCallback, useEffect, useRef, useState } from "react";

import {
  Head,
  Shell,
  Sidebar,
  Notice,
  useBuilderTheme,
  type BuilderView,
} from "./shell";
import {
  ProjectName,
  useActiveProject,
  useProjectCapabilities,
} from "./activeProject";
import FirstRunCard from "./FirstRunCard";
import { saveTemplatePage } from "./templateCreation";
import { useFirstRun } from "./useFirstRun";
import PagesView, { pageStatus } from "./PagesView";

import ProjectsView from "./ProjectsView";
import BuilderAuth from "./BuilderAuth";
import { observeAuthSession } from "./authSession";
import { authErrorMessage } from "./authState";
import AccountPage from "./AccountPage";
import { BuilderViewProvider, BuilderViewSettings } from "./viewMode";

import { repositoryConnection } from "./repositoryConnection";
import ClientSettings from "./ClientSettings";
import RepositorySettings from "./RepositorySettings";
import ProjectBillingPanel from "./ProjectBillingPanel";
import ProblemReport from "./ProblemReport";
import { startErrorReporting } from "./errorReporting";
import {
  clearDiagnostics,
  setDiagnosticPage,
  watchBrowserErrors,
} from "./diagnostics";
import ClientPublications from "./ClientPublications";
import { activeProjectId, clearProjectCache } from "./projectStorage";

import {
  newId,
  type Asset,
  type BuilderPage,
  type SavedBlock,
  type Workspace,
} from "../../shared/visualBuilder";

import { newDocument } from "./starters";
import { cloud, localMode, storage } from "./storage";

import { HostedMediaProvider } from "./HostedMediaProvider";
import { saveStarterSite } from "./starterSite";

import { isPreviewId, previewLink } from "../../shared/builderPreviews";
import { PrivatePreviewList, PrivatePreviewViewer } from "./PrivatePreviews";

import "./builder.css";
import SitePanel from "./SitePanel";
import ProjectBackups from "./ProjectBackups";
import ReleasesPanel from "./ReleasesPanel";
import RedirectsPanel from "./RedirectsPanel";
import ExistingPages from "./ExistingPages";
import SitePages, { siteRoutePath, type SitePage } from "./SitePages";
import type { PageInventory } from "../../shared/builderPageInventory";
import { FormEndpointContext } from "./FormEndpointContext";
import { builderFormEndpoint } from "./formConfig";

import BuilderFeature from "./BuilderFeature";
const Editor = lazy(() => import("./PageEditor"));
const SitePageEditor = lazy(() => import("./SitePageEditor"));
const AssetsView = lazy(() => import("./AssetsView"));
const RepositoryPanel = lazy(() => import("./RepositoryPanel"));
const HostedRepository = lazy(() => import("./HostedRepository"));

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export default function BuilderApp(props: { inventory?: PageInventory } = {}) {
  return (
    <BuilderAuth>
      <BuilderViewProvider>
        <HostedMediaProvider>
          <ProjectForms>
            <BuilderWorkspace {...props} />
          </ProjectForms>
        </HostedMediaProvider>
      </BuilderViewProvider>
    </BuilderAuth>
  );
}
function ProjectForms({ children }: { children: React.ReactNode }) {
  const capabilities = useProjectCapabilities();
  return (
    <FormEndpointContext.Provider
      value={capabilities.legacyWorkspace ? builderFormEndpoint : ""}
    >
      {children}
    </FormEndpointContext.Provider>
  );
}
function BuilderWorkspace({ inventory }: { inventory?: PageInventory } = {}) {
  const capabilities = useProjectCapabilities();
  const { project } = useActiveProject();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [active, setActive] = useState<BuilderPage>();
  const [firstRunPreview, setFirstRunPreview] = useState<string>();
  const [accountId, setAccountId] = useState<string | undefined>(
    localMode ? "local" : undefined,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [signedIn, setSignedIn] = useState(localMode);
  const [notice, setNotice] = useState("");
  const [existingPath, setExistingPath] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<BuilderView>(() =>
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("view") === "account"
      ? "account"
      : typeof location !== "undefined" &&
          new URLSearchParams(location.search).get("view") === "repository"
        ? "repository"
        : !localMode &&
            typeof location !== "undefined" &&
            !new URLSearchParams(location.search).has("project")
          ? "projects"
          : "pages",
  );
  const [theme, toggleTheme] = useBuilderTheme();
  const [previewId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("preview"),
  );
  const [editingComponent, setEditingComponent] = useState<string>();
  const [sitePage, setSitePage] = useState<SitePage>();
  const workspaceRef = useRef<Workspace>(undefined);
  const loadSequence = useRef(0);
  const authAccount = useRef<string | undefined>(undefined);
  const checklist = useFirstRun({
    account: accountId,
    projectId: activeProjectId,
    project,
    workspace,
    visible: view === "pages" && !active && !sitePage && !editingComponent,
  });
  useEffect(watchBrowserErrors, []);
  useEffect(() => {
    repositoryConnection.start();
  }, []);
  useEffect(() => {
    if (localMode || !cloud || previewId) return;
    return startErrorReporting(cloud, {
      projectId: activeProjectId,
      userAgent: navigator.userAgent,
      helper: () => ({
        local: localMode,
        status: repositoryConnection.snapshot().status,
      }),
    });
  }, [previewId]);
  useEffect(() => {
    setDiagnosticPage({
      screen: sitePage ? "website-editor" : active ? "page-editor" : view,
      id: active?.id,
      route: sitePage?.path,
    });
  }, [active?.id, sitePage?.path, view]);
  workspaceRef.current = workspace;
  const replaceWorkspace = (next: Workspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  };
  const libraryReplaced = (next: Workspace) => {
    replaceWorkspace(next);
    setActive(undefined);
    setEditingComponent(undefined);
    setView("pages");
    setNotice(
      "Asset replaced in drafts and reusable content. Published pages are unchanged.",
    );
  };
  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const next = await storage.load();
      if (sequence === loadSequence.current) setWorkspace(next);
    } catch (e) {
      if (sequence === loadSequence.current) {
        setWorkspace(undefined);
        setError(errorMessage(e));
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
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
    const stop = observeAuthSession(cloud.auth, (_event, session, failure) => {
      const changed = authAccount.current !== session?.user.id;
      if (changed) {
        clearProjectCache();
        clearDiagnostics();
        window.dispatchEvent(new Event("builder-projects-changed"));
        authAccount.current = session?.user.id;
        loadSequence.current++;
        setActive(undefined);
        setFirstRunPreview(undefined);
        setEditingComponent(undefined);
        setSitePage(undefined);
        setExistingPath(undefined);
        setWorkspace(undefined);
      }
      setSignedIn(Boolean(session));
      setAccountId(session?.user.id);
      setSessionEmail(session?.user?.email || "");
      if (failure) {
        setError(authErrorMessage(failure, "check"));
        setLoading(false);
      } else if (
        session &&
        !previewId &&
        (_event !== "TOKEN_REFRESHED" || changed)
      )
        void reload();
      else if (!session || previewId) {
        setWorkspace(undefined);
        setLoading(false);
      }
    });
    return () => {
      stop();
      loadSequence.current++;
    };
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
        <BuilderFeature
          key={`shared-${definition.id}`}
          name="page editor"
          theme={theme}
          onBack={() => {
            setEditingComponent(undefined);
            setView("pages");
          }}
        >
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
            theme={theme}
            onToggleTheme={toggleTheme}
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
              setView("site");
            }}
          />
        </BuilderFeature>
      );
    }
  }
  if (active && workspace)
    return (
      <BuilderFeature
        key={active.id}
        name="page editor"
        theme={theme}
        onBack={() => {
          setActive(undefined);
          setFirstRunPreview(undefined);
          void reload();
        }}
      >
        <Editor
          key={active.id}
          previewOnOpen={firstRunPreview === active.id}
          onPreviewLoaded={checklist.recordPreview}
          onClientReleases={() => {
            setActive(undefined);
            setFirstRunPreview(undefined);
            setView("releases");
            void reload();
          }}
          page={active}
          workspace={workspace}
          onPage={onPage}
          onAsset={onAsset}
          onAssets={onAssets}
          onLibraryReplaced={libraryReplaced}
          onSaved={onSaved}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => {
            setActive(undefined);
            setFirstRunPreview(undefined);
            void reload();
          }}
        />
      </BuilderFeature>
    );
  const navigate = (next: BuilderView) => {
    if (next === view) return;
    setNotice("");
    if (next === "redirects") {
      void storage
        .load()
        .then((fresh) => {
          replaceWorkspace(fresh);
          setView("redirects");
        })
        .catch((error) => setError(errorMessage(error)));
      return;
    }
    setView(next);
    if (next === "pages") void reload();
  };
  const current: BuilderView = !signedIn
    ? "pages"
    : view === "projects" || view === "settings" || view === "account"
      ? view
      : workspace
        ? view
        : "pages";
  const pendingCount = workspace
    ? workspace.pages.filter((page) => pageStatus(page).filter === "changed")
        .length
    : 0;
  if (sitePage && workspace)
    return (
      <BuilderFeature
        name="website editor"
        theme={theme}
        onBack={() => {
          setSitePage(undefined);
          navigate("pages");
        }}
      >
        <SitePageEditor
          page={sitePage}
          workspace={workspace}
          onWorkspace={replaceWorkspace}
          theme={theme}
          onToggleTheme={toggleTheme}
          inventory={inventory}
          onBack={() => {
            setSitePage(undefined);
            navigate("pages");
          }}
        />
      </BuilderFeature>
    );
  const panel = (content: React.ReactNode) => (
    <div className="builder-panel-body">{content}</div>
  );
  return (
    <Shell
      theme={theme}
      sidebar={
        <Sidebar
          view={current}
          onNavigate={navigate}
          localMode={localMode}
          email={signedIn && !localMode ? sessionEmail : undefined}
          onSignOut={
            signedIn && !localMode && cloud
              ? () => void cloud.auth.signOut()
              : undefined
          }
          theme={theme}
          onToggleTheme={toggleTheme}
          hasInventory={Boolean(inventory) && capabilities.hasInventory}
          pendingCount={pendingCount}
        />
      }
    >
      {current === "projects" && signedIn && <ProjectsView />}
      {current === "account" && signedIn && <AccountPage />}
      {current === "repository" && signedIn && (
        <BuilderFeature
          name="website folder"
          compact
          onBack={() => navigate("pages")}
        >
          {localMode ? (
            <RepositoryPanel existingPath={existingPath} />
          ) : (
            <HostedRepository existingPath={existingPath} />
          )}
        </BuilderFeature>
      )}
      {current === "settings" &&
        (workspace && !capabilities.legacyWorkspace ? (
          <>
            <ClientSettings
              workspace={workspace}
              onChange={replaceWorkspace}
              viewSettings={<BuilderViewSettings />}
            >
              <ProblemReport />
            </ClientSettings>
            <div className="builder-page-body">
              {!localMode && accountId && (
                <ProjectBillingPanel
                  key={`${accountId}:${activeProjectId}`}
                  accountId={accountId}
                  projectId={activeProjectId}
                />
              )}
              <RepositorySettings />
            </div>
          </>
        ) : (
          <>
            <Head info={<ProjectName />} title="Settings" help="settings" />
            <div className="builder-page-body">
              <BuilderViewSettings />
              {!localMode && accountId && workspace && (
                <ProjectBillingPanel
                  key={`${accountId}:${activeProjectId}`}
                  accountId={accountId}
                  projectId={activeProjectId}
                />
              )}
              <Notice>
                {workspace
                  ? "Website connections are managed by the site owner."
                  : "Project details are unavailable. You can still report a problem."}
              </Notice>
              <ProblemReport />
              {workspace && <RepositorySettings />}
            </div>
          </>
        ))}
      {current === "pages" && (
        <PagesView
          firstRun={
            <FirstRunCard
              checklist={checklist}
              creating={creating}
              onStep={(step) => {
                if (step === "name") navigate("projects");
                else if (step === "design") navigate("site");
                else if (step === "page") void create(false);
                else if (step === "publish") navigate("releases");
                else if (checklist.previewPage) {
                  setFirstRunPreview(checklist.previewPage.id);
                  setActive(checklist.previewPage);
                }
              }}
            />
          }
          workspace={workspace}
          localMode={localMode}
          email={signedIn && !localMode ? sessionEmail : undefined}
          loading={loading}
          error={error}
          creating={creating}
          onCreate={(template) => void create(template)}
          websitePaths={
            capabilities.hasInventory
              ? inventory?.pages.map((page) => page.path)
              : undefined
          }
          onUseTemplate={async (id, document) => {
            const sequence = loadSequence.current;
            setCreating(true);
            try {
              const page = await saveTemplatePage(storage, id, document);
              const fresh = await storage.load();
              if (sequence !== loadSequence.current) return;
              replaceWorkspace(fresh);
              setFirstRunPreview(undefined);
              setActive(
                fresh.pages.find((item) => item.id === page.id) || page,
              );
            } finally {
              setCreating(false);
            }
          }}
          onOpen={setActive}
          onCreateStarter={async (plan) => {
            const sequence = loadSequence.current;
            setCreating(true);
            try {
              const fresh = await saveStarterSite(storage, plan);
              if (sequence !== loadSequence.current) return;
              replaceWorkspace(fresh);
            } finally {
              setCreating(false);
            }
          }}
          onRetry={() => void reload()}
          sitePages={
            workspace && (
              <SitePages
                inventory={capabilities.hasInventory ? inventory : undefined}
                onOpen={setSitePage}
                onOpenBuilder={(path) => {
                  const existing = workspace.pages.find(
                    (p) =>
                      (p.draft.slug
                        ? `/${p.draft.slug.replace(/^\/+|\/+$/g, "")}/`
                        : "/") === path,
                  );
                  if (!existing) return false;
                  setActive(existing);
                  return true;
                }}
                onConnect={() => navigate("repository")}
              />
            )
          }
          login={
            !signedIn && !localMode && cloud ? (
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
                        ? previewLink(
                            location.origin,
                            previewId,
                            activeProjectId,
                          )
                        : `${location.origin}/builder/?project=${encodeURIComponent(activeProjectId)}`,
                    },
                  });
                  if (error) setError(error.message);
                  else setNotice("Check your email for a sign-in link.");
                }}
              >
                <h2>Sign in</h2>
                <p>Use your authorised editor account.</p>
                {previewId && (
                  <p>
                    Sign in to open this saved private preview. The link does
                    not grant access by itself.
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
            ) : undefined
          }
        />
      )}
      {current === "existing" &&
        inventory &&
        panel(
          <ExistingPages
            inventory={inventory}
            open
            onEdit={(path) => {
              if (repositoryConnection.snapshot().status !== "connected") {
                setExistingPath(path);
                navigate("repository");
                return;
              }
              void storage
                .repository({ action: "repository-inspect-current" })
                .then((model) => {
                  const row = model.routes.find(
                    (row) => siteRoutePath(row.file) === path,
                  );
                  if (!row)
                    throw new Error(
                      "This route has moved or comes from the CMS. Refresh the website pages.",
                    );
                  setSitePage({
                    root: model.root,
                    route: row.file,
                    path,
                    title:
                      row.title ||
                      inventory.pages.find((p) => p.path === path)?.title ||
                      path,
                  });
                })
                .catch((error) => setError(error.message));
            }}
          />,
        )}
      {current === "site" &&
        workspace &&
        panel(
          <SitePanel
            workspace={workspace}
            onWorkspace={replaceWorkspace}
            onEdit={setEditingComponent}
            onBack={() => navigate("pages")}
          />,
        )}
      {current === "assets" &&
        workspace &&
        panel(
          <BuilderFeature
            name="asset library"
            compact
            onBack={() => navigate("pages")}
          >
            <AssetsView
              workspace={workspace}
              prepareWorkspace={() => storage.load()}
              onReplacementComplete={libraryReplaced}
              assets={workspace.assets}
              onAsset={onAsset}
              onAssets={onAssets}
              onUse={() => setNotice("Open a page to place this asset on it.")}
              onUseBlock={() =>
                setNotice("Open a page to add this block to it.")
              }
              notify={setNotice}
            />
          </BuilderFeature>,
        )}
      {current === "releases" &&
        workspace &&
        capabilities.publishPath === "worker" &&
        panel(<ClientPublications onChanged={() => void reload()} />)}
      {current === "releases" &&
        workspace &&
        capabilities.publishPath === "github" &&
        !localMode &&
        panel(
          <ReleasesPanel
            workspace={workspace}
            onClose={() => navigate("pages")}
          />,
        )}
      {current === "redirects" &&
        workspace &&
        panel(
          <RedirectsPanel
            workspace={workspace}
            onWorkspace={replaceWorkspace}
            onClose={() => navigate("pages")}
            onReleases={() => navigate("releases")}
          />,
        )}
      {current === "previews" &&
        workspace &&
        panel(<PrivatePreviewList onClose={() => navigate("pages")} />)}
      {current === "backups" &&
        workspace &&
        panel(
          <ProjectBackups
            onWorkspace={replaceWorkspace}
            onClose={() => navigate("pages")}
          />,
        )}
      {notice && workspace && (
        <div role="status" className="builder-toast">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </Shell>
  );
}
