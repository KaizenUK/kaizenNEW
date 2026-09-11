import { parse } from "@astrojs/compiler";
import ts from "typescript";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseDocument } from "htmlparser2";
import type { SourceField, SourceGroup } from "../shared/builderSourceEditing";

type Range = { start: number; end: number };
type Field = SourceField & Range & { encoding: "html" | "attribute" | "js" };
type Group = Omit<SourceGroup, "items"> & {
  items: (SourceGroup["items"][number] & Range)[];
};
export const sourceHash = (source: string | Uint8Array) =>
  createHash("sha256").update(source).digest("hex");
const key = (file: string, type: string, offset: number) =>
  sourceHash(`${file}:${type}:${offset}`).slice(0, 24);
const textAttributes = new Set([
  "title",
  "description",
  "alt",
  "label",
  "placeholder",
  "aria-label",
  "heading",
  "headline",
  "subtitle",
  "buttonText",
  "ctaText",
]);
const textProperties = new Set([
  "title",
  "description",
  "copy",
  "text",
  "label",
  "heading",
  "headline",
  "subtitle",
  "question",
  "answer",
  "quote",
  "author",
  "name",
  "alt",
  "buttonText",
  "ctaText",
]);
const links = new Set(["href", "url", "to"]),
  images = new Set(["src", "image", "imageUrl", "poster"]);
const htmlText = (value: string) => {
  const document = parseDocument(
    value.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    { decodeEntities: true },
  );
  const read = (node: any): string =>
    node.type === "text" ? node.data : (node.children || []).map(read).join("");
  return read(document);
};
const encodeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
function kind(name: string): SourceField["kind"] {
  return links.has(name) ? "link" : images.has(name) ? "image" : "text";
}

