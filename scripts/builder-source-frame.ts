import { Parser } from "htmlparser2";

/** Rewrite only the frozen preview bytes. Original source/build output is never changed. */
export function frameUrl(value: string, prefix: string) {
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    value !== prefix &&
    !value.startsWith(`${prefix}/`)
    ? prefix + value
    : value;
}

export function frameSrcset(value: string, prefix: string) {
  // URL tokens may contain commas (notably data URLs); descriptors end a candidate.
  return value.replace(
    /(^|,\s*|\s+)(\/[^\s,]+)(?=\s|,|$)/g,
    (_match, before, url) => before + frameUrl(url, prefix),
  );
}

export function frameCss(css: string, prefix: string) {
  // Skip comments and ordinary strings; only URL functions and quoted imports carry URLs.
  return css.replace(
    /\/\*[\s\S]*?\*\/|@import\s+(["'])(.*?)\1|url\(\s*(?:(["'])(.*?)\3|([^\s)]*))\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi,
    (whole, importQuote, imported, quote, quoted, bare) => {
      if (importQuote)
        return `@import ${importQuote}${frameUrl(imported, prefix)}${importQuote}`;
      if (quoted !== undefined || bare !== undefined)
        return `url(${quote || ""}${frameUrl(quoted ?? bare, prefix)}${quote || ""})`;
      return whole;
    },
  );
}

export function frameHtml(html: string, prefix: string) {
  const edits: { start: number; end: number; value: string }[] = [];
  let inStyle = false;
  const parser = new Parser(
    {
      onopentagname(name) {
        inStyle = name === "style";
      },
      onclosetag(name) {
        if (name === "style") inStyle = false;
      },
      onattribute(name, value) {
        const next =
          name === "style"
            ? frameCss(value, prefix)
            : ["srcset", "imagesrcset"].includes(name)
              ? frameSrcset(value, prefix)
              : [
                    "src",
                    "href",
                    "poster",
                    "content",
                    "component-url",
                    "renderer-url",
                  ].includes(name)
                ? frameUrl(value, prefix)
                : value;
        if (next === value) return;
        // Parser indices delimit the attribute, including its original quote (if any).
        const raw = html.slice(parser.startIndex, parser.endIndex + 1);
        const equals = raw.indexOf("=");
        if (equals < 0) return;
        const tail = raw.slice(equals + 1);
        const leading = tail.match(/^\s*/)?.[0].length || 0;
        const quote = tail[leading];
        const quoted = quote === '"' || quote === "'";
        const start = parser.startIndex + equals + 1 + leading;
        // Always quote the replacement and escape decoded entities safely.
        const escaped = next
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;");
        const end = quoted
          ? start + tail.slice(leading).lastIndexOf(quote) + 1
          : start + tail.slice(leading).match(/^[^\s>]+/)![0].length;
        edits.push({ start, end, value: `"${escaped}"` });
      },
      ontext(value) {
        if (inStyle) {
          const next = frameCss(value, prefix);
          if (next !== value)
            edits.push({
              start: parser.startIndex,
              end: parser.endIndex + 1,
              value: next,
            });
        }
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  for (const edit of edits.sort((a, b) => b.start - a.start))
    html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
  return html;
}
