import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  lstat,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import type { SourceDraft, SourceEdits } from "../shared/builderSourceEditing";

/** Private companion data, scoped by project directory and canonical repository/route. */
export class SourceDrafts {
  constructor(private directory: string) {}
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
  private validate(edits: SourceEdits | null, root: string, route: string) {
    if (edits === null) return;
    if (
      !edits ||
      !edits.inspection ||
      this.identity(edits.inspection.root, edits.inspection.route).file !==
        this.identity(root, route).file ||
      !Array.isArray(edits.inspection.files) ||
      !Array.isArray(edits.inspection.fields) ||
      !Array.isArray(edits.inspection.groups) ||
      !edits.values ||
      Array.isArray(edits.values) ||
      !edits.orders ||
      Array.isArray(edits.orders)
    )
      throw new Error("Invalid saved source edits.");
    for (const [id, value] of Object.entries(edits.values))
      if (
        typeof value !== "string" ||
        value.length > 20000 ||
        !edits.inspection.fields.some((f) => f.id === id)
      )
        throw new Error("Invalid editing draft field.");
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