/** Parse syntax, not rendered HTML: edits preserve imports, styles, scripts and hydration. */
export async function inspectSource(file: string, source: string) {
  const bytes = Buffer.from(source),
    fields: Field[] = [],
    groups: Group[] = [],
    imports: string[] = [],
    boundaries: string[] = [];
  const add = (
    start: number,
    end: number,
    label: string,
    value: string,
    encoding: Field["encoding"],
    fieldKind: SourceField["kind"] = "text",
  ) => {
    if (
      fields.some((f) => f.start === start && f.end === end) ||
      end <= start ||
      start < 0 ||
      end > bytes.length ||
      fields.length >= 2000
    )
      return;
    fields.push({
      id: key(file, "field", start),
      file,
      label,
      value,
      encoding,
      kind: fieldKind,
      start,
      end,
      line: bytes.subarray(0, start).toString().split("\n").length,
    });
  };
  function javascript(
    code: string,
    byteOffset: number,
    jsx: boolean,
    json = false,
  ) {
    const ast = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
      json ? ts.ScriptKind.JSON : jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if ((ast as any).parseDiagnostics.length) {
      throw new Error(
        `Fix the JavaScript/TypeScript syntax in ${file} before editing.`,
      );
    }
    const offset = (position: number) =>
      byteOffset + Buffer.byteLength(code.slice(0, position));
    function walk(node: ts.Node) {
      if (
        ts.isJsxElement(node) &&
        ["script", "style", "svg"].includes(
          node.openingElement.tagName.getText(ast),
        )
      )
        return;
      if (
        ts.isImportDeclaration(node) &&
        !node.importClause?.isTypeOnly &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        ts.isExportDeclaration(node) &&
        !node.isTypeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isStringLiteralLike(node.initializer)
      ) {
        const name = node.name.text;
        if (textProperties.has(name) || links.has(name) || images.has(name))
          add(
            offset(node.initializer.getStart(ast)),
            offset(node.initializer.end),
            name,
            node.initializer.text,
            "js",
            kind(name),
          );
      }
      if (ts.isJsxText(node) && node.getText(ast).trim()) {
        const raw = node.getText(ast),
          left = raw.length - raw.trimStart().length,
          right = raw.trimEnd().length;
        add(
          offset(node.getStart(ast) + left),
          offset(node.getStart(ast) + right),
          "Text",
          htmlText(raw.trim()),
          "html",
        );
      }
      if (
        ts.isJsxAttribute(node) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        const name = node.name.getText(ast);
        if (textAttributes.has(name) || links.has(name) || images.has(name))
          add(
            offset(node.initializer.getStart(ast)),
            offset(node.initializer.end),
            name,
            htmlText(node.initializer.text),
            "attribute",
            kind(name),
          );
      }
      if (
        ts.isPropertyAssignment(node) &&
        ts.isStringLiteralLike(node.initializer)
      ) {
        const name =
          ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
            ? node.name.text
            : "";
        if (textProperties.has(name) || links.has(name) || images.has(name))
          add(
            offset(node.initializer.getStart(ast)),
            offset(node.initializer.end),
            name,
            node.initializer.text,
            "js",
            kind(name),
          );
      }
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  if (/\.(tsx|jsx)$/.test(file)) javascript(source, 0, true);
  else if (/\.(ts|js|mjs|json)$/.test(file)) {
    if (file.endsWith(".json")) {
      try {
        JSON.parse(source);
      } catch {
        throw new Error(`Fix the JSON syntax in ${file} before editing.`);
      }
    }
    javascript(source, 0, false, file.endsWith(".json"));
  } else if (file.endsWith(".astro")) {
    const result = await parse(source, { position: true });
    if (result.diagnostics.some((d) => d.severity === 1))
      throw new Error(`Fix the Astro syntax in ${file} before editing.`);
    const openingEnd = (start: number) => {
      let quote = 0,
        braces = 0;
      for (let i = start; i < bytes.length; i++) {
        const c = bytes[i];
        if (quote) {
          if (c === 92 && braces) i++;
          else if (c === quote) quote = 0;
        } else if (c === 34 || c === 39 || c === 96) quote = c;
        else if (c === 123) braces++;
        else if (c === 125) braces--;
        else if (c === 62 && !braces) return i + 1;
      }
      throw new Error(`Incomplete element in ${file}`);
    };
    const range = (node: any): Range => ({
      start: node.position.start.offset,
      end: Math.max(
        node.position.end?.offset || 0,
        openingEnd(node.position.start.offset),
      ),
    });
    function walk(node: any, parent?: any) {
      if (node.type === "frontmatter") {
        javascript(node.value, node.position.start.offset + 3, false);
        return;
      }
      if (["style", "script", "svg"].includes(node.name)) return;
      if (
        node.type === "text" &&
        parent?.type !== "expression" &&
        node.value.trim()
      ) {
        const raw = bytes
          .subarray(node.position.start.offset, node.position.end.offset)
          .toString();
        if (raw !== node.value)
          throw new Error(
            `Source offsets changed in ${file}; reopen this source.`,
          );
        const left = raw.length - raw.trimStart().length;
        add(
          node.position.start.offset + Buffer.byteLength(raw.slice(0, left)),
          node.position.start.offset + Buffer.byteLength(raw.trimEnd()),
          parent?.name || "Text",
          htmlText(raw.trim()),
          "html",
        );
      }
      for (const attr of node.attributes || []) {
        if (
          attr.kind !== "quoted" ||
          !(
            textAttributes.has(attr.name) ||
            links.has(attr.name) ||
            images.has(attr.name)
          )
        )
          continue;
        const start = attr.position?.start.offset;
        if (start === undefined) continue;
        const tail = bytes.subarray(start).toString(),
          match = tail.match(/^[\w:-]+\s*=\s*(["'])/);
        if (!match) continue;
        const quoteStart = start + Buffer.byteLength(match[0]) - 1;
        const raw = attr.raw;
        if (
          !raw ||
          bytes
            .subarray(quoteStart, quoteStart + Buffer.byteLength(raw))
            .toString() !== raw
        )
          throw new Error(`Attribute offsets changed in ${file}`);
        add(
          quoteStart,
          quoteStart + Buffer.byteLength(raw),
          `${node.name} · ${attr.name}`,
          htmlText(attr.value),
          "attribute",
          kind(attr.name),
        );
      }
      const children = node.children || [];
      const movable = children.filter(
        (child: any) =>
          ["element", "component"].includes(child.type) &&
          !["style", "script", "head", "slot"].includes(child.name),
      );
      if (
        ["element", "component"].includes(node.type) &&
        !["head", "form", "select", "table"].includes(node.name) &&
        movable.length >= 2 &&
        children.every(
          (c: any) =>
            movable.includes(c) ||
            c.type === "comment" ||
            (c.type === "text" && !c.value.trim()),
        )
      ) {
        const items = movable.map((child: any) => ({
          ...range(child),
          id: key(file, "item", child.position.start.offset),
          label: child.name,
        }));
        if (
          items.some(
            (item: Range, i: number) =>
              item.end > (items[i + 1]?.start ?? node.position.end.offset),
          )
        )
          throw new Error(
            `Section boundaries overlap in ${file}; review its source syntax before rearranging.`,
          );
        groups.push({
          id: key(file, "group", node.position.start.offset),
          file,
          label: `${node.name} sections`,
          items,
        });
      }
      for (const child of children) walk(child, node);
    }
    walk(result.ast);
  } else
    throw new Error(
      "Source editing supports Astro, React and imported JavaScript, TypeScript or JSON content files.",
    );
  if (!fields.length)
    boundaries.push(
      `${file}: no literal content fields; dynamic values remain in their data source`,
    );
  return {
    file,
    hash: sourceHash(source),
    fields,
    groups,
    imports,
    boundaries,
  };
}

type Patch = Range & { value: string };
function replace(bytes: Buffer, start: number, end: number, patches: Patch[]) {
  let cursor = start,
    result = "";
  for (const patch of [...patches].sort((a, b) => a.start - b.start)) {
    if (patch.start < cursor || patch.end > end)
      throw new Error(
        "Overlapping source edits. Reorder one nested level at a time.",
      );
    result += bytes.subarray(cursor, patch.start).toString() + patch.value;
    cursor = patch.end;
  }
  return result + bytes.subarray(cursor, end).toString();
}
export async function editSource(
  file: string,
  source: string,
  values: Record<string, string>,
  orders: Record<string, string[]>,
) {
  const model = await inspectSource(file, source),
    bytes = Buffer.from(source),
    patches: Patch[] = [];
  for (const [id, value] of Object.entries(values)) {
    const field = model.fields.find((f) => f.id === id);
    if (!field)
      throw new Error(
        "The selected source field no longer exists. Inspect again.",
      );
    if (
      typeof value !== "string" ||
      value.length > 20000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new Error("Use text of at most 20,000 characters.");
    if (
      field.kind !== "text" &&
      value &&
      !/^(?:https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(value)
    )
      throw new Error(
        "Use an HTTPS/HTTP URL, site path, anchor, email or phone link.",
      );
    if (value === field.value) continue;
    patches.push({
      ...field,
      value:
        field.encoding === "js"
          ? JSON.stringify(value)
          : field.encoding === "attribute"
            ? `"${encodeHtml(value).replace(/"/g, "&quot;")}"`
            : encodeHtml(value),
    });
  }
  const moved: Range[] = [];
  for (const [id, order] of Object.entries(orders)) {
    const group = model.groups.find((g) => g.id === id);
    if (
      !group ||
      !Array.isArray(order) ||
      order.length !== group.items.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !group.items.some((i) => i.id === id))
    )
      throw new Error(
        "Keep each original section exactly once when reordering.",
      );
    const start = group.items[0].start,
      end = group.items[group.items.length - 1].end;
    if (order.every((id, i) => group.items[i].id === id)) continue;
    if (moved.some((range) => start < range.end && end > range.start))
      throw new Error("Reorder one nested level at a time.");
    moved.push({ start, end });
    const inside = patches.filter((p) => p.start >= start && p.end <= end);
    const chunks = group.items.map((item, i) => ({
      id: item.id,
      start: item.start,
      end: group.items[i + 1]?.start || end,
    }));
    const value = order
      .map((id) => {
        const chunk = chunks.find((c) => c.id === id)!;
        return replace(
          bytes,
          chunk.start,
          chunk.end,
          inside.filter((p) => p.start >= chunk.start && p.end <= chunk.end),
        );
      })
      .join("");
    for (const patch of inside) patches.splice(patches.indexOf(patch), 1);
    patches.push({ start, end, value });
  }
  const result = replace(bytes, 0, bytes.length, patches);
  await inspectSource(file, result); // Never return syntactically invalid replacement source.
  return result;
}

export function sourceImport(file: string, specifier: string) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return undefined;
  const resolved = specifier.startsWith("@/")
    ? `client/${specifier.slice(2)}`
    : path.posix.normalize(
        path.posix.join(path.posix.dirname(file), specifier),
      );
  if (
    !/^(src|client)\//.test(resolved) ||
    resolved.split("/").some((p) => p === ".." || p.startsWith("."))
  )
    return undefined;
  return resolved;
}
