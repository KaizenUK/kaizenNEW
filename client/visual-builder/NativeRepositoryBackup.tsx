import React, { useEffect, useState } from "react";
import { storage } from "./storage";
import type { NativeBackupReview } from "../../scripts/builder-native-backup";

export default function NativeRepositoryBackup({
  root,
  approvedRoot,
  onRestored,
}: {
  root?: string;
  approvedRoot?: string;
  onRestored: (root: string) => void;
}) {
  const [review, setReview] = useState<NativeBackupReview>();
  const [restoring, setRestoring] = useState(false);
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (approvedRoot) setTarget(approvedRoot);
  }, [approvedRoot]);
  const [archive, setArchive] = useState<File>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (review)
      await storage.repository({
        action: "repository-native-review-discard",
        reviewId: review.id,
      });
    setReview(undefined);
  }
  return (
    <section
      className="builder-card builder-block"
      aria-label="Native repository backup"
    >
      <div className="builder-block-head">
        <h2>Back up this folder</h2>
        <p>
          A ZIP of the website's code, images and settings files, plus any
          unapplied edits from this project. It is not a builder project; it
          restores a folder as it was.
        </p>
      </div>
      <p className="builder-hint">
        Close any open page editors first. Installed packages, build output, Git
        history, private settings and known password files are left out; check
        the file list before downloading. Limits: 35 MB ZIP, 200 MB of files, 32
        MB per file.
      </p>
      <button
        disabled={busy || !root}
        onClick={() =>
          void run(async () => {
            await discard();
            setRestoring(false);
            setReview(
              await storage.repository({
                action: "repository-native-backup-review",
                root,
              }),
            );
          })
        }
      >
        Prepare folder backup
      </button>
      <div className="builder-form">
        <h3>Restore a backup into a new folder</h3>
        <label>
          Backup ZIP file
          <input
            type="file"
            accept=".zip"
            disabled={busy || Boolean(review)}
            onChange={(event) => setArchive(event.target.files?.[0])}
          />
        </label>
        <label>
          New folder to restore into
          <input
            value={target}
            readOnly={Boolean(approvedRoot)}
            disabled={busy || Boolean(review)}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Full path to a folder that does not exist yet"
          />
        </label>
        <p className="builder-hint">
          The folder above it must already exist, and existing folders are never
          replaced. Private settings and installed packages are not included,
          and nothing is installed, built or committed for you.
        </p>
        {approvedRoot && (
          <p className="builder-hint">
            The backup restores into the folder you shared in the helper window.
            To restore somewhere else, open another builder tab and share a new
            folder there.
          </p>
        )}
        <button
          disabled={busy || !archive || !target || Boolean(review)}
          onClick={() =>
            void run(async () => {
              if (archive!.size > 35 * 1024 * 1024)
                throw new Error("Backup ZIP files are limited to 35 MB.");
              const encoded = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve(String(reader.result).split(",")[1]);
                reader.onerror = () =>
                  reject(new Error("The backup file could not be read."));
                reader.readAsDataURL(archive!);
              });
              setRestoring(true);
              setReview(
                await storage.repository({
                  action: "repository-native-restore-review",
                  root: target,
                  archive: encoded,
                }),
              );
            })
          }
        >
          Check backup file
        </button>
      </div>
      {review && (
        <div className="builder-block-section">
          <h3>{restoring ? "Ready to restore" : "Backup ready to download"}</h3>
          <p>{review.root}</p>
          <p>
            {review.files.length} files · {review.draftCount} unapplied edits.
            This check expires in 15 minutes.
          </p>
          <details>
            <summary>Unapplied edits and settings names</summary>
            <ul>
              {review.drafts.map((draft) => (
                <li key={draft.route}>
                  {draft.route}
                  {!draft.sourcePresent &&
                    " — its page is missing; the edits are kept in the backup for recovery"}
                </li>
              ))}
            </ul>
            <p>
              Names of private settings (values are never included):{" "}
              {review.environmentNames.join(", ") ||
                "none found in the folder's settings files."}
            </p>
          </details>
          <details>
            <summary>Files included</summary>
            <ul>
              {review.files.map((file) => (
                <li key={file.file}>
                  <code>{file.file}</code> · {file.size.toLocaleString()} bytes
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Files left out</summary>
            {review.excluded.length ? (
              <ul>
                {review.excluded.map((file) => (
                  <li key={file}>
                    <code>{file}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing needed leaving out.</p>
            )}
          </details>
          <div className="builder-row builder-actions">
            <button
              className="builder-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (restoring) {
                    const result = await storage.repository({
                      action: "repository-native-restore-apply",
                      reviewId: review.id,
                    });
                    setReview(undefined);
                    setStatus(
                      `Restored ${result.files} files and ${result.drafts} unapplied edits into ${result.root}. Check the folder to carry on editing.`,
                    );
                    onRestored(result.root);
                  } else {
                    const result = await storage.repository({
                      action: "repository-native-backup-download",
                      reviewId: review.id,
                    });
                    const bytes = Uint8Array.from(atob(result.archive), (c) =>
                      c.charCodeAt(0),
                    );
                    const url = URL.createObjectURL(
                      new Blob([bytes], { type: "application/zip" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "kaizen-native-repository.zip";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    setReview(undefined);
                    setStatus(
                      "Folder backup downloaded. Keep any passwords and keys separately.",
                    );
                  }
                })
              }
            >
              {restoring ? "Restore into new folder" : "Download folder backup"}
            </button>
            <button disabled={busy} onClick={() => void run(discard)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {busy && <p role="status">Working on the folder backup…</p>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
