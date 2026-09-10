import { unzip } from "fflate";
import DOMPurify from "dompurify";
import { newId, type Asset, type AssetKind } from "../../shared/visualBuilder";
export const MAX_FILE = 50 * 1024 * 1024;
export const MAX_PACK = 500 * 1024 * 1024;
export type ImportFile = { path: string; file: Blob };
export const kindLabels: Record<AssetKind, string> = {
  image: "Ready · image",
  icon: "Ready · SVG icon",
  font: "Ready · web font",
  licence: "Licence document",
  code: "Developer review required",
  design: "Conversion required",
  other: "Stored · download only",
};
export function classifyAsset(name: string): { kind: AssetKind; mime: string } {
  const ext = name.toLowerCase().split(".").pop();
  if (
    /(licen[cs]e|copyright|readme|terms|eula)/i.test(name) &&
    ["txt", "md", "pdf", "rtf", "html"].includes(ext)
  )
    return {
      kind: "licence",
      mime: ext === "pdf" ? "application/pdf" : "text/plain",
    };
  const images = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  if (images[ext]) return { kind: "image", mime: images[ext] };
  if (ext === "svg") return { kind: "icon", mime: "image/svg+xml" };
  if (["woff", "woff2", "ttf", "otf"].includes(ext))
    return { kind: "font", mime: `font/${ext}` };
  if (
    ["jsx", "tsx", "js", "ts", "css", "html", "vue", "svelte", "json"].includes(
      ext,
    )
  )
    return { kind: "code", mime: "application/octet-stream" };
  if (["fig", "sketch", "psd", "ai", "xd", "eps"].includes(ext))
    return { kind: "design", mime: "application/octet-stream" };
  return { kind: "other", mime: "application/octet-stream" };
}
export function normalizeAssetPath(raw: string) {
  const value = raw.replace(/\\/g, "/");
  if (
    value.startsWith("/") ||
    value.split("/").some((p) => ["..", "."].includes(p)) ||
    /[\x00-\x1f:]/.test(value) ||
    value.length > 500
  )
    throw new Error(`Unsafe filename: ${raw}`);
  return value;
}
export async function expandFiles(
  files: ImportFile[],
  report: (message: string) => void,
): Promise<ImportFile[]> {
  const output: ImportFile[] = [];
  let total = 0;
  for (const entry of files) {
    if (/\.zip$/i.test(entry.path)) {
      if (entry.file.size > 250 * 1024 * 1024)
        throw new Error(
          "ZIP archives must be smaller than 250 MB. Split this pack into smaller archives.",
        );
      report(`Opening ${entry.path}…`);
      let problem: string | undefined;
      let count = 0;
      const bytes = new Uint8Array(await entry.file.arrayBuffer());
      const expanded = await new Promise<Record<string, Uint8Array>>(
        (resolve, reject) =>
          unzip(
            bytes,
            {
              filter: (info) => {
                if (
                  info.name.endsWith("/") ||
                  info.name.startsWith("__MACOSX/") ||
                  info.name.endsWith(".DS_Store")
                )
                  return false;
                try {
                  normalizeAssetPath(info.name);
                } catch (error) {
                  problem = (error as Error).message;
                  return false;
                }
                total += info.originalSize;
                count++;
                if (
                  info.originalSize > MAX_FILE ||
                  total > MAX_PACK ||
                  count + output.length > 2000
                ) {
                  problem =
                    "This archive exceeds the 50 MB per file / 500 MB / 2,000 file limit.";
                  return false;
                }
                return true;
              },
            },
            (error, result) =>
              error
                ? reject(
                    new Error(
                      `Could not open ${entry.path}. Use a standard, unencrypted ZIP archive.`,
                    ),
                  )
                : resolve(result),
          ),
      );
      if (problem) throw new Error(problem);
      for (const [path, bytes] of Object.entries(expanded))
        output.push({
          path: normalizeAssetPath(path),
          file: new Blob([bytes as BlobPart]),
        });
    } else {
      total += entry.file.size;
      output.push({ ...entry, path: normalizeAssetPath(entry.path) });
    }
    if (total > MAX_PACK || output.length > 2000)
      throw new Error("Import up to 2,000 files / 500 MB at a time.");
  }
  return output;
}
export async function prepareAsset(
  entry: ImportFile,
  pack: string,
): Promise<{ asset: Asset; blob: Blob }> {
  if (entry.file.size > MAX_FILE)
    throw new Error("Files must be smaller than 50 MB.");
  if (!entry.file.size) throw new Error("This file is empty.");
  const path = normalizeAssetPath(entry.path);
  const name = path.split("/").pop();
  const { kind, mime } = classifyAsset(name);
  let blob = entry.file;
  if (kind === "icon") {
    const original = await blob.text();
    const doc = new DOMParser().parseFromString(original, "image/svg+xml");
    if (
      doc.querySelector("parsererror") ||
      doc.documentElement.localName !== "svg"
    )
      throw new Error("This SVG is not a valid image.");
    const clean = DOMPurify.sanitize(original, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [
        "style",
        "foreignObject",
        "a",
        "image",
        "use",
        "animate",
        "set",
      ],
      FORBID_ATTR: ["style", "href", "xlink:href"],
    });
    blob = new Blob([clean], { type: mime });
  } else if (kind === "image") {
    const bitmap = await createImageBitmap(blob).catch(() => {
      throw new Error(
        "This image is damaged or its format is not supported by your browser.",
      );
    });
    bitmap.close();
  } else if (kind === "font") {
    await new FontFace("ImportValidation", await blob.arrayBuffer())
      .load()
      .catch(() => {
        throw new Error("This font could not be read. Try the WOFF2 version.");
      });
  }
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    blob,
    asset: {
      id: newId(),
      hash,
      name,
      path,
      pack: pack.trim() || "Untitled pack",
      kind,
      mime,
      size: blob.size,
      url: "",
      tags: [],
      favourite: false,
      createdAt: new Date().toISOString(),
    },
  };
}
export async function droppedFiles(
  transfer: DataTransfer,
): Promise<ImportFile[]> {
  const roots = Array.from(transfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (!roots.length)
    return Array.from(transfer.files).map((file) => ({
      path: file.name,
      file,
    }));
  const output: ImportFile[] = [];
  async function visit(entry: FileSystemEntry, parent = "") {
    if (output.length >= 2000)
      throw new Error("Import up to 2,000 files at a time.");
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      output.push({ path: parent + entry.name, file });
    } else {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        const entries = await new Promise<FileSystemEntry[]>(
          (resolve, reject) => reader.readEntries(resolve, reject),
        );
        if (!entries.length) break;
        for (const child of entries)
          await visit(child, `${parent}${entry.name}/`);
      }
    }
  }
  for (const root of roots) await visit(root);
  return output;
}
