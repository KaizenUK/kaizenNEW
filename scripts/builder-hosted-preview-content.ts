import { Parser } from "htmlparser2";
import ts from "typescript";
import { frameCss, frameHtml, frameUrl } from "./builder-source-frame";

export const previewMime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".vtt": "text/vtt",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const apply = (
  text: string,
  edits: { start: number; end: number; value: string }[],
) => {
  for (const edit of edits.sort((a, b) => b.start - a.start))
    text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
  return text;
};
const urlNames = new Set([
  "href",
  "src",
  "url",
  "poster",
  "action",
  "location",
]);
function isUrlLiteral(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
) {
  if (
    /^\/_astro\//.test(node.text) ||
    /^\/[^?#]*\.(?:m?js|css|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm|mp3|pdf)(?:[?#].*)?$/i.test(
      node.text,
    )
  )
    return true;
  const parent = node.parent;
  if (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  )
    return true;
  if (ts.isCallExpression(parent)) {
    if (parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
    if (
      ts.isPropertyAccessExpression(parent.expression) &&
      parent.expression.name.text === "setAttribute" &&
      parent.arguments[1] === node &&
      ts.isStringLiteral(parent.arguments[0]) &&
      urlNames.has(parent.arguments[0].text)
    )
      return true;
  }
  if (
    ts.isNewExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === "URL" &&
    parent.arguments?.[0] === node
  )
    return true;
  const name =
    ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)
      ? parent.name
      : ts.isBinaryExpression(parent) &&
          ts.isPropertyAccessExpression(parent.left)
        ? parent.left.name
        : undefined;
  return Boolean(
    name &&
    (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
    urlNames.has(name.text),
  );
}
/** Rebase asset/import and URL-property literals without changing ordinary visible text such as "/". */
export function hostedPreviewJs(text: string, prefix: string) {
  const source = ts.createSourceFile(
    "preview.js",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const edits: { start: number; end: number; value: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = isUrlLiteral(node)
        ? frameUrl(node.text, prefix)
        : node.text;
      if (value !== node.text)
        edits.push({
          start: node.getStart(source),
          end: node.end,
          value: JSON.stringify(value).replace(/</g, "\\u003c"),
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return apply(text, edits);
}

/** CSS font fetches cannot opt into credentials from an opaque origin. Embed only fonts in this frozen snapshot. */
export function hostedPreviewCss(
  text: string,
  prefix: string,
  file: string,
  files: ReadonlyMap<string, Buffer>,
) {
  let embedded = 0;
  return frameCss(text, prefix).replace(
    /url\(\s*(["']?)([^"'()]+)\1\s*\)/gi,
    (whole, quote, raw) => {
      const value = raw.trim();
      if (!/\.(woff2?|ttf|otf)(?:[?#].*)?$/i.test(value)) return whole;
      let url: URL, key: string;
      try {
        url = new URL(
          value,
          new URL(`${prefix}${file}`, "https://preview.invalid"),
        );
        key = decodeURIComponent(url.pathname.slice(prefix.length));
      } catch {
        return whole;
      }
      if (
        url.origin !== "https://preview.invalid" ||
        !url.pathname.startsWith(prefix + "/")
      )
        return whole;
      const bytes = files.get(key);
      if (
        !bytes ||
        bytes.length > 5 * 1024 * 1024 ||
        embedded + bytes.length > 8 * 1024 * 1024
      )
        return whole;
      embedded += bytes.length;
      const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
      return `url("data:${previewMime[extension]};base64,${bytes.toString("base64")}")`;
    },
  );
}

export function hostedPreviewHtml(
  text: string,
  prefix: string,
  file: string,
  files: ReadonlyMap<string, Buffer>,
  bridge?: string,
  baseUrl?: string,
) {
  text = frameHtml(text, prefix);
  const edits: { start: number; end: number; value: string }[] = [];
  let tag = "",
    inScript = false,
    inStyle = false;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === "base") {
          edits.push({
            start: parser.startIndex,
            end: parser.endIndex + 1,
            value: "",
          });
          return;
        }
        tag = name;
        inScript =
          name === "script" &&
          (!attrs.type ||
            ["module", "text/javascript", "application/javascript"].includes(
              attrs.type,
            ));
        inStyle = name === "style";
        const localAsset = [
          attrs.src,
          attrs.href,
          attrs.poster,
          attrs.srcset,
          attrs.imagesrcset,
        ].some(
          (value) => value && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value),
        );
        if (
          ["script", "link", "img", "audio", "video"].includes(name) &&
          (name === "script" || localAsset)
        ) {
          const start = parser.startIndex,
            end = parser.endIndex + 1;
          let opening = text
            .slice(start, end)
            .replace(
              /\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,
              "",
            );
          // Rewritten local assets no longer have their source build's SRI bytes.
          if (localAsset)
            opening = opening.replace(
              /\s+integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
              "",
            );
          opening = opening.replace(
            /\s*\/?>$/,
            (match) => ` crossorigin="use-credentials"${match}`,
          );
          edits.push({ start, end, value: opening });
        }
      },
      onclosetag(name) {
        if (name === tag) {
          inScript = false;
          inStyle = false;
        }
      },
      ontext(value) {
        const next = inScript
          ? hostedPreviewJs(value, prefix)
          : inStyle
            ? hostedPreviewCss(value, prefix, file, files)
            : value;
        if (next !== value)
          edits.push({
            start: parser.startIndex,
            end: parser.endIndex + 1,
            value: next,
          });
      },
    },
    { decodeEntities: false },
  );
  parser.end(text);
  text = apply(text, edits);
  if (baseUrl) {
    const base = `<base href="${baseUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`;
    text = /<head(?:\s[^>]*)?>/i.test(text)
      ? text.replace(/<head(?:\s[^>]*)?>/i, (match) => match + base)
      : base + text;
  }
  if (bridge) {
    const script = `<script crossorigin="use-credentials" src="${prefix}/__kaizen-canvas.js" defer></script>`;
    text = /<\/body\s*>/i.test(text)
      ? text.replace(/<\/body\s*>/i, script + "</body>")
      : text + script;
  }
  return text;
}

// A parser-blocking script installs the opaque frame's partitioned cookie before original assets are discovered.
export const previewBootstrapScript = `(()=>{const encoded=document.currentScript.dataset.kaizenHtml;const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));document.write(new TextDecoder().decode(bytes));})();`;
export const previewEnvelope = (html: string, bootstrap: string) =>
  `<!doctype html><script crossorigin="use-credentials" data-kaizen-html="${Buffer.from(html).toString("base64")}" src="${bootstrap}"></script>`;

/** The trusted wrapper initiates document navigation so its editor cookie accompanies the next page. */
export const previewNavigationScript = (
  nonce: string,
  origin: string,
  prefix: string,
) =>
  `(()=>{const {nonce,origin,prefix}=${JSON.stringify({ nonce, origin, prefix }).replace(/</g, "\\u003c")};document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download'))return;const url=new URL(link.getAttribute('href'),document.baseURI);if(url.origin!==origin||!url.pathname.startsWith(prefix+'/'))return;event.preventDefault();parent.postMessage({type:'kaizen-preview-navigate',nonce,route:url.pathname.slice(prefix.length)+url.search+url.hash},origin);});})();`;
