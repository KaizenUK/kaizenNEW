import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { HostedRepositoryState } from "./hostedRepositoryConnection";
import type { RepositorySaveStatus } from "../../shared/builderRepositorySave";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";

type Props = {
  root: string;
  route?: string;
  appliedPlan?: string;
  disabled?: boolean;
  hasUnappliedChanges?: boolean;
  onCommit?: (commit: string) => void;
};
export default function RepositorySave(props: Props) {
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  if (
    repositoryConnection.mode !== "hosted" ||
    !("canSaveToWebsite" in connection) ||
    !connection.canSaveToWebsite
  )
    return null;
  return (
    <SaveControls
      key={`${connection.accountId}:${props.root}:${props.route || ""}`}
      {...props}
      connection={connection}
    />
  );
}
function SaveControls({
  root,
  route,
  appliedPlan,
  disabled = false,
  hasUnappliedChanges = false,
  onCommit,
  connection,
}: Props & { connection: HostedRepositoryState }) {
  const disconnected = connection.status !== "connected";
  const [status, setStatus] = useState<RepositorySaveStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Update website content"),
    [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    if (status?.commit) onCommit?.(status.commit);
  }, [status?.commit, onCommit]);
  const query = {
    action: "repository-save-status",
    root,
    ...(appliedPlan ? { planId: appliedPlan } : route ? { route } : {}),
  };
  useEffect(() => {
    if (disconnected) return;
    const version = ++generation.current;
    let current = true,
      timer: ReturnType<typeof setTimeout>;
    async function read() {
      try {
        const next = await storage.repository(query);
        if (!current || version !== generation.current) return;
        setStatus(next);
        if (
          next &&
          (next.phase === "committed" ||
            (next.phase === "saved" &&
              !["succeeded", "failed"].includes(next.release?.state)))
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
  }, [disconnected, root, route, appliedPlan, status?.phase, refresh]);
  if (!status && !error) return null;
  async function check() {
    setBusy(true);
    generation.current++;
    try {
      setStatus(await storage.repository(query));
      setError("");
      setRefresh((value) => value + 1);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="builder-repository-save" aria-label="Save to website">
      <div>
        <strong>Save to website</strong>
        {status ? (
          <p role="status">{status.message}</p>
        ) : (
          <p>
            Review and apply your changes, then save them to staging. Publish is
            a separate step.
          </p>
        )}
        {status?.phase === "applied" && (
          <p className="builder-hint">
            Sends the applied changes to staging. Publish is a separate step.
          </p>
        )}
        {hasUnappliedChanges && (
          <p className="builder-hint">
            Review and apply your new edits before saving to the website.
          </p>
        )}
        {(error || status?.error) && (
          <p role="alert">{error || status?.error}</p>
        )}
        {status?.release && (
          <p role="status" aria-label="Staging deployment">
            {status.release.message}
          </p>
        )}
      </div>
      {status && ["applied", "committed"].includes(status.phase) && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            generation.current++;
            setError("");
            try {
              setStatus(
                await storage.repository({
                  action: "repository-save",
                  root,
                  planId: status.planId,
                  message,
                }),
              );
              setRefresh((value) => value + 1);
            } catch (error) {
              setError(error.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {status.phase === "applied" && (
            <label>
              Change summary
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
              />
            </label>
          )}
          <button
            className="builder-primary"
            type="submit"
            disabled={busy || disabled || disconnected || hasUnappliedChanges}
          >
            {busy
              ? "Saving…"
              : status.phase === "committed"
                ? "Retry saving to website"
                : "Save to website"}
          </button>
        </form>
      )}
      <div className="builder-row">
        {(status || error) && (
          <button
            type="button"
            disabled={busy || disconnected}
            onClick={() => void check()}
          >
            Check saved state
          </button>
        )}
        {status?.phase === "saved" && (
          <a href={status.destinationUrl} target="_blank" rel="noreferrer">
            Open staging
          </a>
        )}
        {status?.release?.url && (
          <a href={status.release.url} target="_blank" rel="noreferrer">
            Deployment details
          </a>
        )}
      </div>
      {status && (
        <details>
          <summary>Save details</summary>
          <p>
            Branch {status.branch}
            {status.commit && (
              <>
                {" "}
                · Commit <code>{status.commit.slice(0, 12)}</code>
              </>
            )}
          </p>
          <ul>
            {status.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
