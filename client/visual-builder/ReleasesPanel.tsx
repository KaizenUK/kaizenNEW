import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReleaseStatus } from "../../shared/builderReleases";
import type { Workspace } from "../../shared/visualBuilder";
import { storage } from "./storage";
import { Card, Head, Notice } from "./shell";
import { ProjectName } from "./activeProject";
import RepositoryPublish from "./RepositoryPublish";
import { mainReleaseStatus } from "./builderStatus";

const pending = (release: ReleaseStatus) =>
  [
    "queued",
    "building",
    "activating",
    "verifying",
    "recovery_required",
  ].includes(release.status);
export default function ReleasesPanel({
  workspace,
  onClose,
}: {
  workspace: Workspace;
  onClose: () => void;
}) {
  const [releases, setReleases] = useState<ReleaseStatus[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState<{
    action: "rollback" | "unpublish";
    id: string;
    label: string;
  }>();
  const mounted = useRef(true),
    reading = useRef(false);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const rows = await storage.releases();
      if (mounted.current) {
        setReleases(rows);
        setError("");
        setLoaded(true);
      }
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : "Release status could not be loaded. Try refreshing.",
        );
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const hasPending = releases.some(pending);
  async function run(action: () => Promise<{ message: string }>) {
    setBusy(true);
    setError("");
    try {
      const response = await action();
      if (mounted.current) {
        setMessage(response.message);
        setReview(undefined);
      }
      await refresh();
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error ? error.message : "Release request failed.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Head
        info={<ProjectName fallback="Kaizen workspace" />}
        title="Releases"
        help="releases"
      >
        <button type="button" onClick={() => void refresh()} disabled={busy}>
          Refresh status
        </button>
        <button type="button" onClick={onClose} disabled={busy}>
          Back to pages
        </button>
      </Head>
      <div className="builder-page-body">
        <RepositoryPublish />
        {!loaded && !error && (
          <p role="status" className="builder-hint">
            Loading release status…
          </p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        {review && (
          <Card
            className="builder-review"
            ariaLabel="Review release action"
            title={
              review.action === "rollback"
                ? "Restore an earlier live release"
                : "Unpublish this page"
            }
            description={review.label}
          >
            <p>
              {review.action === "rollback"
                ? "The entire public site returns to this retained release, including its rendered content and redirects. Your current drafts stay available."
                : "This page will leave the public site after the deployment succeeds. Its editable draft and revisions stay available. Links to its current URL may stop working."}
            </p>
            <button
              disabled={busy || !loaded || Boolean(error) || hasPending}
              className="builder-primary"
              onClick={() =>
                void run(async () => {
                  if (review.action === "rollback")
                    return storage.releaseAction({
                      action: "rollback",
                      targetId: review.id,
                      requestId: crypto.randomUUID(),
                    });
                  const current = await storage.load();
                  const page = current.pages.find(
                    (page) => page.id === review.id,
                  );
                  if (!page?.published)
                    throw new Error(
                      "This page no longer has a published version. Refresh the page list.",
                    );
                  return storage.releaseAction({
                    action: "unpublish",
                    id: page.id,
                    version: page.version,
                    requestId: crypto.randomUUID(),
                  });
                })
              }
            >
              {review.action === "rollback"
                ? "Queue rollback"
                : "Queue unpublish"}
            </button>
            <button disabled={busy} onClick={() => setReview(undefined)}>
              Cancel
            </button>
          </Card>
        )}
        <Card title="Release history">
          <ol className="builder-release-list" aria-label="Release history">
            {releases.map((release) => (
              <li key={release.id}>
                <div className="builder-row">
                  <strong title={mainReleaseStatus(release).detail}>
                    {mainReleaseStatus(release).label}
                  </strong>
                  <span>{new Date(release.createdAt).toLocaleString()}</span>
                </div>
                <p>
                  {release.action === "rollback"
                    ? "Rollback"
                    : release.action === "unpublish"
                      ? "Unpublish page"
                      : release.action === "site"
                        ? "Shared site design"
                        : release.action === "deploy"
                          ? "Site deployment"
                          : "Page publication"}{" "}
                  · <code>{release.id.slice(0, 8)}</code>
                </p>
                {release.error && <p>{release.error}</p>}
                {release.status === "queued" && (
                  <button
                    disabled={busy || Boolean(error)}
                    onClick={() =>
                      void run(() =>
                        storage.releaseAction({
                          action: "retry",
                          requestId: release.id,
                        }),
                      )
                    }
                  >
                    Retry dispatch
                  </button>
                )}
                {release.status === "live" && !release.live && (
                  <button
                    disabled={busy || Boolean(error) || hasPending}
                    onClick={() =>
                      setReview({
                        action: "rollback",
                        id: release.id,
                        label: `Release from ${new Date(release.createdAt).toLocaleString()} · ${release.id.slice(0, 8)}`,
                      })
                    }
                  >
                    Review rollback
                  </button>
                )}
              </li>
            ))}
          </ol>
          {loaded && !releases.length && (
            <p className="builder-empty">
              No releases yet. Publish a page or the site design to create the
              first one.
            </p>
          )}
        </Card>
        {workspace.pages.some((page) => page.published) && (
          <Card title="Published pages">
            <ul className="builder-release-list">
              {workspace.pages
                .filter((page) => page.published)
                .map((page) => (
                  <li key={page.id}>
                    <span>
                      {page.published!.title} · /{page.published!.slug}/
                    </span>
                    <button
                      disabled={busy || !loaded || Boolean(error) || hasPending}
                      onClick={() =>
                        setReview({
                          action: "unpublish",
                          id: page.id,
                          label: `${page.published!.title} · /${page.published!.slug}/`,
                        })
                      }
                    >
                      Review unpublish
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
