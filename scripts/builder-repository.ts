import { measureRepositorySource } from "./builder-repository-usage.mjs";
/** Local-only companion. Inspects and writes reviewed generated files; never runs Git writes or package scripts. */
import {
  readFile,
  readdir,
  lstat,
  realpath,
  mkdir,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  repositoryGitStatus,
  commitRepositoryFiles,
  type RepositoryCommitOptions,
  type RepositoryGitCommand,
} from "./builder-repository-git";
import { unzipSync, strFromU8 } from "fflate";
import {
  BACKUP_FORMAT,
  supportedBackupVersion,
  validateBackupWorkspace,
} from "../shared/builderBackup";
import {
  inspectSource,
  editSource,
  sourceImport,
} from "./builder-source-editing";
import type {
  SourceInspection,
  SourceEdits,
} from "../shared/builderSourceEditing";
import { sourceAssetPath } from "../shared/builderSourceEditing";
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const OWNERSHIP = ".kaizen/ownership.json";
export function readEditableArchive(archive: Uint8Array) {
  const files = unpack(archive);
  if (!files["project.json"])
    throw new Error("Editable backup manifest is missing.");
  const manifest = JSON.parse(strFromU8(files["project.json"]));
  if (
    manifest.format !== BACKUP_FORMAT ||
    !supportedBackupVersion(manifest.version)
  )
    throw new Error("Incompatible editable project version.");
  const workspace = validateBackupWorkspace(manifest.workspace);
  for (const asset of workspace.assets) {
    const data = files[`assets/${asset.id}`];
    if (!data || data.length !== asset.size || hash(data) !== asset.hash)
      throw new Error(`Editable asset checksum failed: ${asset.name}`);
  }
  return { workspace, files };
}
export type RepositoryInspection = {
  root: string;
  framework: "astro-react" | "kaizen-export" | "empty" | "unsupported";
  explanation: string;
  routes: {
    file: string;
    title?: string;
    ownership: "builder-editable" | "code-managed" | "developer-integration";
  }[];
};
export type FileChange = {
  file: string;
  action: "create" | "update" | "delete" | "unchanged";
  before: string | null;
  after: string | null;
  conflict?: string;
  preview?: string;
};
/** Private recovery metadata: paths and hashes, never source content. */
export type AppliedFileChange = Pick<
  FileChange,
  "file" | "action" | "before" | "after"
