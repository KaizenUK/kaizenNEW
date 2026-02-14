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

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="mt-10 mb-4 text-2xl font-bold">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 text-xl font-semibold">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-6 mb-2 text-lg font-semibold">{children}</h4>
    ),
    normal: ({ children }) => <p>{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-sky-400/50 pl-4 italic text-gray-300">
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
      <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">{children}</code>
    ),
  },
  types: {
    codeBlock: ({ value }) => {
      const highlighted = renderCode(value as CodeValue);
      const language = (value as CodeValue).language || "typescript";
      const filename = (value as CodeValue).filename;

      return (
        <div className="my-6 overflow-hidden rounded-lg border border-white/10">
          {filename && (
            <div className="border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-400">
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
        .width(1360)
        .fit("max")
        .auto("format")
        .url();
      const altText =
        typeof value?.alt === "string" && value.alt.trim()
          ? value.alt
          : "Article image";

      return (
        <figure className="my-8 overflow-hidden rounded-xl border border-white/10">
          <img
            src={imageUrl}
            alt={altText}
            loading="lazy"
            decoding="async"
            className="w-full object-cover"
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
          <a
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noopener noreferrer" : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition-colors duration-200 no-underline",
              isGhost
                ? "border-white/20 text-gray-200 hover:border-white/35 hover:text-white"
                : "border-sky-400/40 bg-sky-500/20 text-sky-100 hover:border-sky-300/60 hover:bg-sky-500/30",
            ].join(" ")}
          >
            <span>{label}</span>
          </a>
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
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
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
            <figcaption className="mt-2 text-center text-sm text-gray-400">
              {video.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
};

export default function PortableTextRenderer({
  value = [],
}: PortableTextRendererProps) {
  return (
    <div className="linear-prose">
      <PortableText
        value={value as unknown as SanityPortableTextBlock[]}
        components={components}
      />
    </div>
  );
}
