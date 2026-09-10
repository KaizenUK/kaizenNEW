import React, { type ReactNode } from "react";
import { parseDocument } from "htmlparser2";
import { safeUrl } from "../../shared/visualBuilder";

type HtmlNode = ReturnType<typeof parseDocument>["children"][number];
const allowed = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "br",
  "hr",
  "span",
]);
const discarded = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "noscript",
]);

/** Convert the editor's formatting into React elements, never executable HTML. */
export default function RichText({ html }: { html: unknown }) {
  if (typeof html !== "string") return null;
  function render(nodes: HtmlNode[], depth = 0): ReactNode[] {
    if (depth > 32) return [];
    return nodes.map((node, index) => {
      if (node.type === "text") return node.data;
      if (!("attribs" in node) || discarded.has(node.name)) return null;
      const children = render(node.children, depth + 1);
      if (!allowed.has(node.name))
        return <React.Fragment key={index}>{children}</React.Fragment>;
      const props: Record<string, unknown> = { key: index };
      if (node.name === "a") {
        const href = safeUrl(node.attribs.href);
        if (!href)
          return <React.Fragment key={index}>{children}</React.Fragment>;
        props.href = href;
        if (node.attribs.target === "_blank") {
          props.target = "_blank";
          props.rel = "noopener noreferrer";
        }
        if (node.attribs.title) props.title = node.attribs.title;
      }
      const align = node.attribs.style?.match(
        /(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i,
      )?.[1];
      if (align) props.style = { textAlign: align.toLowerCase() };
      return React.createElement(
        node.name,
        props,
        ...(["br", "hr"].includes(node.name) ? [] : children),
      );
    });
  }
  return <>{render(parseDocument(html).children)}</>;
}
