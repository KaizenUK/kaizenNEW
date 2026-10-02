import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock as SanityPortableTextBlock } from "@portabletext/types";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism-tomorrow.css";
import { urlFor, type PortableTextBlock } from "../../lib/sanity/client";
import { Button } from "../../../client/components/untitled/base/buttons/button";

type CodeValue = {
  language?: string;
  code?: string;
  filename?: string;
};

type CallToActionValue = {
  label?: string;
  href?: string;
  style?: "primary" | "ghost" | string;
  newTab?: boolean;
};

type VideoEmbedValue = {
  url?: string;
  caption?: string;
};

type TableCellValue = {
  content?: string;
};

type TableRowValue = {
  cells?: TableCellValue[];
};

type TableValue = {
  caption?: string;
  hasHeaderRow?: boolean;
  rows?: TableRowValue[];
};

interface PortableTextRendererProps {
  value?: PortableTextBlock[];
}

function renderCode(value: CodeValue) {
  const language = (value.language || "typescript").toLowerCase();
  const source = value.code || "";
  const grammar = Prism.languages[language] || Prism.languages.typescript;
  return Prism.highlight(source, grammar, language);
}

function getVideoEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

function normalizeTableRows(value: TableValue): string[][] {
  if (!Array.isArray(value.rows)) return [];

  return value.rows
    .map((row) =>
      Array.isArray(row?.cells)
        ? row.cells.map((cell) =>
            typeof cell?.content === "string" ? cell.content.trim() : "",
          )
        : [],
    )
    .filter((row) => row.length > 0 && row.some((cell) => cell.length > 0));
}

const components: PortableTextComponents = {
  block: {
    // The post title is the page's only H1. Body headings saved as H1 in
    // Sanity render as section headings.
    h1: ({ children }) => (
      <h2 className="font-heading mt-10 mb-4 text-2xl font-bold md:text-3xl">{children}</h2>
    ),
    h2: ({ children }) => (
      <h2 className="font-heading mt-10 mb-4 text-2xl font-bold md:text-3xl">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-heading mt-8 mb-3 text-xl font-bold md:text-2xl">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="font-heading mt-6 mb-2 text-lg font-bold md:text-xl">{children}</h4>
    ),
    normal: ({ children }) => <p>{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-uui-brand-600 bg-slate-50 py-4 pr-4 pl-5 text-slate-700">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
  marks: {
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith("http") ? "_blank" : undefined}
        rel={
          value?.href?.startsWith("http") ? "noopener noreferrer" : undefined
        }
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    code: ({ children }) => (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">{children}</code>
    ),
  },
  types: {
    codeBlock: ({ value }) => {
      const highlighted = renderCode(value as CodeValue);
      const language = (value as CodeValue).language || "typescript";
      const filename = (value as CodeValue).filename;

      return (
        <div className="my-6 overflow-hidden rounded-lg border border-slate-200">
          {filename && (
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              {filename}
            </div>
          )}
          <pre className="!m-0 !rounded-none">
            <code
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        </div>
      );
    },
    image: ({ value }) => {
      const imageUrl = urlFor(value)
        .width(1200)
        .fit("max")
        .quality(72)
        .format("webp")
        .url();
      // Reserve the rendered image's space, including any crop saved by the editor.
      const parsedUrl = new URL(imageUrl);
      const sourceSize = parsedUrl.pathname.match(/-(\d+)x(\d+)\.[^/]+$/);
      const crop = parsedUrl.searchParams.get("rect")?.split(",").map(Number);
      const sourceWidth = crop?.[2] || Number(sourceSize?.[1]);
      const sourceHeight = crop?.[3] || Number(sourceSize?.[2]);
      const width = sourceWidth > 0 ? Math.min(1200, sourceWidth) : undefined;
      const height = width && sourceHeight > 0
        ? Math.max(1, Math.round(width * sourceHeight / sourceWidth))
        : undefined;
      const altText =
        typeof value?.alt === "string" && value.alt.trim()
          ? value.alt
          : "Article image";

      return (
        <figure className="my-8 overflow-hidden rounded-xl border border-slate-200">
          <img
            src={imageUrl}
            alt={altText}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            className="h-auto w-full object-cover"
          />
        </figure>
      );
    },
    callToAction: ({ value }) => {
      const cta = value as CallToActionValue;
      const href = typeof cta.href === "string" ? cta.href.trim() : "";
      const label = typeof cta.label === "string" ? cta.label.trim() : "";

      if (!href || !label) return null;

      const isExternal =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:");
      const openInNewTab = Boolean(cta.newTab || isExternal);
      const isGhost = cta.style === "ghost";

      return (
        <div className="my-10">
          <Button
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noopener noreferrer" : undefined}
            className="guide-action"
            color={isGhost ? "secondary" : "primary"}
            size="lg"
          >
            <span>{label}</span>
          </Button>
        </div>
      );
    },
    videoEmbed: ({ value }) => {
      const video = value as VideoEmbedValue;
      const url = typeof video.url === "string" ? video.url.trim() : "";
      if (!url) return null;

      const embedUrl = getVideoEmbedUrl(url);
      if (!embedUrl) return null;

      return (
        <figure className="my-8">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200">
            <iframe
              src={embedUrl}
              title={video.caption || "Embedded video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 h-full w-full"
            />
          </div>
          {video.caption && (
            <figcaption className="mt-2 text-center text-sm text-slate-600">
              {video.caption}
            </figcaption>
          )}
        </figure>
      );
    },
    table: ({ value }) => {
      const table = value as TableValue;
      const rows = normalizeTableRows(table);

      if (rows.length === 0) return null;

      const hasHeaderRow = table.hasHeaderRow !== false;
      const [headerRow, ...bodyRows] = rows;
      const tableRows = hasHeaderRow ? bodyRows : rows;

      return (
        <figure className="my-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-slate-700">
              {hasHeaderRow && headerRow ? (
                <thead className="bg-slate-50">
                  <tr>
                    {headerRow.map((cell, index) => (
                      <th
                        key={`head-${index}`}
                        scope="col"
                        className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900"
                      >
                        <span className="whitespace-pre-line">{cell}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {(tableRows.length > 0 ? tableRows : hasHeaderRow ? [] : rows).map(
                  (row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="align-top">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className="border-t border-slate-200 px-4 py-3 text-slate-700 first:border-l-0"
                        >
                          <span className="whitespace-pre-line">{cell}</span>
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {table.caption ? (
            <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              {table.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    },
  },
};

// House style is plain punctuation. Copy pasted into Sanity often carries
// curly quotes and the ellipsis character, so body text is normalised here.
// Code blocks are left exactly as written.
const PLAIN_PUNCTUATION: [RegExp, string][] = [
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/\u2026/g, "..."],
];

export function plainPunctuation(text: string): string {
  return PLAIN_PUNCTUATION.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

function withPlainPunctuation(blocks: PortableTextBlock[]): PortableTextBlock[] {
  return blocks.map((block) =>
    block._type === "block" && Array.isArray(block.children)
      ? {
          ...block,
          children: block.children.map((child) =>
            typeof child.text === "string"
              ? { ...child, text: plainPunctuation(child.text) }
              : child,
          ),
        }
      : block,
  );
}

export default function PortableTextRenderer({
  value = [],
}: PortableTextRendererProps) {
  return (
    <div className="guide-prose">
      <PortableText
        value={withPlainPunctuation(value) as unknown as SanityPortableTextBlock[]}
        components={components}
      />
    </div>
  );
}
