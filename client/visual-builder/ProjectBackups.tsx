import React, { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  makeRestorePlan,
  restoreExpected,
  type RestoreExpected,
  type RestorePlan,
} from "../../shared/builderBackup";
import type { Workspace } from "../../shared/visualBuilder";
import { usesSite } from "../../shared/builderSite";
import {
  createProjectBackup,
  openProjectBackup,
  restoreBackupAssets,
  type OpenBackup,
} from "./projectBackup";
import { storage } from "./storage";
import { Card, Head, Notice } from "./shell";
import { ProjectName } from "./activeProject";

/* An editable copy of the whole project, and a reviewed way to bring one back. */

export default function ProjectBackups({
  onWorkspace,
}: {
  onWorkspace: (workspace: Workspace) => void;
  onClose?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const [review, setReview] = useState<{
    backup: OpenBackup;
    current: Workspace;
    plan: RestorePlan;
    expected: RestoreExpected;
  }>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!busy) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [busy]);
  return (
    <>
      <Head
        info={<ProjectName />}
        title="Backups"
        description="Download an editable copy of this project, or restore one. A backup is different from a website export: it keeps everything editable in the builder."
      />
      <div className="builder-page-body">
        <Card
          title="Editable backup"
          description="Includes pages, shared design, revisions, saved sections, settings and the asset library. External media, CMS content and form services keep their connections; credentials, enquiries and deployed releases are not included."
        >
          <div className="builder-row builder-actions">
            <button
              type="button"
              className="builder-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                setStatus("Reading the saved project…");
                try {
                  const workspace = await storage.loadBackupWorkspace();
                  const blob = await createProjectBackup(workspace, setStatus);
                  const url = URL.createObjectURL(blob),
                    anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `kaizen-project-${new Date().toISOString().slice(0, 10)}.zip`;
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  setStatus(
                    `Backup downloaded: ${workspace.pages.length} pages, ${workspace.assets.length} assets.`,
                  );
                } catch (error) {
                  setError((error as Error).message);
                  setStatus("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={16} /> Download backup
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} /> Restore from a backup…
            </button>
            <input
              ref={input}
              aria-label="Project backup file"
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setBusy(true);
                setError("");
                setReview(undefined);
                try {
                  const backup = await openProjectBackup(file, setStatus),
                    current = await storage.loadBackupWorkspace(),
                    expected = restoreExpected(current);
                  const plan = makeRestorePlan(
                    current,
                    backup.manifest.workspace,
                    expected,
                  );
                  setReview({ backup, current, plan, expected });
                  setStatus("Archive checked. Review the draft changes below.");
                } catch (error) {
                  setError((error as Error).message);
                  setStatus("");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
          <p className="builder-hint">
            Backup format 1 · up to 500 pages, 20,000 assets and 500 MB per
            backup · 50 MB per file.
          </p>
        </Card>
        {status && <Notice tone="success">{status}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {review && (
          <Card
            className="builder-review"
            ariaLabel="Backup restore review"
            title="Restore saved drafts"
            description={`Backup from ${new Date(review.backup.manifest.createdAt).toLocaleString()} · ${review.plan.pages.length} pages · ${review.backup.manifest.workspace.assets.length} files · ${review.plan.saved.length} saved sections and templates`}
          >
            <ul className="builder-review-list">
              {review.plan.pages.map((page) => (
                <li key={page.id}>
                  <strong>{page.draft.title}</strong> · /{page.draft.slug}/ ·{" "}
                  {review.current.pages.some((item) => item.id === page.id)
                    ? "Replace matching draft"
                    : "Add as a draft"}
                </li>
              ))}
            </ul>
            {review.plan.settings && (
              <p>
                Restores settings: website{" "}
                {review.plan.settings.value.siteUrl || "not configured"}; form
                receiver {review.plan.settings.value.formEndpoint || "disabled"}
                ; CMS {review.plan.settings.value.cms.kind}. They apply to the
                next export or integration, so check they belong to this client.
              </p>
            )}
            {review.plan.site && (
              <p>
                Restores shared styles and{" "}
                {review.backup.manifest.workspace.site!.draft.components.length}{" "}
                shared components. Shared styles can affect every connected page
                draft, including pages outside this backup. Other shared
                definitions and tokens are kept.
              </p>
            )}
            {review.plan.site &&
              review.current.pages.some(
                (page) =>
                  !review.plan.pages.some((item) => item.id === page.id) &&
                  usesSite(page.draft),
              ) && (
                <details>
                  <summary>
                    Other page drafts connected to the shared design
                  </summary>
                  <ul>
                    {review.current.pages
                      .filter(
                        (page) =>
                          !review.plan.pages.some(
                            (item) => item.id === page.id,
                          ) && usesSite(page.draft),
                      )
                      .map((page) => (
                        <li key={page.id}>
                          {page.draft.title} · /{page.draft.slug}/
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            {review.plan.routes && (
              <p>
                Replaces the redirect draft with{" "}
                {review.plan.routes.draft.length} rules and restores its
                history. Published redirects stay as they are until you publish
                them separately.
              </p>
            )}
            <p className="builder-hint">
              Other pages stay in the project and current publications stay
              live. Previous drafts remain in revision history. Source and
              design files remain downloadable references; restoring never runs
              or registers code. Review the restored pages before publishing.
            </p>
            <div className="builder-row builder-actions">
              <button
                type="button"
                className="builder-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    // Preflight before uploads; the transaction checks the same review again afterwards.
                    const current = await storage.loadBackupWorkspace();
                    const check = restoreExpected(current);
                    if (
                      JSON.stringify(check) !== JSON.stringify(review.expected)
                    )
                      throw new Error(
                        "The workspace changed. Choose the backup again to review the latest drafts.",
                      );
                    const restored = await restoreBackupAssets(
                      review.backup,
                      current,
                      setStatus,
                    );
                    const plan = makeRestorePlan(
                      current,
                      restored.workspace,
                      review.expected,
                    );
                    plan.assetUpdates = restored.assetUpdates;
                    setStatus("Saving restored drafts…");
                    const next = await storage.restoreBackup(plan);
                    onWorkspace(next);
                    setReview(undefined);
                    setStatus(
                      `Restored ${plan.pages.length} editable page drafts. Nothing was published.`,
                    );
                  } catch (error) {
                    setError(
                      `${(error as Error).message} Any completed file uploads remain in the library and can be reused on retry.`,
                    );
                    setStatus("");
                    setReview(undefined);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Restoring…" : "Restore drafts"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReview(undefined);
                  setStatus("");
                }}
              >
                Cancel restore
              </button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
