import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RepositoryPublishStatus } from "../../shared/builderRepositoryPublish";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";
import { useActiveProject } from "./activeProject";
import { Card, Notice } from "./shell";

export default function RepositoryPublish() {
  const { project } = useActiveProject();
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  if (
    repositoryConnection.mode !== "hosted" ||
    !project?.access?.canPublish ||
    !("canPublishWebsite" in connection) ||
    !connection.canPublishWebsite
  )
    return null;
  return (
    <Publication
      key={`${project.id}:${connection.accountId}`}
      connected={connection.status === "connected"}
    />
  );
}
function Publication({ connected }: { connected: boolean }) {
  const [status, setStatus] = useState<RepositoryPublishStatus | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!connected) return;
    const version = ++generation.current;
    let current = true,
      timer: ReturnType<typeof setTimeout>;
    async function read() {
      try {
        const value = await storage.repository({
          action: "repository-publish-status",
        });
        if (!current || version !== generation.current) return;
        setStatus(value);
        if (
          value &&
          (value.phase === "uncertain" ||
            (value.phase === "sent" && value.delivery !== "reported"))
        )
          timer = setTimeout(read, 10000);
      } catch (error) {
        if (current && version === generation.current) setError(error.message);
      }
    }
    void read();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [connected, refresh, status?.phase]);
  async function run(action: string) {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const value = await storage.repository({
        action,
        ...(action === "repository-publish"
          ? { reviewId: status?.review.id }
          : {}),
      });
      if (mounted.current && version === generation.current) setStatus(value);
    } catch (error) {
      if (mounted.current && version === generation.current)
        setError(error.message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        setRefresh((value) => value + 1);
      }
    }
  }
  return (
    <section
      aria-label="Publish website changes"
      className="builder-repository-publish"
    >
      <Card
        title="Publish website changes"
        description="Review the saved website on staging before sending it to the live website."
      >
        {!connected && (
          <Notice>
            Reconnect the hosted helper to review or publish. Your saved staging
            changes are kept.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {status && (
          <>
            <p role="status">{status.message}</p>
            {status.error && <Notice tone="error">{status.error}</Notice>}
            <div className="builder-row">
              <a
                href={status.review.stagingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open staging
              </a>
              <a
                href={status.review.productionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open live website
              </a>
            </div>
            {status.release && (
              <p>
                {status.release.message}{" "}
                {status.release.url && (
                  <a href={status.release.url} target="_blank" rel="noreferrer">
                    Deployment details
                  </a>
                )}
              </p>
            )}
            {status.delivery && (
              <p role="status">
                {status.delivery === "reported"
                  ? "The live website reports this revision. Open it and check the page."
                  : status.delivery === "waiting"
                    ? "The live website is still reporting a different revision. Follow the deployment before checking your changes."
                    : "The live website's revision could not be checked. Open it or ask the owner to check deployment."}
              </p>
            )}
            <details>
              <summary>Publication details</summary>
              <p>
                Reviewed revision: <code>{status.review.commit}</code>
              </p>
              <p>
                Previous production revision:{" "}
                <code>{status.review.productionBase}</code>
              </p>
              <p>{status.review.files.length} website files changed:</p>
              <ul>
                {status.review.files.map((file) => (
                  <li key={file}>
                    <code>{file}</code>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        <div className="builder-row">
          <button
            type="button"
            disabled={busy || !connected || status?.phase === "uncertain"}
            onClick={() => void run("repository-publish-review")}
          >
            Review staged website
          </button>
          {status?.phase === "reviewed" && (
            <button
              type="button"
              className="builder-primary"
              disabled={busy || !connected}
              onClick={() => void run("repository-publish")}
            >
              {status.error
                ? "Retry publishing reviewed changes"
                : "Publish reviewed changes"}
            </button>
          )}
          {status && (
            <button
              type="button"
              disabled={busy || !connected}
              onClick={() => void run("repository-publish-status")}
            >
              Check publication state
            </button>
          )}
        </div>
      </Card>
    </section>
  );
}
