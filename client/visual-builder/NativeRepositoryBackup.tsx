import React, { useState } from "react";
import { storage } from "./storage";
import type { NativeBackupReview } from "../../scripts/builder-native-backup";

export default function NativeRepositoryBackup({
  root,
  onRestored,
}: {
  root?: string;
  onRestored: (root: string) => void;
}) {
  const [review, setReview] = useState<NativeBackupReview>();
  const [restoring, setRestoring] = useState(false);
  const [target, setTarget] = useState("");
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
      className="builder-card builder-project-card"
      aria-label="Native repository backup"
    >
      <h2>Back up or restore an existing repository</h2>
      <p>
        This separate backup preserves original source, public assets, package
        configuration and this project's saved source-editing drafts. It does
        not convert the site to builder blocks.
      </p>
      <p>
        Save or close open source editors first. Dependency folders, build
        output, Git history, private environment files and known credential
        files are excluded. Review the file list and exclusions. Limits: 35 MB
        ZIP, 200 MB source, 32 MB per file.
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
        Review native repository backup
      </button>
      <div>
        <label>
          Native repository backup ZIP
          <input
            type="file"
            accept=".zip"
            disabled={busy || Boolean(review)}
            onChange={(event) => setArchive(event.target.files?.[0])}
          />
        </label>
        <label>
          New restore folder
          <input
            value={target}
            disabled={busy || Boolean(review)}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Absolute path to a folder that does not exist"
          />
        </label>
        <p>
          The parent folder must already exist. Existing repositories are never
          replaced. Environment configuration and dependencies must be restored
          separately; no install, build or Git command runs automatically.
        </p>
        <button
          disabled={busy || !archive || !target || Boolean(review)}
          onClick={() =>
            void run(async () => {
              if (archive!.size > 35 * 1024 * 1024)
                throw new Error("Native backup ZIPs are limited to 35 MB.");
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
          Review native repository restore
        </button>
      </div>
      {review && (
        <div>
          <h3>
            {restoring
              ? "Restore to a new repository"
              : "Captured repository backup"}
          </h3>
          <p>{review.root}</p>
          <p>
            {review.files.length} files · {review.draftCount} saved editing
            drafts. Review expires in 15 minutes.
          </p>
          <details>
            <summary>Saved editing drafts and environment setup</summary>
            <ul>
              {review.drafts.map((draft) => (
                <li key={draft.route}>
                  {draft.route}
                  {!draft.sourcePresent &&
                    " — original page is absent; draft retained for recovery in the backup manifest"}
                </li>
              ))}
            </ul>
            <p>
              Environment variable names only; values are excluded:{" "}
              {review.environmentNames.join(", ") ||
                "None discovered in local environment files. Check the repository’s integration documentation."}
            </p>
          </details>
          <details>
            <summary>Included source and assets</summary>
            <ul>
              {review.files.map((file) => (
                <li key={file.file}>
                  <code>{file.file}</code> · {file.size.toLocaleString()} bytes
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Excluded files and folders</summary>
            {review.excluded.length ? (
              <ul>
                {review.excluded.map((file) => (
                  <li key={file}>
                    <code>{file}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No matching private or generated files were present.</p>
            )}
          </details>
          <button
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
                    `Restored ${result.files} source files and ${result.drafts} editing drafts into ${result.root}. Inspect this repository to resume editing.`,
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
                    "Native repository backup downloaded. Keep environment credentials separately.",
                  );
                }
              })
            }
          >
            {restoring
              ? "Restore reviewed native repository"
              : "Download reviewed native backup"}
          </button>
          <button disabled={busy} onClick={() => void run(discard)}>
            Discard native backup review
          </button>
        </div>
      )}
      {busy && <p role="status">Working on native repository backup…</p>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
