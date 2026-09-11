import React, { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "./storage";
import { pendingClientRelease } from "../../shared/builderClientPublication";
import type {
  ClientDestination,
  ClientPublicationJob,
  ClientPublicationReview,
} from "../../shared/builderClientPublication";
const labels: Record<ClientPublicationJob["phase"], string> = {
  queued: "Queued",
  building: "Building static website",
  activating: "Activating release",
  verifying: "Checking served output",
  live: "Verified release",
  failed: "Failed before publication",
  rolled_back: "Previous release restored",
  recovery_required: "Recovery needs attention",
};
export default function ClientPublications({
  onChanged,
}: {
  onChanged: () => void;
}) {
  const [destinations, setDestinations] = useState<ClientDestination[]>([]),
    [jobs, setJobs] = useState<ClientPublicationJob[]>([]);
  const [selected, setSelected] = useState(""),
    [review, setReview] = useState<ClientPublicationReview>();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refreshError, setRefreshError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  const mounted = useRef(true),
    refreshing = useRef(false),
    seen = useRef(""),
    changed = useRef(onChanged);
  changed.current = onChanged;
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    const before = cursor.current;
    refreshing.current = true;
    try {
      const data = await storage.clientPublication({
        action: "client-release-list",
        before,
      });
      if (!mounted.current || cursor.current !== before) return;
      setDestinations(data.destinations);
      setJobs([
        ...new Map<string, ClientPublicationJob>(
          [...(data.currentJobs || []), ...data.jobs].map((job) => [
            job.id,
            job,
          ]),
        ).values(),
      ]);
      setNextCursor(data.nextCursor || null);
      setLoaded(true);
      setRefreshError("");
      const signature = JSON.stringify(
        (data.currentJobs || data.jobs).map((job) => [
          job.id,
          job.phase,
          job.active,
        ]),
      );
      if (seen.current && seen.current !== signature) changed.current();
      seen.current = signature;
    } catch (error) {
      if (mounted.current && cursor.current === before) {
        setRefreshError(error.message);
        setLoaded(true);
      }
    } finally {
      refreshing.current = false;
      if (mounted.current && cursor.current !== before) void refresh();
    }
  }, []);
  function historyPage(stack: (string | null)[]) {
    cursor.current = stack[stack.length - 1];
    setCursors(stack);
    setNextCursor(null);
    setJobs([]);
    setLoaded(false);
    void refresh();
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 2000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function prepare(
    action: ClientPublicationJob["action"],
    job?: ClientPublicationJob,
  ) {
    const destinationId = job?.destination.destinationId || selected;
    setSelected(destinationId);
    setReview(
      await storage.clientPublication({
        action: "client-release-review",
        destinationId,
        releaseAction: action,
        rollbackOf: job?.id,
      }),
    );
  }
  const destination = destinations.find(
    (value) => value.destinationId === selected,
  );
  const pending = (destinationId: string) =>
    jobs.some(
      (job) =>
        job.destination.destinationId === destinationId &&
        pendingClientRelease(job),
    );
  return (
    <section className="builder-client-publications">
      <h1>Client releases</h1>
      <p>
        Publish a complete saved project to an explicit destination. Saving
        drafts, exporting a website and publishing are separate actions.
      </p>
      {!loaded && (
        <p role="status">Loading destinations and release history…</p>
      )}
      {loaded && !destinations.length && !error && !refreshError && (
        <div className="builder-card builder-project-card">
          <h2>No publication destination configured</h2>
          <p>
            A server administrator must connect a dedicated client staging or
            production host. This project cannot publish over Kaizen. Local
            setup is documented in docs/client-publication.md.
          </p>
        </div>
      )}
      {!!destinations.length && (
        <div className="builder-card builder-project-card">
          <h2>Publication destination</h2>
          <label>
            Choose destination
            <select
              value={selected}
              disabled={busy}
              onChange={(event) => {
                setSelected(event.target.value);
                setReview(undefined);
              }}
            >
              <option value="">Choose a destination…</option>
              {destinations.map((value) => (
                <option key={value.destinationId} value={value.destinationId}>
                  {value.label} · {value.environment} · {value.origin}
                </option>
              ))}
            </select>
          </label>
          {destination && (
            <p>
              <strong>{destination.environment}</strong> ·{" "}
              <a href={destination.origin} target="_blank" rel="noreferrer">
                {destination.origin}
              </a>
            </p>
          )}
          <div className="builder-project-actions">
            <button
              disabled={busy || !loaded || !destination || pending(selected)}
              onClick={() => void run(() => prepare("publish"))}
            >
              Review saved project for publication
            </button>
            <button
              disabled={busy || !loaded || !destination || pending(selected)}
              onClick={() => void run(() => prepare("unpublish"))}
            >
              Review unpublishing this website
            </button>
          </div>
        </div>
      )}
      {review && (
        <div className="builder-card builder-project-card">
          <h2>
            Review{" "}
            {review.action === "publish"
              ? "publication"
              : review.action === "rollback"
                ? "rollback"
                : "unpublication"}
          </h2>
          <p>
            <strong>
              {review.destination.label} · {review.destination.environment}
            </strong>
            <br />
            {review.destination.origin}
          </p>
          <p>
            {review.action === "unpublish"
              ? "Replaces this website with an unavailable page. Existing page routes will return 404. Retained releases can be restored."
              : "This release contains the pages below, shared styles, configured services and bundled assets. Changes saved after starting remain drafts."}
          </p>
          {review.action !== "unpublish" && (
            <ul>
              {review.pages.map((page) => (
                <li key={page.id}>
                  {page.title} — /{page.slug}/
                </li>
              ))}
            </ul>
          )}
          {!!review.warnings?.length && (
            <section aria-label="Publication checks">
              <h3>Check before publishing</h3>
              <p>
                These destinations or services are not supplied by this release.
              </p>
              <ul>
                {review.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}
          <div className="builder-project-actions">
            <button
              className="builder-primary"
              disabled={
                busy || !loaded || pending(review.destination.destinationId)
              }
              onClick={() =>
                void run(async () => {
                  const job = await storage.clientPublication({
                    action: "client-release-start",
                    reviewId: review.id,
                  });
                  setJobs((current) => [
                    job,
                    ...current.filter((item) => item.id !== job.id),
                  ]);
                  setReview(undefined);
                  setMessage(
                    "Release requested. Check its status below; success requires verification of the served website.",
                  );
                  if (cursor.current !== null) historyPage([null]);
                  await refresh();
                })
              }
            >
              {review.action === "publish"
                ? "Publish reviewed project"
                : review.action === "rollback"
                  ? "Restore reviewed release"
                  : "Unpublish reviewed website"}
            </button>
            <button disabled={busy} onClick={() => setReview(undefined)}>
              Cancel review
            </button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {refreshError && <p role="alert">{refreshError}</p>}
      <h2>Release history</h2>
      <button disabled={busy} onClick={() => void refresh()}>
        Refresh release status
      </button>
      <nav
        aria-label="Release history pages"
        className="builder-project-actions"
      >
        <button
          disabled={busy || cursors.length === 1}
          onClick={() => historyPage([null])}
        >
          Latest releases
        </button>
        <button
          disabled={busy || cursors.length === 1}
          onClick={() => historyPage(cursors.slice(0, -1))}
        >
          Newer releases
        </button>
        <button
          disabled={busy || !loaded || !nextCursor}
          onClick={() => historyPage([...cursors, nextCursor])}
        >
          Older releases
        </button>
      </nav>
      <p>
        History page {cursors.length}. Current releases remain visible on every
        page.
      </p>
      {loaded && !jobs.length && !refreshError && (
        <p>No releases have been requested for this project.</p>
      )}
      {jobs.map((job) => (
        <article
          className="builder-card builder-project-card"
          key={job.id}
          data-release-id={job.id}
        >
          <h3>
            {job.destination.label} · {job.destination.environment}
          </h3>
          <p role="status">
            {labels[job.phase]}
            {job.active ? " · Last verified baseline" : ""}
          </p>
          <p>
            {job.action} · {new Date(job.createdAt).toLocaleString()}
            <br />
            {job.destination.origin}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.recoveryAvailable && (
            <div>
              <p>
                Recovery reloads this destination's selected artifact and
                verifies its served output before updating publication history.
                Newer drafts are preserved.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await storage.clientPublication({
                      action: "client-release-recover",
                      jobId: job.id,
                    });
                    setReview(undefined);
                    setMessage(
                      "Recovery verified the selected website. Drafts were preserved.",
                    );
                    await refresh();
                    changed.current();
                  })
                }
              >
                Check and reconcile interrupted release
              </button>
            </div>
          )}
          {job.active && (
            <a href={job.destination.origin} target="_blank" rel="noreferrer">
              Open destination website
            </a>
          )}
          {job.phase === "live" && !job.active && (
            <button
              disabled={busy || pending(job.destination.destinationId)}
              onClick={() => void run(() => prepare("rollback", job))}
            >
              Review restoring this release
            </button>
          )}
          <details>
            <summary>Release log</summary>
            <pre>{job.log || "Waiting for the publisher…"}</pre>
          </details>
        </article>
      ))}
    </section>
  );
}
