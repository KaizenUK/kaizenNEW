import { strFromU8, strToU8, unzip, zip } from "fflate";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  supportedBackupVersion,
  validateBackupWorkspace,
  type BackupManifest,
  type RestoredAsset,
} from "../../shared/builderBackup";
import { clone, type Asset, type Workspace } from "../../shared/visualBuilder";
import { prepareAsset } from "./assets";
import { storage } from "./storage";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;
export const backupDigest = async (bytes: Uint8Array): Promise<string> =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
export type OpenBackup = {
  manifest: BackupManifest;
  files: Record<string, Uint8Array>;
};
export async function createProjectBackup(
  workspace: Workspace,
  report: (message: string) => void,
  fetchAsset: (asset: Asset) => Promise<Uint8Array> = async (asset) => {
    const response = await fetch(await storage.download(asset));
    if (!response.ok)
      throw new Error(`Could not download ${asset.name} (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  },
): Promise<Blob> {
  validateBackupWorkspace(workspace);
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: workspace.settings ? BACKUP_VERSION : 1,
    createdAt: new Date().toISOString(),
    workspace: clone(workspace),
    files: [],
  };
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const [index, asset] of workspace.assets.entries()) {
    report(
      `Backing up asset ${index + 1} of ${workspace.assets.length}: ${asset.name}`,
    );
    const bytes = await fetchAsset(asset);
    if (bytes.length > MAX_FILE || (total += bytes.length) > MAX_BYTES)
      throw new Error("Backups support files up to 50 MB and 500 MB in total.");
    const sha256 = await backupDigest(bytes);
    if (sha256 !== asset.hash)
      throw new Error(
        `${asset.name} no longer matches its stored checksum. Check the original before backing up.`,
      );
    const path = `assets/${asset.id}`;
    files[path] = bytes;
    manifest.files.push({
      assetId: asset.id,
      path,
      sha256,
      size: bytes.length,
    });
  }
  files["project.json"] = strToU8(JSON.stringify(manifest));
  if (total + files["project.json"].length > MAX_BYTES)
    throw new Error("This backup exceeds 500 MB including page data.");
  files["README.txt"] = strToU8(
    "Kaizen editable project backup, format 1.\nRestore through Builder > Project backups. Review before restoring drafts; this archive never publishes automatically.\nIncludes page data/history, shared design/history, saved sections, all registered library files and their licences. Source/design files are references only and are never executed.\nExternal media URLs, Sanity records and form services remain external dependencies. Credentials, enquiries and deployed release artifacts are not included.\nThis is a private project archive: keep it somewhere appropriate for its contents. Arbitrary React source exports cannot be reimported as editable layouts.\n",
  );
  report("Preparing project backup…");
  return new Blob(
    [
      (await new Promise<Uint8Array>((resolve, reject) =>
        zip(files, { level: 6 }, (error, bytes) =>
          error ? reject(error) : resolve(bytes),
        ),
      )) as BlobPart,
    ],
    { type: "application/zip" },
  );
}
export async function openProjectBackup(
  blob: Blob,
  report: (message: string) => void,
): Promise<OpenBackup> {
  if (blob.size > MAX_BYTES)
    throw new Error("Choose a project backup smaller than 500 MB.");
  report("Checking the project archive…");
  let total = 0,
    count = 0,
    problem = "";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) => {
      unzip(
        bytes,
        {
          filter: (info) => {
            if (info.name.endsWith("/")) return false;
            total += info.originalSize;
            count++;
            if (
              !/^(project\.json|README\.txt|assets\/[0-9a-f-]{36})$/i.test(
                info.name,
              ) ||
              info.originalSize > MAX_FILE ||
              total > MAX_BYTES ||
              count > 20_002
            ) {
              problem =
                "The backup contains unexpected paths or exceeds its size limits.";
              return false;
            }
            return true;
          },
        },
        (error, data) =>
          error
            ? reject(new Error("This is not a readable Kaizen backup ZIP."))
            : resolve(data),
      );
    },
  );
  if (problem) throw new Error(problem);
  if (!files["project.json"])
    throw new Error(
      "Choose an editable Kaizen project backup, not a React source export or asset pack.",
    );
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(files["project.json"]));
  } catch {
    throw new Error("The project manifest is damaged.");
  }
  if (
    !manifest ||
    manifest.format !== BACKUP_FORMAT ||
    !supportedBackupVersion(manifest.version)
  )
    throw new Error(
      "Unsupported backup version. Update the builder before restoring this archive.",
    );
  validateBackupWorkspace(manifest.workspace);
  if (
    !Array.isArray(manifest.files) ||
    manifest.files.length !== manifest.workspace.assets.length ||
    new Set(manifest.files.map((file) => file.assetId)).size !==
      manifest.files.length
  )
    throw new Error("The asset manifest is incomplete.");
  const assets = new Map(
    manifest.workspace.assets.map((asset) => [asset.id, asset]),
  );
  for (const item of manifest.files) {
    const asset = assets.get(item.assetId),
      bytes = files[item.path];
    if (
      !asset ||
      item.path !== `assets/${asset.id}` ||
      !bytes ||
      bytes.length !== item.size ||
      item.sha256 !== asset.hash ||
      (await backupDigest(bytes)) !== item.sha256
    )
      throw new Error(
        `Backup checksum failed for ${asset?.name || "an asset"}. Nothing has been restored.`,
      );
  }
  const listedPaths = new Set(manifest.files.map((item) => item.path));
  if (
    Object.keys(files).some(
      (path) => path.startsWith("assets/") && !listedPaths.has(path),
    )
  )
    throw new Error("The archive contains an unlisted asset.");
  return { manifest, files };
}
/** Validate every file before uploading any. Reuse known immutable files; keep their current metadata. */
export async function restoreBackupAssets(
  backup: OpenBackup,
  current: Workspace,
  report: (message: string) => void,
): Promise<{ workspace: Workspace; assetUpdates: RestoredAsset[] }> {
  const prepared: { original: Asset; asset: Asset; blob: Blob }[] = [];
  for (const [index, original] of backup.manifest.workspace.assets.entries()) {
    report(
      `Validating asset ${index + 1} of ${backup.manifest.workspace.assets.length}: ${original.name}`,
    );
    const result = await prepareAsset(
      {
        path: original.path,
        file: new Blob([backup.files[`assets/${original.id}`] as BlobPart], {
          type: original.mime,
        }),
      },
      original.pack,
    );
    // Legacy metadata may label an SVG as an image. Its sanitized SVG remains directly usable.
    if (
      result.asset.kind !== original.kind &&
      !(original.kind === "image" && result.asset.kind === "icon")
    )
      throw new Error(
        `${original.name} does not match its recorded asset type.`,
      );
    prepared.push({
      original,
      blob: result.blob,
      asset: {
        ...result.asset,
        tags: original.tags,
        favourite: original.favourite,
        originalPack: original.originalPack,
        ...(original.generatedFrom
          ? { generatedFrom: original.generatedFrom }
          : {}),
        createdAt: original.createdAt,
      },
    });
  }
  const identity = (asset: Asset) =>
    JSON.stringify([asset.hash, asset.pack, asset.path]);
  const urls = new Map<string, string>(),
    ids = new Map<string, string>(),
    restored: Asset[] = [],
    known = new Map(current.assets.map((asset) => [identity(asset), asset])),
    assetUpdates = new Map<string, RestoredAsset>();
  for (const [index, item] of prepared.entries()) {
    report(
      `Restoring asset ${index + 1} of ${prepared.length}: ${item.original.name}`,
    );
    const existing = known.get(identity(item.asset));
    const asset =
      existing ||
      (await storage.upload(
        item.asset,
        item.blob,
        (percent) => report(`Restoring ${item.original.name} · ${percent}%`),
        { optimise: false },
      ));
    const desired = {
      ...asset,
      tags: clone(item.original.tags),
      favourite: item.original.favourite,
      originalPack: item.original.originalPack || item.original.pack,
      ...(item.original.image ? { image: clone(item.original.image) } : {}),
      ...(item.original.conversion
        ? { conversion: clone(item.original.conversion) }
        : {}),
      ...(item.original.generatedFrom
        ? { generatedFrom: item.original.generatedFrom }
        : {}),
    };
    assetUpdates.set(asset.id, { expected: asset, asset: desired });
    known.set(identity(asset), asset);
    restored.push(desired);
    urls.set(item.original.url, asset.url);
    ids.set(item.original.id, asset.id);
  }
  const rewrite = (value: unknown, key = ""): unknown => {
    if (typeof value === "string") {
      if (key === "assetId") return ids.get(value) || value;
      if (key === "html") {
        const parsed = new DOMParser().parseFromString(value, "text/html");
        let changed = false;
        parsed.querySelectorAll("[href], [src]").forEach((node) => {
          for (const attribute of ["href", "src"]) {
            const next = urls.get(node.getAttribute(attribute) || "");
            if (next) {
              node.setAttribute(attribute, next);
              changed = true;
            }
          }
        });
        return changed ? parsed.body.innerHTML : value;
      }
      return urls.get(value) || value;
    }
    return Array.isArray(value)
      ? value.map((item) => rewrite(item))
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              rewrite(item, key),
            ]),
          )
        : value;
  };
  const workspace = rewrite(backup.manifest.workspace) as Workspace;
  // Multiple legacy references can resolve to one deduplicated stored file.
  workspace.assets = [
    ...new Map(
      restored.map((asset) => [asset.id, rewrite(asset) as Asset]),
    ).values(),
  ];
  return {
    workspace: validateBackupWorkspace(workspace),
    assetUpdates: [...assetUpdates.values()].map((item) => ({
      ...item,
      asset: rewrite(item.asset) as Asset,
    })),
  };
}
