import React, { useEffect, useState } from "react";
import type { BuildJob, BuildPlan } from "../../scripts/builder-runner";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";
import { activeProjectId } from "./projectStorage";

export default function RepositoryBuild({ root }: { root: string }) {
  const [plan, setPlan] = useState<BuildPlan>();
  const [job, setJob] = useState<BuildJob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = `kaizen-build:${activeProjectId}:${root}`;
  const running = job?.status === "building" || job?.status === "queued";
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let live = true;
    const id = sessionStorage.getItem(key);
    if (id)
      void storage
        .repository({ action: "repository-build-status", jobId: id })
        .then((value) => {
          if (live) setJob(value);
        })
        .catch(() => {
          if (live) sessionStorage.removeItem(key);
        });
    return () => {
      live = false;
    };
  }, [key]);
  useEffect(() => {
    if (!job || (!running && !job.previewUrl)) return;
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await storage.repository({
          action: "repository-build-status",
          jobId: job!.id,
        });
        if (live) {
          setJob(value);
          setError("");
          timer = setTimeout(
            poll,
            value.status === "building" || value.status === "queued"
              ? 1000
              : 10000,
          );
        }
      } catch (error) {
        if (live) {
          setError(`Build status unavailable: ${error.message}`);
          timer = setTimeout(poll, 5000);
        }
      }
    }
    timer = setTimeout(poll, running ? 1000 : 10000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [job?.id, running, Boolean(job?.previewUrl)]);
  return (
    <div className="builder-card builder-block builder-repository-build">
      <div className="builder-block-head">
        <h2>Preview the website</h2>
        <p>
          Builds the website from the folder and opens a private preview.
          Nothing goes live, and forms and network calls are switched off in the
          preview.
        </p>
      </div>
      <p className="builder-hint">
        {repositoryConnection.mode !== "hosted" &&
          "Install the folder's dependencies in your terminal first. "}
        The build runs the folder's own scripts, so check unfamiliar code before
        running it. The previous build is kept under .kaizen/build-recovery/ and
        put back if a build fails.
      </p>
      <button
        disabled={busy || running}
        onClick={() =>
          void run(async () => {
            setPlan(
              await storage.repository({
                action: "repository-build-review",
                root,
              }),
            );
          })
        }
      >
        Check build command
      </button>
      {plan && (
        <div className="builder-block-section">
          <h3>Build command</h3>
          <p>
            <code>{plan.command}</code> in <code>{plan.root}</code>
          </p>
          <p className="builder-hint">
            Other scripts in the folder may also run as part of the build. This
            check expires after 15 minutes, or sooner if files change.
          </p>
          <dl>
            {plan.scripts.map((script) => (
              <React.Fragment key={script.name}>
                <dt>{script.name}</dt>
                <dd>
                  <code>{script.command}</code>
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <button
            className="builder-primary"
            disabled={busy || running}
            onClick={() =>
              void run(async () => {
                const next = await storage.repository({
                  action: "repository-build-start",
                  planId: plan.id,
                });
                setJob(next);
                sessionStorage.setItem(key, next.id);
                setPlan(undefined);
              })
            }
          >
            Run build
          </button>
        </div>
      )}
      {job && (
        <div className="builder-block-section">
          <p role="status">
            {job.cancelling
              ? "Cancelling the build and restoring previous output…"
              : job.status === "queued"
                ? `Build queued. Position ${job.queuePosition || 1} for this website.`
                : job.status === "building"
                  ? "Building…"
                  : job.status === "succeeded"
                    ? job.previewUrl
                      ? "Build finished. The preview is ready."
                      : "Build finished."
                    : job.status === "cancelled"
                      ? "Build cancelled."
                      : "Build failed."}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.recoveryDirectory && (
            <p>
              Previous build kept at <code>{job.recoveryDirectory}</code>
            </p>
          )}
          {job.previewUrl && (
            <p>
              <button
                type="button"
                onClick={() => {
                  try {
                    repositoryConnection.openPreviewWindow(job.previewUrl!);
                  } catch (error) {
                    setError(error.message);
                  }
                }}
              >
                Open website preview
              </button>{" "}
              · Expires {new Date(job.previewExpiresAt!).toLocaleTimeString()}
            </p>
          )}
          {job.status === "succeeded" && !job.previewUrl && (
            <p>
              No preview is available. Check the helper connection before
              building again.
            </p>
          )}
          {(running || job.previewUrl) && (
            <button
              disabled={busy || job.cancelling}
              onClick={() =>
                void run(async () => {
                  setJob(
                    await storage.repository({
                      action: "repository-build-stop",
                      jobId: job.id,
                    }),
                  );
                })
              }
            >
              {running ? "Cancel build" : "Stop preview"}
            </button>
          )}
          <details>
            <summary>Build log</summary>
            <pre>{job.log || "Waiting for build output…"}</pre>
          </details>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
