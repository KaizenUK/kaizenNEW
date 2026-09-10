import React, { useEffect, useRef, useState } from "react";
import { type Asset, type Workspace } from "../../shared/visualBuilder";
import {
  reviewAssetReplacement,
  type AssetReplacementReview,
} from "../../shared/builderLibrary";
import { prepareAsset } from "./assets";
import { storage } from "./storage";

export default function AssetReplacement({
  asset,
  assets,
  onAsset,
  prepareWorkspace,
  onComplete,
  notify,
}: {
  asset: Asset;
  assets: Asset[];
  onAsset: (asset: Asset) => void;
  prepareWorkspace: () => Promise<Workspace>;
  onComplete: (workspace: Workspace) => void;
  notify: (message: string) => void;
}) {
  const [target, setTarget] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<AssetReplacementReview>();
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (review) dialog.current?.showModal();
  }, [review]);
  const matches = assets.filter(
    (item) =>
      !item.generatedFrom &&
      item.id !== asset.id &&
      item.kind === asset.kind &&
      (item.id === target ||
        `${item.name} ${item.pack}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return (
    <section className="builder-asset-replacement">
      <strong>Replace in drafts</strong>
      <p>
        Keep the original file and published pages. Review where a replacement
        will be applied.
      </p>
      <input
        aria-label="Find replacement asset"
        placeholder="Find an existing replacement…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        aria-label="Replacement asset"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        disabled={busy}
      >
        <option value="">Choose an existing asset</option>
        {[
          ...matches.filter((item) => item.id === target),
          ...matches
            .filter((item) => item.id !== target)
            .slice(0, target ? 99 : 100),
        ].map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.pack}
          </option>
        ))}
      </select>
      {matches.length > 100 && (
        <small>Showing the first 100 matches. Search to narrow the list.</small>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Upload replacement file
      </button>
      <input
        aria-label="Replacement file"
        ref={input}
        type="file"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const prepared = await prepareAsset(
              { path: file.name, file },
              asset.pack,
            );
            if (prepared.asset.kind !== asset.kind)
              throw new Error(
                "Choose the same asset type: image, SVG icon or font.",
              );
            const existing = assets.find(
              (item) =>
                item.hash === prepared.asset.hash &&
                item.pack === prepared.asset.pack &&
                item.path === prepared.asset.path,
            );
            if (existing?.id === asset.id)
              throw new Error(
                "This is the original file. Choose a different replacement.",
              );
            const uploaded =
              existing ||
              (await storage.upload(prepared.asset, prepared.blob, (percent) =>
                setStatus(`Uploading replacement · ${percent}%`),
              ));
            onAsset(uploaded);
            setTarget(uploaded.id);
            setQuery("");
            setStatus(
              "Replacement uploaded. Review its draft usage before applying.",
            );
          } catch (error) {
            notify((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {status && <p role="status">{status}</p>}
      <button
        type="button"
        disabled={!target || busy}
        onClick={async () => {
          setBusy(true);
          try {
            setReview(
              reviewAssetReplacement(
                await prepareWorkspace(),
                asset.id,
                target,
              ),
            );
          } catch (error) {
            notify((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Review replacement
      </button>
      {review && (
        <dialog
          ref={dialog}
          className="builder-replacement-dialog"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setReview(undefined);
          }}
        >
          <h2>Replace {review.source.name} in drafts</h2>
          <p>
            Use <strong>{review.replacement.name}</strong> in these drafts.
            Published snapshots, revision history and both original files stay
            available.
          </p>
          <ul>
            {review.usage.pages
              .filter((page) => page.draft)
              .map((page) => (
                <li key={page.id}>
                  {page.title} · /{page.slug}/
                </li>
              ))}
          </ul>
          {!!review.usage.shared.length && (
            <p>
              Shared components:{" "}
              {review.usage.shared.map((item) => item.name).join(", ")}
            </p>
          )}
          {!!review.usage.saved.length && (
            <p>
              Saved sections/templates:{" "}
              {review.usage.saved.map((item) => item.name).join(", ")}
            </p>
          )}
          {review.usage.siteStyles && (
            <p>
              Shared site typography/background references will also change.
            </p>
          )}
          <p>
            You’ll return to Pages after replacement. Review the updated drafts,
            then publish explicitly.
          </p>
          <div className="builder-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                dialog.current?.close();
                setReview(undefined);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !(
                  review.usage.pages.some((page) => page.draft) ||
                  review.usage.shared.length ||
                  review.usage.saved.length ||
                  review.usage.siteStyles
                )
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await prepareWorkspace(); // Flush edits again; the transaction rejects a stale review.
                  onComplete(await storage.replaceAsset(review));
                } catch (error) {
                  setStatus((error as Error).message);
                  dialog.current?.close();
                  setReview(undefined);
                  notify((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Replacing…" : "Replace in drafts"}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
