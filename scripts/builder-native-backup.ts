/** A native repository is restored as source, never converted into generated builder pages. */
import path from "node:path";
import {
  lstat,
  realpath,
  readdir,
  readFile,
  mkdir,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { inspectRepository } from "./builder-repository";
import { SourceDrafts } from "./builder-source-drafts";
import type { SourceEdits } from "../shared/builderSourceEditing";

const MAX_ZIP = 35 * 1024 * 1024,
  MAX_BYTES = 200 * 1024 * 1024,
  MAX_FILES = 10000;
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const ignored = new Set([
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  ".git",
  ".astro",
  ".vite",
  ".kaizen-builder",
  ".next",
  ".cache",
]);
const safeDotfiles = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
]);
type NativeManifest = {
  format: "kaizen-native-repository";
  version: 1;
  files: { file: string; size: number; hash: string; mode: number }[];
  excluded: string[];
  environmentNames: string[];
  drafts: { route: string; edits: SourceEdits }[];
};
export type NativeBackupReview = {
  id: string;
  root: string;
  files: { file: string; size: number }[];
  excluded: string[];
  draftCount: number;
  bytes: number;
  expiresAt: number;
  drafts: { route: string; sourcePresent: boolean }[];
  environmentNames: string[];
};
type Record = {
  review: NativeBackupReview;
  projectId: string;
  archive?: Uint8Array;
  manifest: NativeManifest;
  files: { [file: string]: Uint8Array };
  restoring?: boolean;
};
function relative(file: string) {
  if (
    !file ||
    file.includes("\\") ||
    file.includes(":") ||
    file.startsWith("/") ||
    /[\u0000-\u001f<>"|?*]/.test(file) ||
    file
      .split("/")
      .some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          /[. ]$/.test(segment) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
      )
  )
    throw new Error("Unsafe or non-portable native backup path.");
  return file;
}
function exclude(file: string) {
  const parts = file.split("/");
  return (
    parts.some(
      (part) =>
        ignored.has(part) ||
        (/^\./.test(part) &&
          !safeDotfiles.has(part) &&
          part !== ".kaizen" &&
          part !== ".github"),
    ) ||
    /^\.kaizen\/(recovery|build-recovery)(\/|$)/.test(file) ||
    parts.some(
      (part) =>
        /(^|[-_.])(credentials?|secrets?|private[-_]?key|service[-_]?account)([-_.]|$)/i.test(
          part,
        ) || /\.(pem|key|p12|pfx)$/i.test(part),
    )
  );
}
async function existingRealDirectory(directory: string) {
  if (!path.isAbsolute(directory))
    throw new Error("Use an absolute repository folder.");
  let current = path.parse(directory).root;
  for (const segment of path
    .relative(current, directory)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        "Repository backup paths must use real directories, without links.",
      );
  }
  return realpath(directory);
}
async function newDestination(root: string) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    throw new Error("Choose an absolute path for a new restore folder.");
  root = path.resolve(root);
  relative(path.basename(root));
  const parent = await existingRealDirectory(path.dirname(root));
  root = path.join(parent, path.basename(root));
  const stat = await lstat(root).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
  if (stat)
    throw new Error(
      "Restore requires a new folder that does not already exist. Existing repositories are never replaced.",
    );
  return root;
}
function unpack(archive: Uint8Array) {
  if (archive.length > MAX_ZIP)
    throw new Error("Native backup ZIPs are limited to 35 MB.");
  let total = 0;
  const seen = new Set<string>();
  const files = unzipSync(archive, {
    filter(entry) {
      relative(entry.name);
      if (
        entry.name !== "native-project.json" &&
        entry.name !== "RESTORE.md" &&
        !entry.name.startsWith("repository/")
      )
        throw new Error(
          "Unexpected entry outside the native repository archive.",
        );
      const key = entry.name.toLowerCase();
      if (seen.has(key) || seen.size >= MAX_FILES + 2)
        throw new Error("Duplicate paths or too many files in native backup.");
      seen.add(key);
      total += entry.originalSize;
      if (total > MAX_BYTES || entry.originalSize > 32 * 1024 * 1024)
        throw new Error("Native backup exceeds expanded file limits.");
      return true;
    },
  });
  if (!files["native-project.json"])
    throw new Error("Native repository backup manifest is missing.");
  const manifest: NativeManifest = JSON.parse(
    strFromU8(files["native-project.json"]),
  );
  if (
    !manifest ||
    !Array.isArray(manifest.environmentNames) ||
    manifest.environmentNames.some(
      (name) =>
        typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name),
    )
  )
    throw new Error("Invalid environment variable names in native backup.");
  if (
    manifest.format !== "kaizen-native-repository" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    !Array.isArray(manifest.excluded) ||
    manifest.excluded.some((value) => typeof value !== "string") ||
    !Array.isArray(manifest.drafts)
  )
    throw new Error("Invalid native repository backup version or manifest.");
  const listed = new Set<string>();
  for (const entry of manifest.files) {
    relative(entry.file);
    if (!Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777)
      throw new Error("Invalid source file permissions in native backup.");
    if (exclude(entry.file) || listed.has(entry.file.toLowerCase()))
      throw new Error("Native backup contains an excluded or duplicate path.");
    listed.add(entry.file.toLowerCase());
    const data = files[`repository/${entry.file}`];
    if (!data || data.length !== entry.size || digest(data) !== entry.hash)
      throw new Error(`Native source checksum failed: ${entry.file}`);
  }
  for (const entry of manifest.files) {
    const parts = entry.file.toLowerCase().split("/");
    for (let count = 1; count < parts.length; count++)
      if (listed.has(parts.slice(0, count).join("/")))
        throw new Error("A native backup path is both a file and a folder.");
  }
  if (
    Object.keys(files).length !== manifest.files.length + 2 ||
    !files["RESTORE.md"] ||
    !files["repository/package.json"]
  )
    throw new Error("Unexpected or missing native repository files.");
  const routes = new Set<string>();
  for (const draft of manifest.drafts) {
    if (
      !draft ||
      typeof draft.route !== "string" ||
      routes.has(draft.route) ||
      !draft.edits?.inspection ||
      draft.edits.inspection.route !== draft.route ||
      draft.edits.inspection.root !== "$repository"
    )
      throw new Error("Invalid native source editing draft.");
    routes.add(draft.route);
  }
  return { manifest, files };
}
export class NativeRepositoryBackups {
  private records = new Map<string, Record>();
  private retain(
    projectId: string,
    root: string,
    manifest: NativeManifest,
    files: Record["files"],
    archive?: Uint8Array,
  ) {
    const review: NativeBackupReview = {
      id: randomUUID(),
      root,
      files: manifest.files.map(({ file, size }) => ({ file, size })),
      excluded: manifest.excluded,
      draftCount: manifest.drafts.length,
      drafts: manifest.drafts.map((draft) => ({
        route: draft.route,
        sourcePresent: Boolean(files[`repository/${draft.route}`]),
      })),
      environmentNames: manifest.environmentNames,
      bytes:
        archive?.length || manifest.files.reduce((n, file) => n + file.size, 0),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    for (const [id, record] of this.records)
      if (record.review.expiresAt < Date.now() && !record.restoring)
        this.records.delete(id);
    if (this.records.size >= 4) {
      const oldest = [...this.records].find(([, record]) => !record.restoring);
      if (!oldest)
        throw new Error(
          "Finish an active native restore before opening another review.",
        );
      this.records.delete(oldest[0]);
    }
    this.records.set(review.id, {
      review,
      projectId,
      manifest,
      files,
      archive,
    });
    setTimeout(
      (id: string) => this.records.delete(id),
      15 * 60 * 1000,
      review.id,
    ).unref();
    return review;
  }
  private require(id: string, projectId: string) {
    const record = this.records.get(id);
    if (
      !record ||
      record.projectId !== projectId ||
      record.review.expiresAt < Date.now() ||
      record.restoring
    )
      throw new Error(
        "Native backup review expired or belongs to another project. Review it again.",
      );
    return record;
  }
  async capture(root: string, projectId: string, directory: string) {
    const inspection = await inspectRepository(root);
    if (inspection.framework !== "astro-react")
      throw new Error(
        "Native backups currently support existing Astro + React repositories.",
      );
    root = await existingRealDirectory(inspection.root);
    const files: Record["files"] = {},
      entries: NativeManifest["files"] = [],
      excluded: string[] = [];
    let total = 0;
    let visited = 0;
    const environmentNames = new Set<string>();
    const paths = new Set<string>();
    async function walk(folder: string) {
      for (const entry of (
        await readdir(path.join(root, folder), { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = folder ? `${folder}/${entry.name}` : entry.name;
        if (++visited > 20000)
          throw new Error("Too many entries in this native repository.");
        relative(file);
        if (exclude(file)) {
          excluded.push(file);
          if (
            /^\.env(?:\.|$)/.test(entry.name) &&
            entry.isFile() &&
            !entry.isSymbolicLink()
          ) {
            const stat = await lstat(path.join(root, file));
            if (
              stat.isFile() &&
              !stat.isSymbolicLink() &&
              stat.size <= 128 * 1024
            ) {
              const env = await readFile(path.join(root, file), "utf8");
              for (const match of env.matchAll(
                /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm,
              ))
                environmentNames.add(match[1]);
            }
          }
          continue;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            `Native backup does not follow linked files: ${file}`,
          );
        if (entry.isDirectory()) {
          await walk(file);
          continue;
        }
        if (!entry.isFile())
          throw new Error(`Native backup requires regular files: ${file}`);
        const stat = await lstat(path.join(root, file));
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error(`Source changed while creating the backup: ${file}`);
        if (
          stat.size > 32 * 1024 * 1024 ||
          total + stat.size > MAX_BYTES ||
          entries.length >= MAX_FILES
        )
          throw new Error(
            "Native backups support 10,000 files, 32 MB per file and 200 MB total source.",
          );
        if (paths.has(file.toLowerCase()))
          throw new Error(
            "Native backup paths must be unique on Windows and Linux.",
          );
        paths.add(file.toLowerCase());
        const bytes = await readFile(path.join(root, file));
        if (bytes.length > 32 * 1024 * 1024 || total + bytes.length > MAX_BYTES)
          throw new Error("Source grew beyond native backup limits.");
        total += bytes.length;
        files[`repository/${file}`] = bytes;
        const after = await lstat(path.join(root, file));
        if (
          !after.isFile() ||
          after.isSymbolicLink() ||
          after.ino !== stat.ino ||
          after.dev !== stat.dev ||
          after.mtimeMs !== stat.mtimeMs ||
          after.size !== bytes.length
        )
          throw new Error(`Source changed while creating the backup: ${file}`);
        entries.push({
          file,
          size: bytes.length,
          hash: digest(bytes),
          mode: stat.mode & 0o777,
        });
      }
    }
    await walk("");
    const drafts = (await new SourceDrafts(directory).list(root)).map(
      (draft) => ({
        route: draft.route,
        edits: {
          ...draft.edits!,
          inspection: { ...draft.edits!.inspection, root: "$repository" },
        },
      }),
    );
    // A changed source invalidates the snapshot rather than mixing file versions.
    for (const entry of entries)
      if (digest(await readFile(path.join(root, entry.file))) !== entry.hash)
        throw new Error(
          `Source changed while creating the backup: ${entry.file}. Retry after saving.`,
        );
    const currentFiles: string[] = [];
    let verifiedEntries = 0;
    async function verifyTree(folder: string) {
      for (const entry of await readdir(path.join(root, folder), {
        withFileTypes: true,
      })) {
        if (++verifiedEntries > 20000)
          throw new Error("Source tree changed beyond native backup limits.");
        const file = folder ? `${folder}/${entry.name}` : entry.name;
        if (exclude(file)) continue;
        if (entry.isSymbolicLink())
          throw new Error("Source links changed during backup.");
        if (entry.isDirectory()) await verifyTree(file);
        else currentFiles.push(file);
        if (currentFiles.length > MAX_FILES)
          throw new Error("Source changed during backup.");
      }
    }
    await verifyTree("");
    if (
      JSON.stringify(currentFiles.sort()) !==
      JSON.stringify(entries.map((entry) => entry.file).sort())
    )
      throw new Error(
        "Repository files were added or removed during backup. Retry after saving.",
      );
    const manifest: NativeManifest = {
      format: "kaizen-native-repository",
      version: 1,
      files: entries,
      excluded,
      environmentNames: [...environmentNames].sort(),
      drafts,
    };
    files["native-project.json"] = strToU8(JSON.stringify(manifest));
    files["RESTORE.md"] = strToU8(
      "# Native repository backup\n\nOpen the local Kaizen builder, select the destination client project, open Export & repositories, and review this ZIP in Native repository backup. Choose a new folder under an existing parent. The original repository is never replaced. Saved source drafts are rebound to the restored folder; changed or missing original pages remain recovery data.\n\nFor a manual source recovery, extract repository/ into a new folder. Pending edits remain in native-project.json and are not yet applied to that source.\n\nInstall dependencies using the package manager matching the lockfile, then use the package.json build and development scripts. Build before using rendered selection. No Git commands, dependency installation, builds or publication happen during restore. Git history, generated output and private configuration are excluded. Keep credentials separately.\n\nEnvironment variable names discovered (values excluded):\n" +
        manifest.environmentNames.map((name) => "- " + name).join("\n") +
        "\n\nExcluded paths:\n" +
        excluded.map((file) => "- " + file).join("\n") +
        "\n",
    );
    const archive = zipSync(files, { level: 6 });
    unpack(archive);
    return this.retain(projectId, root, manifest, files, archive);
  }
  download(id: string, projectId: string) {
    const record = this.require(id, projectId);
    if (!record.archive)
      throw new Error("Review a native repository backup before downloading.");
    this.records.delete(id);
    return Buffer.from(record.archive).toString("base64");
  }
  async reviewRestore(root: string, projectId: string, archive: Uint8Array) {
    root = await newDestination(root);
    const { manifest, files } = unpack(archive);
    const config = JSON.parse(strFromU8(files["repository/package.json"]));
    const dependencies = { ...config.dependencies, ...config.devDependencies };
    if (!dependencies.astro || !dependencies["@astrojs/react"])
      throw new Error(
        "The backup must contain an Astro + React package configuration.",
      );
    for (const draft of manifest.drafts)
      new SourceDrafts("").validate(
        { ...draft.edits, inspection: { ...draft.edits.inspection, root } },
        root,
        draft.route,
      );
    return this.retain(projectId, root, manifest, files);
  }
  discard(id: string, projectId: string) {
    this.require(id, projectId);
    this.records.delete(id);
  }
  async restore(id: string, projectId: string, directory: string) {
    const record = this.require(id, projectId);
    if (record.archive)
      throw new Error("This review is for a download, not a restore.");
    const root = await newDestination(record.review.root);
    record.restoring = true;
    let created = false;
    try {
      await mkdir(root, { mode: 0o700 }); // Exclusive creation: never overwrite an existing repository.
      created = true;
      for (const entry of record.manifest.files) {
        const target = path.join(root, entry.file);
        await existingRealDirectory(root);
        let parent = root;
        for (const segment of entry.file.split("/").slice(0, -1)) {
          parent = path.join(parent, segment);
          await mkdir(parent, { mode: 0o700 }).catch((error) => {
            if (error.code !== "EEXIST") throw error;
          });
          const stat = await lstat(parent);
          if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new Error(
              "Restore destination gained a linked or conflicting folder.",
            );
        }
        await existingRealDirectory(path.dirname(target));
        await writeFile(target, record.files[`repository/${entry.file}`], {
          flag: "wx",
          mode: entry.mode,
        });
      }
      for (const entry of record.manifest.files) {
        await existingRealDirectory(path.dirname(path.join(root, entry.file)));
        const stat = await lstat(path.join(root, entry.file));
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          digest(await readFile(path.join(root, entry.file))) !== entry.hash
        )
          throw new Error(
            "Restored source changed before verification finished.",
          );
      }
      const inspection = await inspectRepository(root);
      if (inspection.framework !== "astro-react")
        throw new Error(
          "Restored package configuration is not a supported Astro + React repository.",
        );
      for (const draft of record.manifest.drafts) {
        const edits = {
          ...draft.edits,
          inspection: { ...draft.edits.inspection, root },
        };
        await new SourceDrafts(directory).save(root, draft.route, 0, edits);
      }
      this.records.delete(id);
      return {
        root,
        files: record.manifest.files.length,
        drafts: record.manifest.drafts.length,
      };
    } catch (error) {
      record.restoring = false;
      throw new Error(
        created
          ? `Restore stopped. Keep the backup; partial files remain in ${root}. Existing repositories were not changed. ${error.message}`
          : error.message,
      );
    }
  }
}
