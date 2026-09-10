import React, { useRef, useState } from "react";
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
import { type Asset } from "../../shared/visualBuilder";
import {
  droppedFiles,
  expandFiles,
  kindLabels,
  prepareAsset,
  type ImportFile,
} from "./assets";
import { storage } from "./storage";
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
  onAsset,
  onUse,
  notify,
}: {
  assets: Asset[];
  onAsset: (asset: Asset) => void;
  onUse: (asset: Asset) => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [packFilter, setPackFilter] = useState("");
  const [pack, setPack] = useState("My UI8 pack");
  const [favourites, setFavourites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  async function importPack(files: ImportFile[]) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setErrors([]);
    setProgress(0);
    let imported = 0;
    let duplicates = 0;
    const failures: string[] = [];
    const known = [...assets];
    try {
      const entries = await expandFiles(files, setStatus);
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        setStatus(`${index + 1} of ${entries.length} · ${entry.path}`);
        try {
          const { asset, blob } = await prepareAsset(entry, pack);
          if (
            known.some(
              (a) =>
                a.hash === asset.hash &&
                a.pack === asset.pack &&
                a.path === asset.path,
            )
          )
            duplicates++;
          else {
            const uploaded = await storage.upload(asset, blob, (percent) =>
              setProgress(
                Math.round(((index + percent / 100) / entries.length) * 100),
              ),
            );
            known.push(uploaded);
            onAsset(uploaded);
            imported++;
          }
        } catch (error) {
          failures.push(`${entry.path}: ${(error as Error).message}`);
          setErrors([...failures]);
        }
        setProgress(Math.round(((index + 1) / entries.length) * 100));
      }
      setStatus(
        `${imported} imported · ${duplicates} duplicates skipped · ${failures.length} errors`,
      );
    } catch (error) {
      failures.push((error as Error).message);
      setErrors(failures);
      setStatus("Pack could not be imported");
    } finally {
      setBusy(false);
      running.current = false;
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
  const visible = assets.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!packFilter || a.pack === packFilter) &&
      (!favourites || a.favourite) &&
      `${a.name} ${a.path} ${a.pack} ${a.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const detail = assets.find((a) => a.id === selected);
  return (
    <div className="builder-library">
      <div
        className="builder-drop"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={async (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          try {
            await importPack(await droppedFiles(e.dataTransfer));
          } catch (error) {
            notify((error as Error).message);
          }
        }}
      >
        <FileArchive size={26} />
        <strong>Your next idea starts here</strong>
        <span>Drop a ZIP, folder or files</span>
        <label className="builder-sr">Pack name</label>
        <input
          aria-label="Pack name"
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          disabled={busy}
        />
        <div className="builder-row">
          <button disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Upload
          </button>
          <button disabled={busy} onClick={() => folderInput.current?.click()}>
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
          disabled={busy}
          className="builder-text-button"
          onClick={sample}
        >
          Try the sample asset pack
        </button>
        <small>50 MB per file · 500 MB per batch</small>
      </div>
      {status && (
        <div role="status" className="builder-import-status">
          <span>{status}</span>
          <progress max={100} value={progress} aria-label="Import progress" />
        </div>
      )}
      {!!errors.length && (
        <details open className="builder-error">
          <summary>{errors.length} files need attention</summary>
          {errors.map((error, i) => (
            <p key={i}>{error}</p>
          ))}
          <small>
            Correct these files and upload the pack again. Completed files will
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
        {Array.from(new Set(assets.map((a) => a.pack))).map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <p className="builder-hint">
        {visible.length} assets · Drag images onto the page, or use +.
      </p>
      <Drawer>
        <div className="builder-assets">
          {visible.map((asset) => (
            <article
              key={asset.id}
              className={`builder-asset ${selected === asset.id ? "selected" : ""}`}
            >
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
                      <img src={asset.url} alt={asset.name} loading="lazy" />
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
                    <img src={asset.url} alt={asset.name} loading="lazy" />
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
              <div className="builder-row">
                <button
                  aria-label={`Favourite ${asset.name}`}
                  aria-pressed={asset.favourite}
                  onClick={async () => {
                    try {
                      onAsset(
                        await storage.updateAsset({
                          ...asset,
                          favourite: !asset.favourite,
                        }),
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
            : "Your library is ready for its first pack."}
        </p>
      )}
      {detail && (
        <div className="builder-asset-detail">
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
          <p>
            {(detail.size / 1024).toFixed(1)} KB · {kindLabels[detail.kind]}
          </p>
          <label>
            Tags, separated by commas
            <input
              key={`${detail.id}-${detail.tags.join()}`}
              defaultValue={detail.tags.join(", ")}
              onBlur={async (e) => {
                try {
                  onAsset(
                    await storage.updateAsset({
                      ...detail,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }),
                  );
                } catch (error) {
                  notify(error.message);
                }
              }}
            />
          </label>
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
            <>
              <p>
                Keep this file as a reference. A developer must review or
                convert it before it becomes an editable React block.
              </p>
              <button
                onClick={() =>
                  downloadText(
                    `integration-${detail.name}.md`,
                    `# React block integration request\n\nPack: ${detail.pack}\nFile: ${detail.path}\nAsset ID: ${detail.id}\nSHA-256: ${detail.hash}\nStatus: ${kindLabels[detail.kind]}\n\nLicence files: ${
                      assets
                        .filter(
                          (a) => a.pack === detail.pack && a.kind === "licence",
                        )
                        .map((a) => a.path)
                        .join(", ") || "Not supplied; verify usage rights."
                    }\n\nDeveloper checklist:\n- Review the source/design and supplied licence. Do not execute untrusted code.\n- Agree editable fields and responsive behaviour.\n- Implement a reviewed React block in client/visual-builder/Renderer.tsx.\n- Register its schema in shared/visualBuilder.ts and editor fields in config.tsx.\n- Test accessible markup, mobile layouts and static output.\n- Deploy the reviewed component before enabling it in saved pages.\n`,
                  )
                }
              >
                Export developer brief
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
