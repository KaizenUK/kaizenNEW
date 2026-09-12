import React, { useEffect, useState } from "react";
import { Download, FolderSearch } from "lucide-react";
import type {
  RepositoryInspection,
  RepositoryPlan,
} from "../../scripts/builder-repository";
import { storage } from "./storage";
import { exportProject, downloadProject } from "./exportProject";
import RepositoryBuild from "./RepositoryBuild";
import SourcePageEditor from "./SourcePageEditor";
import NativeRepositoryBackup from "./NativeRepositoryBackup";
import { activeProjectId } from "./projectStorage";
import { Card, Head, Notice, Pill } from "./shell";
import { ProjectName } from "./activeProject";

/* Getting the project out of the builder: a website ZIP for hosting, or reviewed changes to a developer's repository. */

async function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The export could not be read."));
    reader.readAsDataURL(blob);
  });
}
const ownershipLabels: Record<string, string> = {
  "builder-editable": "Builder page",
  "code-managed": "Managed in code",
  "developer-integration": "Needs a developer",
};
export default function RepositoryPanel({
  existingPath,
  remoteRoot,
  remoteOrigin,
  repositoryEnabled = true,
  intro,
}: {
  existingPath?: string;
  remoteRoot?: string;
  remoteOrigin?: string;
  repositoryEnabled?: boolean;
  intro?: React.ReactNode;
}) {
  const [root, setRoot] = useState("");
  const [inspection, setInspection] = useState<RepositoryInspection>();
  const [plan, setPlan] = useState<RepositoryPlan>();
  const [sourceRoute, setSourceRoute] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const repositoryKey = `kaizen-native-repository:${activeProjectId}`;
  useEffect(() => {
    if (remoteRoot) setRoot(remoteRoot);
  }, [remoteRoot]);
  useEffect(() => {
    if (!existingPath && !remoteRoot) {
      try {
        setRoot(localStorage.getItem(repositoryKey) || "");
      } catch {
        /* Browser preferences may be unavailable. */
      }
    }
  }, [existingPath, repositoryKey, remoteRoot]);
  useEffect(() => {
    if (inspection) {
      try {
        localStorage.setItem(repositoryKey, inspection.root);
      } catch {
        /* Source and drafts are stored by the companion. */
      }
    }
  }, [inspection, repositoryKey]);
  useEffect(() => {
    if (!existingPath) return;
    let current = true;
    setBusy(true);
    storage
      .repository({ action: "repository-inspect-current" })
      .then((model: RepositoryInspection) => {
        if (!current) return;
        setRoot(model.root);
        setInspection(model);
        const file = model.routes.find(({ file }) => {
          const route = file
            .replace(/^src\/pages\//, "")
            .replace(/\.(astro|tsx|jsx)$/, "")
            .replace(/(?:^|\/)index$/, "");
          return (route ? `/${route}/` : "/") === existingPath;
        });
        if (!file)
          throw new Error(
            "This page uses live data or has moved. Check the website folder or open the CMS.",
          );
        setSourceRoute(file.file);
      })
      .catch((error) => {
        if (current) setError(error.message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [existingPath]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportSaved() {
    const workspace = await storage.loadBackupWorkspace();
    return exportProject(
      workspace.pages.map((p) => p.draft),
      workspace.assets,
      setStatus,
      undefined,
      workspace.site?.draft,
      undefined,
      workspace.routes?.draft,
      workspace,
    );
  }
  return (
    <>
      <Head
        info={<ProjectName />}
        title="Export & handoff"
        description="Download the finished website to host anywhere, or work directly with the website's code folder on this computer."
      />
      <div className="builder-page-body builder-repository">
        <Card
          title="Download the website"
          description="A ZIP with the finished website (upload the dist folder to any host) and its React source. It also includes an editable copy at .kaizen/project.zip so the project can be opened in the builder again later."
        >
          <div className="builder-row builder-actions">
            <button
              type="button"
              className="builder-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await exportSaved();
                  downloadProject(result.blob);
                  setStatus(
                    `Website exported. Read HANDOFF.md and EDITABILITY.md inside the ZIP.${result.warnings.length ? " HANDOFF.md also lists missing links and integration warnings to review." : ""}`,
                  );
                })
              }
            >
              <Download size={16} /> Download website ZIP
            </button>
          </div>
        </Card>
        {intro}
        {repositoryEnabled && (
          <>
            <Card
              title="Edit the website's code folder"
              description="For websites that live in a code folder (a Git repository, usually from GitHub Desktop). Point the builder at the folder to change page text and links, add builder pages, or build a preview. Nothing is installed, committed or published for you. Works with Astro + React sites, Kaizen exports and empty folders."
            >
              <form
                className="builder-inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    setPlan(undefined);
                    setSourceRoute(undefined);
                    setInspection(
                      await storage.repository({
                        action: "repository-inspect",
                        root,
                      }),
                    );
                  });
                }}
              >
                <label>
                  Website folder on this computer
                  <input
                    required
                    value={root}
                    readOnly={Boolean(remoteRoot)}
                    placeholder="/home/you/Documents/GitHub/client-site"
                    onChange={(event) => {
                      setRoot(event.target.value);
                      setInspection(undefined);
                      setPlan(undefined);
                      setSourceRoute(undefined);
                    }}
                  />
                </label>
                <button disabled={busy}>
                  <FolderSearch size={16} /> Check folder
                </button>
              </form>
              {inspection && (
                <div className="builder-inspection">
                  <p>
                    <strong>{inspection.framework}</strong> · {inspection.root}
                  </p>
                  <p className="builder-hint">{inspection.explanation}</p>
                  <ul className="builder-route-list">
                    {inspection.routes.map((route) => (
                      <li key={route.file}>
                        <code>{route.file}</code>
                        <Pill
                          tone={
                            route.ownership === "builder-editable"
                              ? "green"
                              : "grey"
                          }
                        >
                          {ownershipLabels[route.ownership] || route.ownership}
                        </Pill>
                        {route.ownership !== "builder-editable" &&
                          /\.(astro|tsx|jsx)$/.test(route.file) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setSourceRoute(route.file);
                                setPlan(undefined);
                              }}
                            >
                              Edit text and links
                            </button>
                          )}
                      </li>
                    ))}
                  </ul>
                  <div className="builder-row builder-actions">
                    <button
                      type="button"
                      disabled={busy || inspection.framework === "unsupported"}
                      onClick={() =>
                        void run(async () => {
                          const result = await exportSaved();
                          if (result.blob.size > 35 * 1024 * 1024)
                            throw new Error(
                              "Adding to a folder works for exports up to 35 MB. Download the website ZIP for anything larger.",
                            );
                          setPlan(
                            await storage.repository({
                              action: "repository-prepare",
                              root: inspection.root,
                              archive: await base64(result.blob),
                            }),
                          );
                          setStatus(
                            "Check each change below, then apply. Nothing has been written to the folder yet.",
                          );
                        })
                      }
                    >
                      Add builder pages to this folder
                    </button>
                    <button
                      type="button"
                      disabled={busy || inspection.framework === "unsupported"}
                      onClick={() =>
                        void run(async () => {
                          const project = await storage.repository({
                            action: "repository-open",
                            root: inspection.root,
                          });
                          const url = `/builder/?project=${encodeURIComponent(project.id)}`;
                          if (remoteOrigin)
                            location.assign(new URL(url, remoteOrigin).href);
                          else location.assign(url);
                        })
                      }
                    >
                      {remoteOrigin
                        ? "Open in the local builder"
                        : "Open folder as a new project"}
                    </button>
                  </div>
                  {remoteOrigin && (
                    <p className="builder-hint">
                      This opens the folder's saved builder copy as a separate
                      project in the local builder.
                    </p>
                  )}
                </div>
              )}
            </Card>
            {inspection && sourceRoute && (
              <SourcePageEditor
                key={`${inspection.root}:${sourceRoute}`}
                root={inspection.root}
                route={sourceRoute}
                onPlan={setPlan}
                onDirty={() => setPlan(undefined)}
                onClose={() => setSourceRoute(undefined)}
              />
            )}
            {plan && (
              <Card
                className="builder-review"
                ariaLabel="Changes to apply"
                title="Changes to apply"
                description={`${plan.root} · These files will change in the website folder. Check them, then apply. GitHub Desktop will show the changes; committing and publishing are separate steps.`}
              >
                <div className="builder-change-list">
                  {plan.changes
                    .filter((change) => change.action !== "unchanged")
                    .map((change) => (
                      <details key={change.file}>
                        <summary>
                          <strong>{change.action}</strong> · {change.file}
                          {change.conflict ? " — conflict" : ""}
                        </summary>
                        {change.conflict && (
                          <Notice tone="error">{change.conflict}</Notice>
                        )}
                        {change.preview && <pre>{change.preview}</pre>}
                      </details>
                    ))}
                </div>
                {plan.conflicts.length > 0 && (
                  <Notice tone="error">
                    {plan.conflicts.length} files already changed in the folder.
                    Sort those out in your code editor, then try again. Nothing
                    will be overwritten.
                  </Notice>
                )}
                <div className="builder-row builder-actions">
                  <button
                    type="button"
                    className="builder-primary"
                    disabled={busy || plan.conflicts.length > 0}
                    onClick={() =>
                      void run(async () => {
                        const result = await storage.repository({
                          action: "repository-apply",
                          planId: plan.id,
                        });
                        setPlan(undefined);
                        setSourceRoute(undefined);
                        setStatus(result.message);
                      })
                    }
                  >
                    Apply changes to the folder
                  </button>
                </div>
              </Card>
            )}
            {inspection &&
              ["astro-react", "kaizen-export"].includes(
                inspection.framework,
              ) && (
                <RepositoryBuild key={inspection.root} root={inspection.root} />
              )}
            <NativeRepositoryBackup
              approvedRoot={remoteRoot}
              root={
                inspection?.framework === "astro-react"
                  ? inspection.root
                  : undefined
              }
              onRestored={(restored) => {
                setRoot(restored);
                setInspection(undefined);
                setPlan(undefined);
                setSourceRoute(undefined);
                try {
                  localStorage.setItem(repositoryKey, restored);
                } catch {
                  /* Keep the restored path visible. */
                }
              }}
            />
          </>
        )}
        {busy && (
          <p role="status" className="builder-hint">
            {status || "Working…"}
          </p>
        )}
        {!busy && status && <Notice tone="success">{status}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </>
  );
}
