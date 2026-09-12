import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  lstat,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import type { SourceDraft, SourceEdits } from "../shared/builderSourceEditing";

/** Private companion data, scoped by project directory and canonical repository/route. */
export class SourceDrafts {
  constructor(private directory: string) {}
  async list(root: string): Promise<SourceDraft[]> {
    const directory = path.join(this.directory, "source-drafts");
    const stat = await lstat(directory).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    if (!stat) return [];
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Editing drafts cannot use a linked directory.");
    const names = await readdir(directory);
    if (names.length > 10000)
      throw new Error("Too many saved source editing drafts.");
    const normal = (value: string) =>
      process.platform === "win32"
        ? path.resolve(value).toLowerCase()
        : path.resolve(value);
    const drafts: SourceDraft[] = [];
    for (const name of names) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const file = path.join(directory, name),
        stat = await lstat(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 4 * 1024 * 1024
      )
        throw new Error(
          "Invalid saved editing draft. Preserve it for recovery.",
        );
      const value = JSON.parse(await readFile(file, "utf8"));
      if (typeof value.root !== "string" || !path.isAbsolute(value.root))
        throw new Error("Invalid saved editing draft repository.");
      if (normal(value.root) !== normal(root)) continue;
      if (path.basename(this.identity(root, value.route).file) !== name)
        throw new Error(
          "Saved editing draft identity does not match its file. Preserve it for recovery.",
        );
      const saved = await this.read(root, value.route);
      if (saved.edits) drafts.push(saved);
    }
    return drafts;
  }
  private identity(root: string, route: string) {
    if (
      typeof root !== "string" ||
      !path.isAbsolute(root) ||
      typeof route !== "string" ||
      !/^src\/pages\/[^\\]+\.(astro|tsx|jsx)$/.test(route) ||
      route.split("/").includes("..")
    )
      throw new Error(
        "Choose an inspected source page before saving an editing draft.",
      );
    const absolute = path.resolve(root);
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          process.platform === "win32" ? absolute.toLowerCase() : absolute,
          route,
        ]),
      )
      .digest("hex");
    return {
      root: absolute,
      route,
      file: path.join(this.directory, "source-drafts", `${key}.json`),
    };
  }
  async read(root: string, route: string): Promise<SourceDraft> {
    const identity = this.identity(root, route);
    const parent = await lstat(path.dirname(identity.file)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
      return undefined;
    });
    if (parent?.isSymbolicLink())
      throw new Error("Editing drafts cannot use a linked directory.");
    const stat = await lstat(identity.file).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    if (!stat)
      return {
        schemaVersion: 1,
        version: 0,
        root: identity.root,
        route,
        edits: null,
      };
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
      throw new Error(
        "The saved editing draft is invalid. Preserve it for recovery.",
      );
    const saved = JSON.parse(await readFile(identity.file, "utf8"));
    if (
      saved.schemaVersion !== 1 ||
      !Number.isSafeInteger(saved.version) ||
      saved.version < 1 ||
      this.identity(saved.root, saved.route).file !== identity.file
    )
      throw new Error(
        "The saved editing draft is incompatible. Preserve it for recovery.",
      );
    this.validate(saved.edits, identity.root, route);
    return saved;
  }
  validate(edits: SourceEdits | null, root: string, route: string) {
    if (edits === null) return;
    if (
      !edits ||
      !edits.inspection ||
      this.identity(edits.inspection.root, edits.inspection.route).file !==
        this.identity(root, route).file ||
      !Array.isArray(edits.inspection.files) ||
      !Array.isArray(edits.inspection.fields) ||
      !Array.isArray(edits.inspection.groups) ||
      !Array.isArray(edits.inspection.boundaries) ||
      !edits.values ||
      typeof edits.values !== "object" ||
      Array.isArray(edits.values) ||
      !edits.orders ||
      typeof edits.orders !== "object" ||
      Array.isArray(edits.orders)
    )
      throw new Error("Invalid saved source edits.");
    const sourcePath = (file: unknown) =>
      typeof file === "string" &&
      /^(src|client)\//.test(file) &&
      !file.includes("\\") &&
      !file.includes(":") &&
      !file.split("/").some((part) => !part || part === "." || part === "..");
    if (
      edits.inspection.files.some(
        (file) =>
          !file || !sourcePath(file.file) || !/^[a-f0-9]{64}$/.test(file.hash),
      ) ||
      edits.inspection.fields.some(
        (field) =>
          !field ||
          typeof field.id !== "string" ||
          !sourcePath(field.file) ||
          typeof field.value !== "string" ||
          typeof field.label !== "string" ||
          !Number.isSafeInteger(field.line) ||
          field.line < 1 ||
          !["text", "link", "image"].includes(field.kind),
      ) ||
      edits.inspection.groups.some(
        (group) =>
          !group ||
          typeof group.id !== "string" ||
          !sourcePath(group.file) ||
          typeof group.label !== "string" ||
          !Array.isArray(group.items) ||
          group.items.some(
            (item) =>
              !item ||
              typeof item.id !== "string" ||
              typeof item.label !== "string",
          ),
      ) ||
      edits.inspection.boundaries.some((value) => typeof value !== "string")
    )
      throw new Error("Invalid saved source inspection.");
    for (const [id, value] of Object.entries(edits.values))
      if (
        typeof value !== "string" ||
        value.length > 20000 ||
        !edits.inspection.fields.some((f) => f.id === id)
      )
        throw new Error("Invalid editing draft field.");
    if (
      edits.assets &&
      (!Array.isArray(edits.assets) ||
        edits.assets.length > 100 ||
        new Set(edits.assets.map((a) => a.fieldId)).size !==
          edits.assets.length ||
        edits.assets.some(
          (a) =>
            !a ||
            typeof a.assetId !== "string" ||
            a.assetId.length > 200 ||
            !/^public\/(?:[a-zA-Z0-9_-]+\/)*[a-f0-9]{64}\.(png|jpe?g|webp|avif|gif|svg)$/.test(
              a.path,
            ) ||
            !edits.inspection.fields.some(
              (f) => f.id === a.fieldId && f.kind === "image",
            ),
        ))
    )
      throw new Error("Invalid image replacement draft.");
    for (const [id, order] of Object.entries(edits.orders)) {
      const group = edits.inspection.groups.find((g) => g.id === id);
      if (
        !group ||
        !Array.isArray(order) ||
        new Set(order).size !== order.length ||
        order.length !== group.items.length ||
        order.some(
          (item) => !group.items.some((candidate) => candidate.id === item),
        )
      )
        throw new Error("Invalid editing draft section order.");
    }
  }
  async save(
    root: string,
    route: string,
    version: number,
    edits: SourceEdits | null,
  ) {
    const identity = this.identity(root, route);
    const previous = await this.read(root, route);
    if (!Number.isSafeInteger(version) || version !== previous.version)
      throw new Error(
        "This editing draft changed in another window. Reopen it before saving; your current edits are still in this form.",
      );
    this.validate(edits, root, route);
    const next: SourceDraft = {
      schemaVersion: 1,
      version: version + 1,
      root: identity.root,
      route,
      edits,
    };
    const body = JSON.stringify(next);
    if (Buffer.byteLength(body) > 4 * 1024 * 1024)
      throw new Error("This source editing draft exceeds 4 MB.");
    await mkdir(path.dirname(identity.file), { recursive: true });
    const temporary = `${identity.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, body, { flag: "wx", mode: 0o600 });
    try {
      await rename(temporary, identity.file);
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return next;
  }
}
