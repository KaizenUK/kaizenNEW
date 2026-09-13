import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { storage } from "./storage";
import { pendingClientRelease } from "../../shared/builderClientPublication";
import type {
  ClientDestination,
  ClientPublicationJob,
  ClientPublicationReview,
} from "../../shared/builderClientPublication";
import { Card, Head, Notice, Pill } from "./shell";
import { ProjectName } from "./activeProject";
import RepositoryPublish from "./RepositoryPublish";

/* Publishing a client project: choose a destination, review what goes live, then watch the release. */

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
const tones: Record<
  ClientPublicationJob["phase"],
  "grey" | "green" | "orange" | "blue" | "primary"
> = {
  queued: "blue",
  building: "blue",
  activating: "blue",
  verifying: "blue",
  live: "green",
  failed: "orange",
  rolled_back: "grey",
  recovery_required: "orange",
};
const actionLabels: Record<ClientPublicationJob["action"], string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  rollback: "Restore earlier release",
} as Record<ClientPublicationJob["action"], string>;

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
    <>
      <Head
        info={<ProjectName />}
        title="Releases"
        description="Publish the saved project to its destination and keep track of every release. Saving drafts, exporting the website and publishing are separate steps."
      >
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          <RefreshCw size={16} /> Refresh release status
        </button>
      </Head>
      <div className="builder-page-body">
        <RepositoryPublish />
        {!loaded && (
          <p role="status" className="builder-hint">
            Loading destinations and release history…
          </p>
        )}
        {loaded && !destinations.length && !error && !refreshError && (
          <Card
            title="No publishing destination yet"
            description="A server administrator needs to connect a dedicated staging or production host for this client. Projects can never publish over the Kaizen site. Setup is documented in docs/client-publication.md."
          />
        )}
        {!!destinations.length && (
          <Card
            title="Publish"
            description="Choose where this website goes live, then review exactly what the release contains."
          >
            <div className="builder-form">
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
                    <option
                      key={value.destinationId}
                      value={value.destinationId}
                    >
                      {value.label} · {value.environment} · {value.origin}
                    </option>
                  ))}
                </select>
              </label>
              {destination && (
                <p className="builder-hint">
                  <strong>{destination.environment}</strong> ·{" "}
                  <a href={destination.origin} target="_blank" rel="noreferrer">
                    {destination.origin}
                  </a>
                </p>
              )}
            </div>
            <div className="builder-row builder-actions">
              <button
                type="button"
                className="builder-primary"
                disabled={busy || !loaded || !destination || pending(selected)}
                onClick={() => void run(() => prepare("publish"))}
              >
                Review saved project for publication
              </button>
              <button
                type="button"
                disabled={busy || !loaded || !destination || pending(selected)}
                onClick={() => void run(() => prepare("unpublish"))}
              >
                Take website offline…
              </button>
            </div>
          </Card>
        )}
        {review && (
          <Card
            className="builder-review"
            title={`Review ${
              review.action === "publish"
                ? "publication"
                : review.action === "rollback"
                  ? "rollback"
                  : "unpublication"
            }`}
            description={`${review.destination.label} · ${review.destination.environment} · ${review.destination.origin}`}
          >
            <p>
              {review.action === "unpublish"
                ? "This replaces the website with an unavailable page. Its current URLs will return 404. Retained releases can be restored later."
                : "This release contains the pages below with shared styles, configured services and bundled assets. Anything saved after the release starts stays a draft."}
            </p>
            {review.action !== "unpublish" && (
              <ul className="builder-review-list">
                {review.pages.map((page) => (
                  <li key={page.id}>
                    {page.title} — /{page.slug}/
                  </li>
                ))}
              </ul>
            )}
            {!!review.warnings?.length && (
              <section
                aria-label="Publication checks"
                className="builder-review-warnings"
              >
                <h3>Check before publishing</h3>
                <p className="builder-hint">
                  These destinations or services are not part of this release.
                </p>
                <ul>
                  {review.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}
            <div className="builder-row builder-actions">
              <button
                type="button"
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
                      "Release requested. Follow its status below; it counts as live only after the served website is verified.",
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
              <button
                type="button"
                disabled={busy}
                onClick={() => setReview(undefined)}
              >
                Cancel review
              </button>
            </div>
          </Card>
        )}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {refreshError && <Notice tone="error">{refreshError}</Notice>}
        <Card
          title="Release history"
          description="Releases in progress stay visible on every page of the history."
        >
          <nav
            aria-label="Release history pages"
            className="builder-row builder-history-nav"
          >
            <button
              type="button"
              disabled={busy || cursors.length === 1}
              onClick={() => historyPage([null])}
            >
              Latest releases
            </button>
            <button
              type="button"
              disabled={busy || cursors.length === 1}
              onClick={() => historyPage(cursors.slice(0, -1))}
            >
              Newer releases
            </button>
            <button
              type="button"
              disabled={busy || !loaded || !nextCursor}
              onClick={() => historyPage([...cursors, nextCursor])}
            >
              Older releases
            </button>
            <span className="builder-hint">History page {cursors.length}.</span>
          </nav>
          {loaded && !jobs.length && !refreshError && (
            <p className="builder-empty">
              No releases have been requested for this project yet.
            </p>
          )}
          <div className="builder-release-cards">
            {jobs.map((job) => (
              <article
                className="builder-release-card"
                key={job.id}
                data-release-id={job.id}
              >
                <div className="builder-release-card-head">
                  <div>
                    <h3>
                      {job.destination.label} · {job.destination.environment}
                    </h3>
                    <p className="builder-hint">
                      {actionLabels[job.action] || job.action} ·{" "}
                      {new Date(job.createdAt).toLocaleString()} ·{" "}
                      {job.destination.origin}
                    </p>
                  </div>
                  <p role="status" className="builder-release-card-status">
                    <Pill tone={tones[job.phase]}>{labels[job.phase]}</Pill>
                    {job.active && <Pill tone="green">Live now</Pill>}
                  </p>
                </div>
                {job.error && <Notice tone="error">{job.error}</Notice>}
                {job.recoveryAvailable && (
                  <div className="builder-release-recovery">
                    <p className="builder-hint">
                      Recovery reloads this destination's selected release and
                      verifies its served output before updating the history.
                      Newer drafts are preserved.
                    </p>
                    <button
                      type="button"
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
                <div className="builder-row">
                  {job.active && (
                    <a
                      href={job.destination.origin}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open destination website{" "}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  )}
                  {job.phase === "live" && !job.active && (
                    <button
                      type="button"
                      disabled={busy || pending(job.destination.destinationId)}
                      onClick={() => void run(() => prepare("rollback", job))}
                    >
                      Review restoring this release
                    </button>
                  )}
                </div>
                <details>
                  <summary>Release log</summary>
                  <pre>{job.log || "Waiting for the publisher…"}</pre>
                </details>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
