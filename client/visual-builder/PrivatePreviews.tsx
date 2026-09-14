import { activeProjectId } from "./projectStorage";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FormEndpointContext } from "./FormEndpointContext";
import { MediaContext } from "./MediaContext";
import { storage, localMode } from "./storage";
import {
  previewLink,
  type PreviewSummary,
  type PrivatePreview,
  type PreviewDuration,
} from "../../shared/builderPreviews";
import type { PageDocument } from "../../shared/visualBuilder";
import { previewHtml } from "./previewHtml";
import { Card, Head, Notice } from "./shell";
import { ProjectName } from "./activeProject";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The preview could not be loaded. Try again.";
export function PrivatePreviewControls({
  document,
}: {
  document?: PageDocument;
}) {
  const [hours, setHours] = useState<PreviewDuration>(24),
    [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<PreviewSummary>(),
    [notice, setNotice] = useState("");
  const request = useRef<string | undefined>(undefined);
  const inputKey = JSON.stringify({ document, hours });
  useEffect(() => {
    request.current = undefined;
  }, [inputKey]);
  const url = created
    ? previewLink(location.origin, created.id, activeProjectId)
    : "";
  return (
    <div className="builder-private-preview-controls">
      <p>
        Share a saved copy of this page with a private link.{" "}
        {localMode
          ? "Local links work on this computer while the builder is running."
          : "Links only work for signed-in editors."}{" "}
        Later edits do not change the saved copy.
      </p>
      <div className="builder-row">
        <label>
          Preview expires after{" "}
          <select
            aria-label="Preview expires after"
            value={hours}
            disabled={busy}
            onChange={(event) =>
              setHours(Number(event.target.value) as PreviewDuration)
            }
          >
            <option value={1}>1 hour</option>
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
          </select>
        </label>
        <button
          disabled={busy || !document}
          onClick={async () => {
            if (!document) return;
            setBusy(true);
            setNotice("");
            try {
              request.current ||= crypto.randomUUID();
              setCreated(
                await storage.createPreview(request.current, document, hours),
              );
              request.current = undefined;
            } catch (error) {
              setNotice(message(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving preview…" : "Save private preview link"}
        </button>
      </div>
      {created && (
        <div className="builder-private-preview-link">
          <label>
            Private preview link
            <input
              aria-label="Private preview link"
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <div className="builder-row">
            <a href={url} target="_blank" rel="noreferrer">
              Open saved preview
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setNotice("Preview link copied.");
                } catch {
                  setNotice("Select the link and copy it manually.");
                }
              }}
            >
              Copy link
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await storage.revokePreview(created.id);
                  setCreated(undefined);
                  request.current = undefined;
                  setNotice("Preview revoked.");
                } catch (error) {
                  setNotice(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Revoke link
            </button>
          </div>
          <p>Expires {new Date(created.expiresAt).toLocaleString()}.</p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

export function PrivatePreviewViewer({ id }: { id: string }) {
  const formEndpoint = useContext(FormEndpointContext);
  const media = useContext(MediaContext);
  const [record, setRecord] = useState<PrivatePreview>(),
    [error, setError] = useState("");
  const [width, setWidth] = useState(1280),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      reading = false;
    async function read() {
      if (reading) return;
      reading = true;
      try {
        const preview = await storage.readPreview(id);
        if (Date.parse(preview.expiresAt) <= Date.now())
          throw new Error(
            "This preview has expired. Ask an editor for a new preview.",
          );
        if (active) {
          setRecord((previous) =>
            previous?.id === preview.id ? previous : preview,
          );
          setError("");
        }
      } catch (error) {
        if (active) {
          setRecord(undefined);
          setError(message(error));
        }
      } finally {
        reading = false;
      }
    }
    setRecord(undefined);
    setError("");
    void read();
    const timer = setInterval(() => void read(), 10_000);
    const focus = () => void read();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [id, retry]);
  useEffect(() => {
    if (!record) return;
    const timer = setTimeout(
      () => {
        setRecord(undefined);
        setError("This preview has expired. Ask an editor for a new preview.");
      },
      Math.max(0, Date.parse(record.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [record]);
  const html = useMemo(
    () => (record ? previewHtml(media(record.document), formEndpoint) : ""),
    [record, media, formEndpoint],
  );
  return (
    <div className="builder-app builder-private-preview">
      <header>
        <div>
          <strong>Private preview{record ? ` · ${record.title}` : ""}</strong>
          <p>
            {record
              ? `Saved ${new Date(record.createdAt).toLocaleString()} · expires ${new Date(record.expiresAt).toLocaleString()}`
              : "Sign-in and preview access are checked before content is shown."}
          </p>
        </div>
        <a href="/builder/">Back to builder</a>
        {record && (
          <div className="builder-row">
            {[
              [1280, "Desktop"],
              [768, "Tablet"],
              [390, "Mobile"],
            ].map(([size, label]) => (
              <button
                key={size}
                aria-pressed={width === size}
                onClick={() => setWidth(Number(size))}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>
      {!record && !error && <p role="status">Opening saved preview…</p>}
      {error && (
        <div className="builder-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((value) => value + 1)}>
            Check again
          </button>
        </div>
      )}
      {record && (
        <>
          <p className="builder-private-preview-note">
            Saved preview · forms are in test mode.{" "}
            {localMode
              ? "Available only on this computer."
              : "Available to authorised editors only."}
          </p>
          <div className="builder-private-preview-canvas">
            <iframe
              title="Saved private page preview"
              sandbox="allow-same-origin allow-popups allow-scripts allow-forms"
              referrerPolicy="no-referrer"
              srcDoc={html}
              style={{ width, maxWidth: "100%" }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function PrivatePreviewList({ onClose }: { onClose?: () => void }) {
  const [rows, setRows] = useState<PreviewSummary[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(await storage.previews());
      setError("");
    } catch (error) {
      setError(message(error));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  void onClose;
  return (
    <>
      <Head info={<ProjectName />} title="Private previews" help="previews">
        <button type="button" onClick={() => void load()} disabled={busy}>
          Refresh previews
        </button>
      </Head>
      <div className="builder-page-body">
        {error && <Notice tone="error">{error}</Notice>}
        <Card
          title="Active preview links"
          description={
            rows.length
              ? "Revoking a link stops future visits; a copy someone already opened cannot be recalled."
              : undefined
          }
        >
          <ul className="builder-release-list">
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.title}</strong>
                <p>Expires {new Date(row.expiresAt).toLocaleString()}</p>
                <div className="builder-row">
                  <a
                    href={previewLink(location.origin, row.id, activeProjectId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open saved preview
                  </a>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await storage.revokePreview(row.id);
                        await load();
                      } catch (error) {
                        setError(message(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Revoke preview
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!rows.length && !error && (
            <p className="builder-empty">No active preview links.</p>
          )}
        </Card>
      </div>
    </>
  );
}
