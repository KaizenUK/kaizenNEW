import React, { useEffect, useState } from "react";
import type { BuildJob, BuildPlan } from "../../scripts/builder-runner";
import { storage } from "./storage";
import { activeProjectId } from "./projectStorage";

export default function RepositoryBuild({ root }: { root: string }) {
  const [plan, setPlan] = useState<BuildPlan>();
  const [job, setJob] = useState<BuildJob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = `kaizen-build:${activeProjectId}:${root}`;
  const running = job?.status === "building";
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
          timer = setTimeout(poll, value.status === "building" ? 1000 : 10000);
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
    <div className="builder-card builder-project-card builder-repository-build">
      <h2>Build & local preview</h2>
      <p>
        Install this repository’s dependencies in your terminal first. Builds
        run its package scripts with your local user’s permissions and terminal
        environment. Inspect unfamiliar code before running it.
      </p>
      <p>
        The companion uses a fresh dist/ folder and retains previous output
        under .kaizen/build-recovery/. Failed builds restore the previous
        output. A successful build opens a private static snapshot on this
        computer for one hour. This does not deploy a site. Forms and network
        API calls are disabled in the preview.
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
        Review build command
      </button>
      {plan && (
        <div>
          <h3>Reviewed build command</h3>
          <p>
            <code>{plan.command}</code> in <code>{plan.root}</code>
          </p>
          <p>
            Package lifecycle scripts and imported build code may also run. The
            review expires after 15 minutes and must be repeated if source files
            change.
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
            Run reviewed build
          </button>
        </div>
      )}
      {job && (
        <div>
          <p role="status">
            {job.status === "building"
              ? "Building repository…"
              : job.status === "succeeded"
                ? "Build succeeded. Static output was verified over HTTP."
                : job.status === "cancelled"
                  ? "Build cancelled."
                  : "Build failed."}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          <p>
            Recovery folder: <code>{job.recoveryDirectory}</code>
          </p>
          {job.previewUrl && (
            <p>
              <a
                href={job.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open local website preview
              </a>{" "}
              · Expires {new Date(job.previewExpiresAt!).toLocaleTimeString()}
            </p>
          )}
          {job.status === "succeeded" && !job.previewUrl && (
            <p>
              Preview stopped or expired. Run another build to preview again.
            </p>
          )}
          {(running || job.previewUrl) && (
            <button
              disabled={busy}
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
              {running ? "Cancel build" : "Stop local preview"}
            </button>
          )}
          <details>
            <summary>Build log (last 100,000 characters)</summary>
            <pre>{job.log || "Waiting for build output…"}</pre>
          </details>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
