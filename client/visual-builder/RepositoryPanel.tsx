import React, { useState } from "react";
import type {
  RepositoryInspection,
  RepositoryPlan,
} from "../../scripts/builder-repository";
import { storage } from "./storage";
import { exportProject, downloadProject } from "./exportProject";
import RepositoryBuild from "./RepositoryBuild";

async function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The export could not be read."));
    reader.readAsDataURL(blob);
  });
}
export default function RepositoryPanel() {
  const [root, setRoot] = useState("");
  const [inspection, setInspection] = useState<RepositoryInspection>();
  const [plan, setPlan] = useState<RepositoryPlan>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
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
    <section className="builder-panel-body builder-repository">
      <div className="builder-section-heading">
        <div>
          <h1>Export & local repositories</h1>
          <p>
            Deliver the selected project or integrate it into a repository
            cloned with GitHub Desktop.
          </p>
        </div>
      </div>
      <div className="builder-card builder-project-card">
        <h2>Website and editable source</h2>
        <p>
          The website ZIP contains independently buildable React source and
          static pages. Its separate .kaizen/project.zip backup preserves visual
          structure, original assets, shared content and history. Deploy only
          dist/.
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await exportSaved();
              downloadProject(result.blob);
              setStatus(
                `Website and editable source exported. Read HANDOFF.md and EDITABILITY.md.${result.warnings.length ? " Review the missing links and integration warnings in HANDOFF.md." : ""}`,
              );
            })
          }
        >
          Download website export
        </button>
      </div>
      <div className="builder-card builder-project-card">
        <h2>Local companion</h2>
        <p>
          This runs through your local Astro development server and can inspect
          folders on this computer. Hosted browsers cannot freely open local
          repositories. Supported: Astro + React, Kaizen exports and empty
          repositories. Arbitrary source pages remain code-managed.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              setPlan(undefined);
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
            Absolute repository folder
            <input
              required
              value={root}
              placeholder="C:\Users\you\Documents\GitHub\client-site"
              onChange={(event) => {
                setRoot(event.target.value);
                setInspection(undefined);
                setPlan(undefined);
              }}
            />
          </label>
          <button disabled={busy}>Inspect repository</button>
        </form>
        {inspection && (
          <>
            <p>
              <strong>{inspection.framework}</strong> · {inspection.root}
            </p>
            <p>{inspection.explanation}</p>
            <ul>
              {inspection.routes.map((route) => (
                <li key={route.file}>
                  <code>{route.file}</code> — {route.ownership}
                </li>
              ))}
            </ul>
            <div className="builder-project-actions">
              <button
                disabled={busy || inspection.framework === "unsupported"}
                onClick={() =>
                  void run(async () => {
                    const result = await exportSaved();
                    if (result.blob.size > 35 * 1024 * 1024)
                      throw new Error(
                        "The local browser integration supports exports up to 35 MB. Download the website ZIP for a larger handoff.",
                      );
                    setPlan(
                      await storage.repository({
                        action: "repository-prepare",
                        root: inspection.root,
                        archive: await base64(result.blob),
                      }),
                    );
                    setStatus(
                      "Review every proposed change before applying. Nothing has been written to the repository.",
                    );
                  })
                }
              >
                Prepare file proposal
              </button>
              <button
                disabled={busy || inspection.framework === "unsupported"}
                onClick={() =>
                  void run(async () => {
                    const project = await storage.repository({
                      action: "repository-open",
                      root: inspection.root,
                    });
                    location.assign(
                      `/builder/?project=${encodeURIComponent(project.id)}`,
                    );
                  })
                }
              >
                Reopen as a separate editable project
              </button>
            </div>
          </>
        )}
      </div>
      {inspection &&
        ["astro-react", "kaizen-export"].includes(inspection.framework) && (
          <RepositoryBuild key={inspection.root} root={inspection.root} />
        )}
      {plan && (
        <div className="builder-card builder-project-card">
          <h2>Proposed repository changes</h2>
          <p>{plan.root}</p>
          <p>
            Review in this panel, then apply. GitHub Desktop will show the
            resulting uncommitted changes. Saving, committing and deploying are
            separate actions.
          </p>
          {plan.changes
            .filter((change) => change.action !== "unchanged")
            .map((change) => (
              <details key={change.file}>
                <summary>
                  <strong>{change.action}</strong> · {change.file}
                  {change.conflict ? " — conflict" : ""}
                </summary>
                {change.conflict && <p role="alert">{change.conflict}</p>}
                {change.preview && <pre>{change.preview}</pre>}
              </details>
            ))}
          <button
            className="builder-primary"
            disabled={busy || plan.conflicts.length > 0}
            onClick={() =>
              void run(async () => {
                const result = await storage.repository({
                  action: "repository-apply",
                  planId: plan.id,
                });
                setPlan(undefined);
                setStatus(result.message);
              })
            }
          >
            Apply reviewed file changes
          </button>
          {plan.conflicts.length > 0 && (
            <p role="alert">
              Resolve {plan.conflicts.length} conflicts in your code editor and
              prepare a new proposal. Existing changes will not be overwritten.
            </p>
          )}
        </div>
      )}
      {busy && <p role="status">{status || "Working…"}</p>}
      {!busy && status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