>;
export type RepositoryPlan = {
  id: string;
  root: string;
  projectId: string;
  framework: RepositoryInspection["framework"];
  changes: FileChange[];
  conflicts: string[];
  expiresAt: number;
};
type Ownership = {
  format: "kaizen-ownership";
  version: 1;
  files: Record<string, string>;
};
function validRelative(file: string) {
  if (
    !file ||
    file.includes("\\") ||
    file.includes(":") ||
    file.startsWith("/") ||
    file
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part === ".git" ||
          part === "node_modules",
      ) ||
    /[\u0000-\u001f]/.test(file)
  )
    throw new Error("Unsafe repository file path.");
  return file;
}
async function safePath(root: string, file: string) {
  validRelative(file);
  let current = root;
  for (const segment of file.split("/")) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Symbolic links are not supported: ${file}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return current;
}
async function bytes(root: string, file: string): Promise<Buffer | null> {
  try {
    return await readFile(await safePath(root, file));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function ownership(root: string): Promise<Ownership | undefined> {
  const data = await bytes(root, OWNERSHIP);
  if (!data) return;
  const value = JSON.parse(data.toString());
  if (
    value.format !== "kaizen-ownership" ||
    value.version !== 1 ||
    !value.files ||
    Array.isArray(value.files)
  )
    throw new Error(
      "Incompatible repository ownership format. Update the builder before integrating.",
    );
  for (const [file, digest] of Object.entries(value.files)) {
    validRelative(file);
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))
      throw new Error("Invalid ownership checksum.");
  }
  return value;
}
async function repositoryRoot(value: string) {
  if (typeof value !== "string" || !path.isAbsolute(value))
    throw new Error(
      "Choose the absolute path to an existing local repository.",
    );
  const root = path.resolve(value);
  if (
    (await lstat(root)).isSymbolicLink() ||
    !(await lstat(root)).isDirectory()
  )
    throw new Error("Choose a real directory, not a symbolic link.");
  // Resolving ancestor links would redirect a reviewed path into another directory.
  const resolved = await realpath(root);
  if (resolved.toLowerCase() !== root.toLowerCase())
    throw new Error("Repository ancestors must not be symbolic links.");
  return root;
}
export async function inspectRepository(
  value: string,
): Promise<RepositoryInspection> {
  const root = await repositoryRoot(value);
  const pkgBytes = await bytes(root, "package.json");
  const pkg = pkgBytes ? JSON.parse(pkgBytes.toString()) : {};
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const formatBytes = await bytes(root, ".kaizen/format.json");
  const format = formatBytes ? JSON.parse(formatBytes.toString()) : undefined;
  if (
    format &&
    (format.format !== "kaizen-repository" || ![1, 2].includes(format.version))
  )
    throw new Error(
      "Incompatible editable project version. Preserve the repository and update the builder.",
    );
  const entries = await readdir(root);
  const framework =
    dependencies.astro && dependencies["@astrojs/react"]
      ? "astro-react"
      : format?.output === "react-static"
        ? "kaizen-export"
        : !entries.some(
              (name) => ![".git", ".gitignore", "README.md"].includes(name),
            )
          ? "empty"
          : "unsupported";
  const owned = await ownership(root);
  const routes: RepositoryInspection["routes"] = [];
  async function walk(folder: string) {
    if (routes.length > 2000)
      throw new Error("Repository route inventory exceeds 2,000 files.");
    let entries;
    try {
      entries = await readdir(await safePath(root, folder), {
        withFileTypes: true,
      });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const file = `${folder}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(
          `Route symbolic link requires developer integration: ${file}`,
        );
      if (entry.isDirectory()) await walk(file);
      else if (/\.(astro|tsx?|jsx?|mdx?)$/.test(entry.name)) {
        const source = (await bytes(root, file))?.toString() || "";
        const title = source
          .match(/<(?:title|h1)\b[^>]*>([^<{]+)<\//i)?.[1]
          ?.trim();
        routes.push({
          file,
          ...(title ? { title } : {}),
          ownership: owned?.files[file]
            ? "builder-editable"
            : file.includes("[") || /\.(tsx|jsx|mdx)$/.test(file)
              ? "developer-integration"
              : "code-managed",
        });
      }
    }
  }
  if (framework === "astro-react") await walk("src/pages");
  return {
    root,
    framework,
    routes,
    explanation:
      framework === "unsupported"
        ? "Automatic integration supports Astro with @astrojs/react, Kaizen exports and empty repositories. Arbitrary source cannot be imported into the visual editor."
        : "Inspect the file proposal before applying. Existing routes and application logic remain code-managed unless already tracked by Kaizen. No install, build, commit, push or pull is performed.",
  };
}
function unpack(archive: Uint8Array) {
  if (archive.byteLength > 50 * 1024 * 1024)
    throw new Error(
      "Local integration supports ZIPs up to 50 MB. Use an exported folder for larger handoffs.",
    );
  let total = 0,
    count = 0;
  return unzipSync(archive, {
    filter(info) {
      if (info.name.endsWith("/")) return false;
      validRelative(info.name);
      if (
        (total += info.originalSize) > 500 * 1024 * 1024 ||
        info.originalSize > 50 * 1024 * 1024 ||
        ++count > 20000
      )
        throw new Error("Repository export exceeds integration limits.");
      return true;
    },
  });
}
function astroPage(slug: string, file: string) {
  const relative = path.posix.relative(path.posix.dirname(file), "src/kaizen");
  const from = relative.startsWith(".") ? relative : `./${relative}`;
  return `---\n// Generated by Kaizen. Edit via .kaizen/project.zip; external changes cause an integration conflict.\nimport PublishedPage from '${from}/Renderer';\nimport {pageMetadataHead} from '${from}/builderSiteMetadata';\nimport siteConfig from '${from}/siteConfig.json';\nimport pages from '${from}/pages.json';\nimport {needsBuilderRuntime, type PageDocument} from '${from}/schema';\nimport '${from}/page.css';\nconst document = pages.find(page => page.slug === ${JSON.stringify(slug)}) as PageDocument;\n---\n<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><Fragment set:html={pageMetadataHead(document, siteConfig)} /></head><body style="margin:0"><PublishedPage document={document} />{needsBuilderRuntime(document.data.content) && <script is:inline src="/builder-runtime.js" defer></script>}</body></html>\n`;
}
export class RepositoryCompanion {
  private appliedPlans = new Map<
    string,
    {
      root: string;
      projectId: string;
      changes: FileChange[];
      committing: boolean;
    }
  >();
  async gitStatus(root: string, git?: RepositoryGitCommand) {
    return repositoryGitStatus(await repositoryRoot(root), git);
  }
  async appliedState(root: string, changes: AppliedFileChange[]) {
    root = await repositoryRoot(root);
    if (!changes.length || changes.length > 20000)
      throw new Error("Invalid applied file record.");
    const seen = new Set<string>();
    let before = true,
      after = true;
    for (const change of changes) {
      validRelative(change.file);
      if (
        seen.has(change.file) ||
        !["create", "update", "delete"].includes(change.action) ||
        ![change.before, change.after].every(
          (value) =>
            value === null ||
            (typeof value === "string" && /^[a-f0-9]{64}$/.test(value)),
        ) ||
        change.before === change.after
      )
        throw new Error("Invalid applied file record.");
      seen.add(change.file);
      const content = await bytes(root, change.file),
        current = content ? hash(content) : null;
      before &&= current === change.before;
      after &&= current === change.after;
    }
    return after ? "after" : before ? "before" : "changed";
  }
  /** Host-only recovery; ordinary local requests still require their in-memory applied plan. */
  async restoreApplied(
    id: string,
    projectId: string,
    root: string,
    changes: AppliedFileChange[],
  ) {
    if ((await this.appliedState(root, changes)) !== "after")
      throw new Error(
        "Changed since apply. Ask the owner to reconcile these edits before saving.",
      );
    this.appliedPlans.set(id, {
      root: await repositoryRoot(root),
      projectId,
      changes: structuredClone(changes),
      committing: false,
    });
  }
  async commit(
    id: string,
    projectId: string,
    message: string,
    options?: RepositoryCommitOptions,
  ) {
    const applied = this.appliedPlans.get(id);
    if (!applied || applied.projectId !== projectId)
      throw new Error(
        "Apply changes in this project before committing. This applied plan is unavailable or already committed.",
      );
    if (applied.committing)
      throw new Error("These changes are already being committed.");
    applied.committing = true;
    try {
      const root = await repositoryRoot(applied.root);
      let additionalBytes = 4 * 1024 * 1024;
      for (const change of applied.changes) {
        const content = await bytes(root, change.file);
        if ((content ? hash(content) : null) !== change.after)
          throw new Error(
            options?.git
              ? `Changed since apply: ${change.file}. Ask the owner to reconcile these edits before saving.`
              : `Changed since apply: ${change.file}. Review these edits in GitHub Desktop before committing.`,
          );
        additionalBytes += (content?.byteLength || 0) * 2 + 8192;
      }
      const result = await commitRepositoryFiles(
        root,
        applied.changes.map((c) => c.file),
        message,
        options?.reserveStorage
          ? {
              ...options,
              beforeMutation: async () => {
                await options.reserveStorage!(additionalBytes);
                await options.beforeMutation?.();
              },
            }
          : options,
      );
      this.appliedPlans.delete(id);
      return result;
    } finally {
      applied.committing = false;
    }
  }
  private plans = new Map<
    string,
    {
      plan: RepositoryPlan;
      files: Record<string, Uint8Array>;
      applying: boolean;
    }
  >();
  async inspectSourcePage(
    root: string,
    route: string,
  ): Promise<SourceInspection> {
    const inspection = await inspectRepository(root);
    const selected = inspection.routes.find((item) => item.file === route);
    if (
      inspection.framework !== "astro-react" ||
      !selected ||
      selected.ownership === "builder-editable" ||
      !/\.(astro|tsx|jsx)$/.test(route)
    )
      throw new Error(
        "Choose an existing Astro/React source page. Builder-owned pages use the visual page editor.",
      );
    const models: Awaited<ReturnType<typeof inspectSource>>[] = [];
    const visited = new Set<string>();
    async function visit(file: string) {
      if (visited.has(file)) return;
      if (visited.size >= 100)
        throw new Error(
          "This page imports more than 100 source components. Integrate a smaller component first.",
        );
      visited.add(file);
      const content = await bytes(inspection.root, file);
      if (!content) return;
      if (content.length > 1024 * 1024)
        throw new Error(`Source component is too large: ${file}`);
      const model = await inspectSource(file, content.toString());
      models.push(model);
      for (const specifier of model.imports) {
        const target = sourceImport(file, specifier);
        if (!target) continue;
        const candidates = /\.js$/.test(target)
          ? [target, target.slice(0, -3) + ".ts", target.slice(0, -3) + ".tsx"]
          : /\.(astro|tsx|jsx|ts|mjs|json)$/.test(target)
            ? [target]
            : path.extname(target)
              ? []
              : [
                  target + ".tsx",
                  target + ".jsx",
                  target + ".ts",
                  target + ".js",
                  target + ".mjs",
                  target + ".json",
                  target + "/index.tsx",
                  target + "/index.jsx",
                  target + "/index.ts",
                  target + "/index.js",
                ];
        for (const candidate of candidates)
          if (await bytes(inspection.root, candidate)) {
            await visit(candidate);
            break;
          }
      }
    }
    await visit(route);
    return {
      root: inspection.root,
      route,
      files: models.map(({ file, hash }) => ({ file, hash })),
      fields: models.flatMap((model) =>
        model.fields.map(({ start, end, encoding, ...field }) => field),
      ),
      groups: models.flatMap((model) =>
        model.groups.map((group) => ({
          ...group,
          items: group.items.map(({ start, end, ...item }) => ({
            ...item,
            fieldIds: model.fields
              .filter((f) => f.start >= start && f.end <= end)
              .map((f) => f.id),
            label:
              model.fields
                .find(
                  (f) => f.start >= start && f.end <= end && f.kind === "text",
                )
                ?.value.slice(0, 70) || item.label,
          })),
        })),
      ),
      boundaries: [
        "A shared component or data-file edit affects every page that imports it. Imported files may contain fields unused by this particular page.",
        "CMS values and computed expressions retain their original data source.",
        ...models.flatMap((model) => model.boundaries),
      ],
    };
  }
  async prepareSource(
    projectId: string,
    edits: SourceEdits,
    media: { assetId: string; name: string; base64: string }[] = [],
  ): Promise<RepositoryPlan> {
    if (
      !edits?.inspection ||
      !edits.values ||
      !edits.orders ||
      Array.isArray(edits.values) ||
      Array.isArray(edits.orders)
    )
      throw new Error("Inspect the source page before proposing changes.");
    const current = await this.inspectSourcePage(
      edits.inspection.root,
      edits.inspection.route,
    );
    if (
      JSON.stringify(current.files) !== JSON.stringify(edits.inspection.files)
    )
      throw new Error(
        "Source changed since you opened it. Reopen the page before editing; no files were changed.",
      );
    if (
      Object.keys(edits.values).some(
        (id) => !current.fields.some((f) => f.id === id),
      ) ||
      Object.keys(edits.orders).some(
        (id) => !current.groups.some((g) => g.id === id),
      )
    )
      throw new Error("The source selection changed. Inspect the page again.");
    const files: Record<string, Uint8Array> = {},
      changes: FileChange[] = [];
    if (
      !Array.isArray(media) ||
      media.length > 100 ||
      (edits.assets &&
        (!Array.isArray(edits.assets) || edits.assets.length > 100))
    )
      throw new Error("Too many image replacements.");
    let mediaBytes = 0;
    for (const asset of edits.assets || []) {
      const field = current.fields.find(
        (f) => f.id === asset.fieldId && f.kind === "image",
      );
      const supplied = media.find((m) => m.assetId === asset.assetId);
      if (
        !field ||
        !supplied ||
        typeof supplied.base64 !== "string" ||
        supplied.base64.length > 45 * 1024 * 1024
      )
        throw new Error("Choose the replacement image again before reviewing.");
      const content = Buffer.from(supplied.base64, "base64");
      mediaBytes += content.length;
      if (!content.length || mediaBytes > 32 * 1024 * 1024)
        throw new Error("Image replacements support up to 32 MB per review.");
      const file = sourceAssetPath(field.value, supplied.name, hash(content));
      if (file !== asset.path || edits.values[field.id] !== `/${file.slice(7)}`)
        throw new Error("The replacement image changed. Choose it again.");
      if (files[file]) continue;
      const before = await bytes(current.root, file);
      if (before && hash(before) !== hash(content))
        throw new Error(
          "An image with this name already exists with different bytes.",
        );
      files[file] = content;
      changes.push({
        file,
        action: before ? "unchanged" : "create",
        before: before ? hash(before) : null,
        after: hash(content),
        preview: `Image · ${content.length} bytes`,
      });
    }
    const metadata = new Map<string, string | null>();
    for (const file of ["package.json", OWNERSHIP, ".kaizen/format.json"]) {
      const content = await bytes(current.root, file);
      metadata.set(file, content ? hash(content) : null);
    }
    const owned = await ownership(current.root);
    for (const item of current.files) {
      const before = await bytes(current.root, item.file);
      if (!before || hash(before) !== item.hash)
        throw new Error("Source changed during review. Inspect again.");
      const values = Object.fromEntries(
        Object.entries(edits.values).filter(([id]) =>
          current.fields.some((f) => f.file === item.file && f.id === id),
        ),
      );
      const orders = Object.fromEntries(
        Object.entries(edits.orders).filter(([id]) =>
          current.groups.some((g) => g.file === item.file && g.id === id),
        ),
      );
      const result = await editSource(
        item.file,
        before.toString(),
        values,
        orders,
      );
      const after = hash(Buffer.from(result));
      if (after !== item.hash && owned?.files[item.file])
        throw new Error(
          `Use the visual page editor for builder-owned source: ${item.file}`,
        );
      files[item.file] = Buffer.from(result);
      changes.push({
        file: item.file,
        action: after === item.hash ? "unchanged" : "update",
        before: item.hash,
        after,
        ...(after !== item.hash ? { preview: result } : {}),
      });
    }
    // Ownership or framework changes must also invalidate a reviewed native edit,
    // even when the page bytes themselves are unchanged.
    for (const [file, expected] of metadata) {
      const content = await bytes(current.root, file);
      const digest = content ? hash(content) : null;
      if (digest !== expected)
        throw new Error(
          "Repository metadata changed during review. Inspect again.",
        );
      changes.push({
        file,
        action: "unchanged",
        before: digest,
        after: digest,
      });
    }
    for (const [id, entry] of this.plans)
      if (entry.plan.expiresAt < Date.now()) this.plans.delete(id);
    if (this.plans.size >= 5)
      throw new Error(
        "Five proposals are pending. Apply one or wait for it to expire.",
      );
    const plan: RepositoryPlan = {
      id: randomUUID(),
      root: current.root,
      projectId,
      framework: "astro-react",
      changes,
      conflicts: [],
      expiresAt: Date.now() + 15 * 60_000,
    };
    this.plans.set(plan.id, { plan, files, applying: false });
    return plan;
  }
  async prepare(
    root: string,
    projectId: string,
    archive: Uint8Array,
  ): Promise<RepositoryPlan> {
    const inspection = await inspectRepository(root);
    if (inspection.framework === "unsupported")
      throw new Error(inspection.explanation);
    const source = unpack(archive);
    if (
      !source[".kaizen/project.zip"] ||
      !source[".kaizen/format.json"] ||
      !source["src/pages.json"]
    )
      throw new Error(
        "Export this project with its editable backup before integration.",
      );
    const format = JSON.parse(strFromU8(source[".kaizen/format.json"]));
    if (
      format.format !== "kaizen-repository" ||
      ![1, 2].includes(format.version)
    )
      throw new Error(
        "Incompatible incoming repository format. Update the builder before integration.",
      );
    readEditableArchive(source[".kaizen/project.zip"]);
    const files: Record<string, Uint8Array> = {};
    const owned = await ownership(inspection.root);
    const routeConflicts = new Map<string, string>();
    if (inspection.framework === "astro-react") {
      const pkg = JSON.parse(
        (await bytes(inspection.root, "package.json"))!.toString(),
      );
      if (!{ ...pkg.dependencies, ...pkg.devDependencies }.htmlparser2)
        throw new Error(
          "This Astro repository needs htmlparser2 for the reviewed rich-text renderer. Add htmlparser2 with pnpm in the repository, then inspect again. No package files have been changed.",
        );
      for (const [file, data] of Object.entries(source)) {
        if (file.startsWith("src/") && file !== "src/main.tsx")
          files[file.replace(/^src\//, "src/kaizen/")] = data;
        else if (
          /^(public\/|reference-packs\/|\.kaizen\/)/.test(file) &&
          file !== OWNERSHIP
        )
          files[file] = data;
        else if (file.startsWith("hosting/")) files[file] = data;
        else if (/^[A-Z-]+\.md$/.test(file))
          files[`.kaizen/handoff/${file}`] = data;
      }
      for (const file of ["sitemap.xml", "robots.txt"]) {
        const existing = inspection.routes.find(
          (route) =>
            route.ownership !== "builder-editable" &&
            route.file.startsWith(`src/pages/${file}`),
        );
        if (files[`public/${file}`] && existing)
          routeConflicts.set(
            `public/${file}`,
            `${existing.file} already manages this URL. Integrate the sitemap/robots rules with that developer-owned route first.`,
          );
      }
      const pages = JSON.parse(strFromU8(source["src/pages.json"]));
      for (const [index, page] of pages.entries()) {
        if (
          typeof page.slug !== "string" ||
          !/^[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?$/.test(page.slug) ||
          page.slug.includes("//")
        )
          throw new Error("Invalid exported page URL.");
        const file = `src/pages/${page.slug}.astro`;
        const competing = inspection.routes.find(
          (route) =>
            route.ownership !== "builder-editable" &&
            (route.file.includes("[") ||
              route.file
                .replace(/^src\/pages\//, "")
                .replace(/\.(astro|tsx?|jsx?|mdx?)$/, "")
                .replace(/\/index$/, "") === page.slug),
        );
        if (competing)
          routeConflicts.set(
            file,
            `Route may already be handled by ${competing.file}. Developer integration is required.`,
          );
        files[file] = Buffer.from(astroPage(page.slug, file));
        if (
          !index &&
          (!(await bytes(inspection.root, "src/pages/index.astro")) ||
            owned?.files["src/pages/index.astro"])
        )
          files["src/pages/index.astro"] = Buffer.from(
            astroPage(page.slug, "src/pages/index.astro"),
          );
      }
      files[".kaizen/format.json"] = Buffer.from(
        JSON.stringify(
          {
            format: "kaizen-repository",
            version: format.version,
            editableSource: ".kaizen/project.zip",
            output: "astro-react",
          },
          null,
          2,
        ),
      );
    } else
      for (const [file, data] of Object.entries(source))
        if (file !== OWNERSHIP && file !== ".gitignore") files[file] = data;
    const next: Ownership = {
      format: "kaizen-ownership",
      version: 1,
      files: Object.fromEntries(
        Object.entries(files).map(([file, data]) => [file, hash(data)]),
      ),
    };
    files[OWNERSHIP] = Buffer.from(JSON.stringify(next, null, 2));
    const changes: FileChange[] = [];
    for (const file of new Set([
      ...Object.keys(files),
      ...Object.keys(owned?.files || {}),
    ])) {
      const old = await bytes(inspection.root, file);
      const before = old ? hash(old) : null,
        after = files[file] ? hash(files[file]) : null;
      const conflict =
        routeConflicts.get(file) ||
        ((before !== null || Boolean(owned?.files[file])) &&
        before !== after &&
        file !== OWNERSHIP &&
        before !== owned?.files[file]
          ? "Existing file differs from the last builder version. Preserve or integrate this change manually."
          : undefined);
      changes.push({
        file,
        action:
          before === after
            ? "unchanged"
            : before === null
              ? "create"
              : after === null
                ? "delete"
                : "update",
        before,
        after,
        conflict,
        ...(/\.(astro|tsx?|jsx?|json|md|css)$/.test(file) &&
        files[file]?.byteLength < 100000
          ? { preview: strFromU8(files[file]) }
          : {}),
      });
    }
    const plan = {
      id: randomUUID(),
      root: inspection.root,
      projectId,
      framework: inspection.framework,
      changes,
      conflicts: changes.filter((c) => c.conflict).map((c) => c.file),
      expiresAt: Date.now() + 15 * 60_000,
    };
    for (const [id, entry] of this.plans)
      if (entry.plan.expiresAt < Date.now()) this.plans.delete(id);
    if (this.plans.size >= 5)
      throw new Error(
        "Five integration proposals are pending. Apply one or wait for it to expire.",
      );
    this.plans.set(plan.id, { plan, files, applying: false });
    return plan;
  }
  async apply(
    id: string,
    projectId: string,
    beforeMutation?: (
      changes: AppliedFileChange[],
      additionalBytes: number,
      sourceUsage: { bytes: number; projectedBytes: number; revision: string },
      replacements: ReadonlyMap<string, Uint8Array | null>,
    ) => Promise<void>,
  ) {
    const entry = this.plans.get(id);
    if (
      !entry ||
      entry.plan.projectId !== projectId ||
      entry.plan.expiresAt < Date.now()
    )
      throw new Error(
        "Integration proposal expired or belongs to another project. Review a new proposal.",
      );
    if (entry.applying)
      throw new Error("This proposal is already being applied.");
    if (entry.plan.conflicts.length)
      throw new Error("Resolve the listed file conflicts before applying.");
    entry.applying = true;
    const root = await repositoryRoot(entry.plan.root);
    const changed = entry.plan.changes.filter((c) => c.action !== "unchanged");
    const originals = new Map<string, Buffer | null>();
    const applied: FileChange[] = [];
    const temporaries: string[] = [];
    try {
      for (const change of entry.plan.changes) {
        const current = await bytes(root, change.file);
        if ((current ? hash(current) : null) !== change.before)
          throw new Error(
            `Changed since review: ${change.file}. Inspect again; nothing has been applied.`,
          );
        originals.set(change.file, current);
      }
      const replacements = new Map(
        changed.map((change) => [
          change.file,
          change.action === "delete" ? null : entry.files[change.file],
        ]),
      );
      // Retain a recovery copy before the first mutation. It is outside served output.
      await beforeMutation?.(
        changed.map(({ file, action, before, after }) => ({
          file,
          action,
          before,
          after,
        })),
        // Reserve both recovery copies and replacement temporaries, plus the
        // bounded receipt and directory overhead. The caller cannot supply this size.
        changed.reduce(
          (size, change) =>
            size +
            (originals.get(change.file)?.byteLength || 0) +
            (entry.files[change.file]?.byteLength || 0) +
            8192,
          4 * 1024 * 1024,
        ),
        await measureRepositorySource(root, replacements),
        replacements,
      );
      for (const change of changed) {
        const original = originals.get(change.file);
        if (original) {
          const recovery = await safePath(
            root,
            `.kaizen/recovery/${id}/${change.file}`,
          );
          await mkdir(path.dirname(recovery), { recursive: true });
          await writeFile(recovery, original, { flag: "wx" });
        }
      }
      for (const change of changed) {
        const current = await bytes(root, change.file);
        if ((current ? hash(current) : null) !== change.before)
          throw new Error(
            `Changed while applying: ${change.file}. The proposal must be reviewed again.`,
          );
        const target = await safePath(root, change.file);
        if (change.action === "delete") await unlink(target);
        else {
          await mkdir(path.dirname(target), { recursive: true });
          const temporary = `${target}.${entry.plan.id}.tmp`;
          temporaries.push(temporary);
          await writeFile(temporary, entry.files[change.file], { flag: "wx" });
          await rename(temporary, target);
        }
        applied.push(change);
      }
      this.plans.delete(id);
      for (const [previousId, previous] of this.appliedPlans)
        if (previous.root === root && previous.projectId === projectId)
          this.appliedPlans.delete(previousId);
      if (this.appliedPlans.size >= 20)
        this.appliedPlans.delete(this.appliedPlans.keys().next().value!);
      this.appliedPlans.set(id, {
        root,
        projectId,
        changes: changed,
        committing: false,
      });
      return {
        planId: id,
        files: changed.map((change) => change.file),
        changed: changed.length,
        root,
        message:
          "Files applied. Review the working tree in GitHub Desktop, then build and preview before deployment.",
      };
    } catch (error) {
      // Roll back only bytes still matching this transaction, preserving any
      // concurrent developer edits. Originals also remain in the recovery copy.
      const recoveryErrors: string[] = [];
      for (const change of applied.reverse()) {
        try {
          const current = await bytes(root, change.file);
          if ((current ? hash(current) : null) !== change.after) {
            recoveryErrors.push(change.file);
            continue;
          }
          const target = await safePath(root, change.file);
          const original = originals.get(change.file);
          if (original) await writeFile(target, original);
          else await unlink(target);
        } catch {
          recoveryErrors.push(change.file);
        }
      }
      this.plans.delete(id);
      // Admission failures happened before a source mutation. Preserve their
      // typed quota/unavailable status so the caller can explain the recovery.
      if (!applied.length) throw error;
      throw new Error(
        `${(error as Error).message}${recoveryErrors.length ? ` Recovery copies are in .kaizen/recovery/${id}; review ${recoveryErrors.join(", ")}.` : " Applied changes were reverted."}`,
      );
    } finally {
      for (const file of temporaries) await unlink(file).catch(() => {});
      entry.applying = false;
    }
  }
  async editableArchive(root: string): Promise<Buffer> {
    const inspection = await inspectRepository(root);
    const owned = await ownership(inspection.root);
    for (const [file, expected] of Object.entries(owned?.files || {})) {
      const current = await bytes(inspection.root, file);
      if (!current || hash(current) !== expected)
        throw new Error(
          `External change in ${file}. Reconcile generated code before reopening this repository visually.`,
        );
    }
    const archive = await bytes(inspection.root, ".kaizen/project.zip");
    if (!archive)
      throw new Error(
        "No editable project backup found. These pages require developer integration.",
      );
    return archive;
  }
}
