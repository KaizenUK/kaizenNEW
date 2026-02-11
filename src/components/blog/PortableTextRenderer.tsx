import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock as SanityPortableTextBlock } from "@portabletext/types";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism-tomorrow.css";
import { urlFor, type PortableTextBlock } from "../../lib/sanity/client";

type CodeValue = {
  language?: string;
  code?: string;
};

type CallToActionValue = {
  label?: string;
  href?: string;
  style?: "primary" | "ghost" | string;
  newTab?: boolean;
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

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    normal: ({ children }) => <p>{children}</p>,
  },
  marks: {
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith("http") ? "_blank" : undefined}
        rel={value?.href?.startsWith("http")
          ? "noopener noreferrer"
          : undefined}
      >
        {children}
      </a>
    ),
  },
  types: {
    codeBlock: ({ value }) => {
      const highlighted = renderCode(value as CodeValue);
      const language = (value as CodeValue).language || "typescript";

      return (
        <pre>
          <code
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
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

      if (!href || !label) {
        return null;
      }

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
