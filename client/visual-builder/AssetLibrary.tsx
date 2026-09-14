import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Drawer } from "@puckeditor/core";
import { assetComponentName } from "./config";
import {
  FileArchive,
  Upload,
  Star,
  FileCode2,
  FileImage,
  Type,
  Search,
  Plus,
  Download,
} from "lucide-react";
import {
  type Asset,
  type Block,
  type Workspace,
} from "../../shared/visualBuilder";
import {
  assetUsage,
  type AssetMetadataPatch,
} from "../../shared/builderLibrary";
import {
  conversionLabels,
  conversionState,
} from "../../shared/builderConversions";
import ConversionPanel from "./ConversionPanel";
import AssetReplacement from "./AssetReplacement";
import {
  droppedFiles,
  expandFiles,
  kindLabels,
  prepareAsset,
  type ImportFile,
} from "./assets";
import { storage } from "./storage";
import { MediaContext } from "./MediaContext";
import { useContext } from "react";
import { importQueue, withImportLock, type ImportJob } from "./importQueue";
export function downloadText(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function AssetLibrary({
  assets,
  workspace,
  prepareWorkspace,
  onReplacementComplete,
  onAsset,
  onAssets,
  onUse,
  onUseBlock,
  notify,
  compact = true,
}: {
  assets: Asset[];
  workspace: Workspace;
  prepareWorkspace: () => Promise<Workspace>;
  onReplacementComplete: (workspace: Workspace) => void;
  onAsset: (asset: Asset) => void;
  onAssets: (assets: Asset[]) => void;
  onUse: (asset: Asset) => void;
  onUseBlock: (block: Block) => void;
  notify: (message: string) => void;
  /** Compact is the editor's side panel; the full page gets a rail and a wide grid. */
  compact?: boolean;
}) {
  const media = useContext(MediaContext);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [packFilter, setPackFilter] = useState("");
  const [pack, setPack] = useState("Imported files");
  const [favourites, setFavourites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(!assets.length);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(0);
  const [conversionFilter, setConversionFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("add-tags");
  const [bulkValue, setBulkValue] = useState("");
  const [metadataBusy, setMetadataBusy] = useState(false);
  const detailNode = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  useEffect(() => {
    setPage(0);
    setChecked(new Set());
  }, [query, kind, packFilter, favourites, sort, conversionFilter]);
  useEffect(() => {
    if (selected) detailNode.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const controller = useRef<AbortController>(undefined);
  const [pendingJob, setPendingJob] = useState<ImportJob>();
  const [queueReady, setQueueReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const scope = useRef<string>(undefined);
  useEffect(() => {
    let mounted = true;
    setQueueReady(false);
    setRecoveryError("");
    void storage
      .uploadScope()
      .then(async (value) => {
        scope.current = value;
        const job = await importQueue.load(value);
        if (mounted) {
          setPendingJob(job);
          setQueueReady(true);
          if (job) {
            setStatus("Pending import recovered. Resume when you are ready.");
            setProgress(
              Math.round(
                (job.entries.filter((entry) =>
                  ["uploaded", "duplicate"].includes(entry.state),
                ).length /
                  Math.max(1, job.entries.length)) *
                  100,
              ),
            );
            setErrors(
              job.entries
                .filter((entry) => entry.error)
                .map((entry) => `${entry.path}: ${entry.error}`),
            );
            setImportOpen(false);
          }
        }
      })
      .catch((error) => {
        if (mounted) setRecoveryError((error as Error).message);
      });
    return () => {
      mounted = false;
      controller.current?.abort();
    };
  }, [recoveryAttempt]);
  const updateJob = (job: ImportJob) =>
    setPendingJob({ ...job, entries: [...job.entries] });
  async function runEntries(job: ImportJob, signal: AbortSignal) {
    const failures: string[] = [];
    const latest = await storage.load();
    onAssets(latest.assets);
    const known = new Set(
      latest.assets
        .filter((asset) => !asset.generatedFrom)
        .map((asset) => JSON.stringify([asset.hash, asset.pack, asset.path])),
    );
    for (const [index, entry] of job.entries.entries()) {
      if (["uploaded", "duplicate"].includes(entry.state)) continue;
      signal.throwIfAborted();
      entry.state = "pending";
      delete entry.error;
      setStatus(`${index + 1} of ${job.entries.length} · ${entry.path}`);
      try {
        let blob = await importQueue.file(job, index);
        if (!entry.asset) {
          const prepared = await prepareAsset(
            { path: entry.path, file: blob },
            job.pack,
          );
          entry.asset = prepared.asset;
          blob = prepared.blob;
          await importQueue.prepared(job, index, blob);
        }
        signal.throwIfAborted();
        const key = JSON.stringify([
          entry.asset.hash,
          entry.asset.pack,
          entry.asset.path,
        ]);
        if (known.has(key)) entry.state = "duplicate";
        else {
          const uploaded = await storage.upload(
            entry.asset,
            blob,
            (percent) =>
              setProgress(
                Math.round(
                  ((index + percent / 100) / job.entries.length) * 100,
                ),
              ),
            {
              signal,
              scope: job.scope,
              recover: true,
              uploadUrl: entry.uploadUrl,
              onUploadUrl: async (url) => {
                entry.uploadUrl = url;
                await importQueue.save(job);
              },
            },
          );
          known.add(key);
          onAsset(uploaded);
          entry.state = "uploaded";
        }
        await importQueue.completed(job, index);
      } catch (error) {
        if (signal.aborted) {
          await importQueue.save(job);
          updateJob(job);
          throw error;
        }
        entry.state = "error";
        entry.error = (error as Error).message;
        failures.push(`${entry.path}: ${entry.error}`);
        await importQueue.save(job);
        setErrors([...failures]);
      }
      updateJob(job);
      setProgress(Math.round(((index + 1) / job.entries.length) * 100));
    }
    const imported = job.entries.filter(
      (entry) => entry.state === "uploaded",
    ).length;
    const duplicates = job.entries.filter(
      (entry) => entry.state === "duplicate",
    ).length;
    setStatus(
      `${imported} imported · ${duplicates} duplicates skipped · ${failures.length} errors`,
    );
    if (!failures.length) {
      await importQueue.discard(job);
      setPendingJob(undefined);
      setImportOpen(false);
    }
  }
  async function processImport(files?: ImportFile[]) {
    if (running.current) return;
    if (!queueReady || !scope.current) {
      notify("Upload recovery is still opening. Try again shortly.");
      return;
    }
    running.current = true;
    setBusy(true);
    setErrors([]);
    if (files) setProgress(0);
    const abort = new AbortController();
    controller.current = abort;
    try {
      await withImportLock(scope.current, async () => {
        let job = await importQueue.load(scope.current!);
        if (files) {
          if (job) {
            updateJob(job);
            throw new Error(
              "Resume or discard the pending import before starting another pack.",
            );
          }
          const entries = await expandFiles(files, setStatus);
          abort.signal.throwIfAborted();
          job = await importQueue.create(scope.current!, pack, entries);
        }
        if (!job) {
          setPendingJob(undefined);
          throw new Error(
            "This import was completed or discarded in another tab.",
          );
        }
        updateJob(job);
        setImportOpen(false);
        await runEntries(job, abort.signal);
      });
    } catch (error) {
      if (abort.signal.aborted)
        setStatus(
          "Import paused. Completed files are safe; resume the remaining files when ready.",
        );
      else {
        setErrors([(error as Error).message]);
        setStatus("Import needs attention");
      }
    } finally {
      setBusy(false);
      running.current = false;
    }
  }
  async function importPack(files: ImportFile[]) {
    await processImport(files);
  }
  async function discardImport() {
    if (!pendingJob || busy) return;
    try {
      await withImportLock(pendingJob.scope, async () => {
        const current = await importQueue.load(pendingJob.scope);
        if (current) await importQueue.discard(current);
        setPendingJob(undefined);
        setErrors([]);
        setStatus(
          "Pending files removed from this browser. Completed library assets were kept.",
        );
      });
    } catch (error) {
      notify((error as Error).message);
    }
  }
  async function sample() {
    try {
      const response = await fetch("/builder-samples/sample-pack.zip");
      if (!response.ok) throw new Error("Sample pack unavailable");
      await importPack([
        { path: "sample-pack.zip", file: await response.blob() },
      ]);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  const visible = useMemo(
    () =>
      assets
        .filter(
          (a) =>
            !a.generatedFrom &&
            (!kind || a.kind === kind) &&
            (!conversionFilter ||
              conversionState(a, assets) === conversionFilter) &&
            (!packFilter || a.pack === packFilter) &&
            (!favourites || a.favourite) &&
            `${a.name} ${a.path} ${a.pack} ${a.originalPack || ""} ${a.tags.join(" ")}`
              .toLowerCase()
              .includes(deferredQuery.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (sort === "name"
              ? a.name.localeCompare(b.name)
              : sort === "size"
                ? b.size - a.size
                : b.createdAt.localeCompare(a.createdAt)) ||
            a.id.localeCompare(b.id),
        ),
    [
      assets,
      kind,
      packFilter,
      favourites,
      deferredQuery,
      sort,
      conversionFilter,
    ],
  );
  const pageIndex = Math.min(
    page,
    Math.max(0, Math.ceil(visible.length / 48) - 1),
  );
  const pageAssets = visible.slice(pageIndex * 48, (pageIndex + 1) * 48);
  const detail = assets.find((a) => a.id === selected);
  const usage = useMemo(
    () => (detail ? assetUsage(workspace, detail) : undefined),
    [workspace, detail],
  );
  async function applyBulk() {
    const targets = assets.filter((asset) => checked.has(asset.id));
    if (!targets.length) return;
    const tags = bulkValue
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (
      ["add-tags", "remove-tags", "pack"].includes(bulkAction) &&
      !bulkValue.trim()
    ) {
      notify("Enter tags or a pack name first.");
      return;
    }
    setMetadataBusy(true);
    try {
      const changes = targets.map((asset) => {
        const patch: AssetMetadataPatch =
          bulkAction === "pack"
            ? { pack: bulkValue }
            : bulkAction === "favourite"
              ? { favourite: true }
              : bulkAction === "unfavourite"
                ? { favourite: false }
                : {
                    tags:
                      bulkAction === "add-tags"
                        ? [...new Set([...asset.tags, ...tags])]
                        : asset.tags.filter((tag) => !tags.includes(tag)),
                  };
        return { id: asset.id, expected: asset, patch };
      });
      onAssets(await storage.updateAssetMetadata(changes));
      setChecked(new Set());
      setBulkValue("");
      notify(`${targets.length} assets updated.`);
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setMetadataBusy(false);
    }
  }
  return (
    <div className={`builder-library${compact ? "" : " builder-library-wide"}`}>
      <div className="builder-library-rail">
        <div
          className="builder-import-surface"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={async (e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setImportOpen(true);
            try {
              await importPack(await droppedFiles(e.dataTransfer));
            } catch (error) {
              notify((error as Error).message);
            }
          }}
        >
          <button
            type="button"
            aria-expanded={importOpen}
            aria-controls="builder-import-panel"
            onClick={() => setImportOpen(!importOpen)}
          >
            <Upload size={15} /> Import assets
          </button>
          <div
            id="builder-import-panel"
            className="builder-drop"
            hidden={!importOpen}
          >
            <FileArchive size={26} />
            <strong>Add files to this project</strong>
            <span>Drop a ZIP, a folder or single files here</span>
            <label className="builder-pack-name">
              Pack name
              <input
                aria-label="Pack name"
                value={pack}
                onChange={(e) => setPack(e.target.value)}
                disabled={busy || !!pendingJob || !queueReady}
              />
            </label>
            <div className="builder-row">
              <button
                disabled={busy || !!pendingJob || !queueReady}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={14} /> Upload
              </button>
              <button
                disabled={busy || !!pendingJob || !queueReady}
                onClick={() => folderInput.current?.click()}
              >
                Folder
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                void importPack(
                  Array.from(e.target.files || []).map((file) => ({
                    path: file.name,
                    file,
                  })),
                );
                e.target.value = "";
              }}
            />
            <input
              ref={folderInput}
              type="file"
              multiple
              hidden
              {...({ webkitdirectory: "" } as any)}
              onChange={(e) => {
                void importPack(
                  Array.from(e.target.files || []).map((file) => ({
                    path: file.webkitRelativePath || file.name,
                    file,
                  })),
                );
                e.target.value = "";
              }}
            />
            <button
              disabled={busy || !!pendingJob || !queueReady}
              className="builder-text-button"
              onClick={sample}
            >
              Try the sample asset pack
            </button>
            <small>50 MB per file · 250 MB per ZIP · 500 MB per batch</small>
          </div>
        </div>
        {status && (
          <div role="status" className="builder-import-status">
            <span>{status}</span>
            <progress max={100} value={progress} aria-label="Import progress" />
          </div>
        )}
        {recoveryError && (
          <div role="alert" className="builder-upload-recovery">
            <p>{recoveryError}</p>
            <button onClick={() => setRecoveryAttempt((value) => value + 1)}>
              Retry upload recovery
            </button>
          </div>
        )}
        {pendingJob && (
          <section
            className="builder-upload-recovery"
            aria-label="Upload recovery"
          >
            <strong>{pendingJob.pack}</strong>
            <p>
              {
                pendingJob.entries.filter((entry) =>
                  ["uploaded", "duplicate"].includes(entry.state),
                ).length
              }{" "}
              of {pendingJob.entries.length} files complete ·{" "}
              {
                pendingJob.entries.filter((entry) => entry.state === "error")
                  .length
              }{" "}
              need attention
            </p>
            <p>
              Pending files are kept in this browser. Large files resume from
              the last server checkpoint; completed assets stay in your library.
            </p>
            <div className="builder-row">
              {busy ? (
                <button onClick={() => controller.current?.abort()}>
                  Pause import
                </button>
              ) : (
                <button onClick={() => void processImport()}>
                  Resume import
                </button>
              )}
              <button disabled={busy} onClick={() => void discardImport()}>
                Discard pending import
              </button>
            </div>
            <details>
              <summary>File progress</summary>
              <ul>
                {pendingJob.entries.slice(0, 48).map((entry, index) => (
                  <li key={index}>
                    {entry.path} ·{" "}
                    {entry.state === "pending"
                      ? "Waiting or uploading"
                      : entry.state}
                    {entry.error && ` — ${entry.error}`}
                  </li>
                ))}
              </ul>
              {pendingJob.entries.length > 48 && (
                <p>Showing the first 48 files. Any errors are listed below.</p>
              )}
            </details>
          </section>
        )}
        {!!errors.length && (
          <details open className="builder-error">
            <summary>{errors.length} files need attention</summary>
            {errors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
            <small>
              Resume to retry pending files. For damaged files, discard this
              pending import and select the corrected pack. Completed files will
              be skipped.
            </small>
          </details>
        )}
        <div className="builder-search">
          <Search size={15} />
          <input
            placeholder="Search assets, tags, packs…"
            aria-label="Search assets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="builder-row">
          <select
            aria-label="Asset type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All types</option>
            {Object.entries(kindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            title="Favourites only"
            aria-pressed={favourites}
            onClick={() => setFavourites(!favourites)}
          >
            <Star size={15} fill={favourites ? "currentColor" : "none"} />
          </button>
        </div>
        <select
          aria-label="Filter by pack"
          value={packFilter}
          onChange={(e) => setPackFilter(e.target.value)}
        >
          <option value="">All packs</option>
          {Array.from(
            new Set(assets.filter((a) => !a.generatedFrom).map((a) => a.pack)),
          ).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Filter conversions"
          value={conversionFilter}
          onChange={(e) => setConversionFilter(e.target.value)}
        >
          <option value="">All conversion statuses</option>
          <option value="available">Reviewed block available</option>
          {Object.entries(conversionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="builder-library-tools">
          <label>
            Sort assets
            <select
              aria-label="Sort assets"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest files</option>
            </select>
          </label>
          <button
            type="button"
            disabled={metadataBusy}
            onClick={async () => {
              try {
                onAssets((await prepareWorkspace()).assets);
                notify("Library refreshed.");
              } catch (error) {
                notify((error as Error).message);
              }
            }}
          >
            Refresh library
          </button>
          <div className="builder-row">
            <button
              type="button"
              disabled={!pageAssets.length}
              onClick={() =>
                setChecked(
                  new Set(
                    [
                      ...new Set([
                        ...checked,
                        ...pageAssets.map((asset) => asset.id),
                      ]),
                    ].slice(0, 2000),
                  ),
                )
              }
            >
              Select this page
            </button>
            {!!checked.size && (
              <button type="button" onClick={() => setChecked(new Set())}>
                Clear selection
              </button>
            )}
          </div>
          {!!checked.size && (
            <fieldset disabled={metadataBusy} className="builder-bulk-actions">
              <legend>{checked.size} selected</legend>
              {checked.size === 2000 && (
                <small>
                  Batch limit reached. Apply these changes before selecting more
                  assets.
                </small>
              )}
              {visible.length > checked.size && visible.length <= 2000 && (
                <button
                  type="button"
                  onClick={() =>
                    setChecked(new Set(visible.map((asset) => asset.id)))
                  }
                >
                  Select all {visible.length} matches
                </button>
              )}
              <select
                aria-label="Bulk asset action"
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
              >
                <option value="add-tags">Add tags</option>
                <option value="remove-tags">Remove tags</option>
                <option value="pack">Move to pack</option>
                <option value="favourite">Add to favourites</option>
                <option value="unfavourite">Remove from favourites</option>
              </select>
              {["add-tags", "remove-tags", "pack"].includes(bulkAction) && (
                <input
                  aria-label={
                    bulkAction === "pack" ? "Move assets to pack" : "Bulk tags"
                  }
                  placeholder={
                    bulkAction === "pack"
                      ? "Pack name"
                      : "Tags, separated by commas"
                  }
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                />
              )}
              <button type="button" onClick={() => void applyBulk()}>
                Apply to selected assets
              </button>
            </fieldset>
          )}
        </div>
      </div>
      <div className="builder-library-main">
        <p className="builder-hint">
          {visible.length} {visible.length === 1 ? "asset" : "assets"}
        </p>
        {visible.length > 48 && (
          <nav className="builder-asset-pagination" aria-label="Asset pages">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => setPage(pageIndex - 1)}
            >
              Previous assets
            </button>
            <span>
              {pageIndex * 48 + 1}–
              {Math.min((pageIndex + 1) * 48, visible.length)} of{" "}
              {visible.length}
            </span>
            <button
              type="button"
              disabled={(pageIndex + 1) * 48 >= visible.length}
              onClick={() => setPage(pageIndex + 1)}
            >
              Next assets
            </button>
          </nav>
        )}
        <Drawer>
          <div className="builder-assets">
            {pageAssets.map((asset) => (
              <article
                key={asset.id}
                className={`builder-asset ${selected === asset.id ? "selected" : ""}`}
              >
                <input
                  className="builder-asset-select"
                  type="checkbox"
                  aria-label={`Select ${asset.name}`}
                  checked={checked.has(asset.id)}
                  disabled={checked.size >= 2000 && !checked.has(asset.id)}
                  onChange={(event) => {
                    const next = new Set(checked);
                    if (event.target.checked) next.add(asset.id);
                    else next.delete(asset.id);
                    setChecked(next);
                  }}
                />
                {["image", "icon"].includes(asset.kind) ? (
                  <Drawer.Item
                    name={assetComponentName(asset)}
                    label={asset.name}
                  >
                    {() => (
                      <div
                        className="builder-asset-preview"
                        title={`Drag ${asset.name} onto the page`}
                      >
                        <img
                          src={media(
                            asset.image?.variants[0]?.url || asset.url,
                          )}
                          alt={asset.name}
                          loading="lazy"
                        />
                      </div>
                    )}
                  </Drawer.Item>
                ) : (
                  <button
                    className="builder-asset-preview"
                    onClick={() => setSelected(asset.id)}
                    aria-label={`Inspect ${asset.name}`}
                  >
                    {["image", "icon"].includes(asset.kind) ? (
                      <img
                        src={media(asset.url)}
                        alt={asset.name}
                        loading="lazy"
                      />
                    ) : asset.kind === "font" ? (
                      <Type size={34} />
                    ) : asset.kind === "code" ? (
                      <FileCode2 size={34} />
                    ) : (
                      <FileImage size={34} />
                    )}
                  </button>
                )}
                <button
                  className="builder-asset-name"
                  title={asset.path}
                  onClick={() => setSelected(asset.id)}
                  aria-label={`Details for ${asset.name}`}
                >
                  {asset.name}
                </button>
                <small>{kindLabels[asset.kind]}</small>
                {asset.conversion && (
                  <small>
                    {conversionState(asset, assets) === "available"
                      ? "Reviewed block available"
                      : conversionLabels[asset.conversion.status]}
                  </small>
                )}
                <div className="builder-row">
                  <button
                    aria-label={`Favourite ${asset.name}`}
                    aria-pressed={asset.favourite}
                    onClick={async () => {
                      try {
                        onAssets(
                          await storage.updateAssetMetadata([
                            {
                              id: asset.id,
                              expected: asset,
                              patch: { favourite: !asset.favourite },
                            },
                          ]),
                        );
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    <Star
                      size={13}
                      fill={asset.favourite ? "currentColor" : "none"}
                    />
                  </button>
                  {["image", "icon", "font"].includes(asset.kind) && (
                    <button
                      aria-label={`Use ${asset.name}`}
                      onClick={() => onUse(asset)}
                    >
                      <Plus size={14} /> Use
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Drawer>
        {!visible.length && (
          <p className="builder-empty">
            {assets.length
              ? "No matching assets. Try another name or filter."
              : "No assets yet. Import a ZIP, a folder or single files to start the library."}
          </p>
        )}
        {detail && (
          <div ref={detailNode} className="builder-asset-detail">
            <div className="builder-row">
              <strong>{detail.name}</strong>
              <button
                onClick={() => setSelected(undefined)}
                aria-label="Close asset details"
              >
                ×
              </button>
            </div>
            <p>
              {detail.pack} / {detail.path}
            </p>
            {detail.originalPack && detail.originalPack !== detail.pack && (
              <p>Original pack: {detail.originalPack}</p>
            )}
            <p>
              {(detail.size / 1024).toFixed(1)} KB · {kindLabels[detail.kind]}
            </p>
            {detail.kind === "icon" && (
              <p>
                Static SVG. Safe colours and outlines are retained; scripts,
                external resources and animation are removed.
              </p>
            )}
            {detail.kind === "image" && (
              <section className="builder-image-optimisation">
                <strong>Optimised images</strong>
                {detail.image?.variants.length ? (
                  <p>
                    {detail.image.variants.length} smaller WebP versions · up to{" "}
                    {Math.max(
                      ...detail.image.variants.map((item) => item.width),
                    )}
                    px wide. Original retained.
                  </p>
                ) : (
                  <p>
                    {detail.image?.note ||
                      "Create smaller versions for the library and responsive pages."}
                  </p>
                )}
                <button
                  type="button"
                  disabled={metadataBusy}
                  onClick={async () => {
                    setMetadataBusy(true);
                    try {
                      onAsset(
                        await storage.optimiseImage(detail, (percent) =>
                          setStatus(`Optimising ${detail.name} · ${percent}%`),
                        ),
                      );
                      setStatus(
                        "Image optimisation finished. Publish page drafts to use the new versions.",
                      );
                    } catch (error) {
                      notify((error as Error).message);
                    } finally {
                      setMetadataBusy(false);
                    }
                  }}
                >
                  {detail.image?.variants.length
                    ? "Regenerate optimised images"
                    : "Optimise image"}
                </button>
              </section>
            )}
            <label>
              Tags, separated by commas
              <input
                key={`${detail.id}-${detail.tags.join()}`}
                defaultValue={detail.tags.join(", ")}
                onBlur={async (e) => {
                  try {
                    onAssets(
                      await storage.updateAssetMetadata([
                        {
                          id: detail.id,
                          expected: detail,
                          patch: {
                            tags: e.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          },
                        },
                      ]),
                    );
                  } catch (error) {
                    notify(error.message);
                  }
                }}
              />
            </label>
            {usage && (
              <section className="builder-asset-usage">
                <strong>Used on these pages</strong>
                {usage.pages.length ? (
                  <ul>
                    {usage.pages.map((item) => (
                      <li key={item.id}>
                        {item.title} · /{item.slug}/{" "}
                        <small>
                          {[
                            item.draft && "Draft",
                            item.live && "Published snapshot",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No current page references.</p>
                )}
                {!!usage.shared.length && (
                  <p>
                    Shared components:{" "}
                    {usage.shared.map((item) => item.name).join(", ")}
                  </p>
                )}
                {!!usage.saved.length && (
                  <p>
                    Saved sections/templates:{" "}
                    {usage.saved.map((item) => item.name).join(", ")}
                  </p>
                )}
                {usage.siteStyles && <p>Shared site styles</p>}
                {!!usage.historicalPages && (
                  <p>
                    Also retained in revision history for{" "}
                    {usage.historicalPages} pages.
                  </p>
                )}
              </section>
            )}
            {["image", "icon", "font"].includes(detail.kind) && (
              <AssetReplacement
                key={detail.id}
                asset={detail}
                assets={assets}
                onAsset={onAsset}
                prepareWorkspace={prepareWorkspace}
                onComplete={onReplacementComplete}
                notify={notify}
              />
            )}
            <section>
              <strong>Pack licence documents</strong>
              {assets
                .filter(
                  (item) =>
                    item.kind === "licence" &&
                    (item.originalPack || item.pack) ===
                      (detail.originalPack || detail.pack),
                )
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      try {
                        window.open(
                          await storage.download(item),
                          "_blank",
                          "noopener",
                        );
                      } catch (error) {
                        notify((error as Error).message);
                      }
                    }}
                  >
                    {item.path}
                  </button>
                ))}
            </section>
            <button
              onClick={async () => {
                try {
                  const url = await storage.download(detail);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = detail.name;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                } catch (error) {
                  notify(error.message);
                }
              }}
            >
              <Download size={14} /> Download original
              {detail.kind === "icon" ? " (sanitised SVG)" : ""}
            </button>
            {["code", "design"].includes(detail.kind) && (
              <ConversionPanel
                key={detail.id}
                asset={detail}
                assets={assets}
                onAsset={onAsset}
                onUseBlock={onUseBlock}
                notify={notify}
                download={downloadText}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
