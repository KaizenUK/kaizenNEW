/** Versioned, JSON-only contract shared by the editor, storage and static renderer. */
export const BUILDER_VERSION = 1;
export const blockTypes = [
  "Section",
  "Container",
  "Columns",
  "Grid",
  "Text",
  "Image",
  "Icon",
  "Button",
  "Navigation",
  "Hero",
  "Features",
  "Gallery",
  "Testimonials",
  "Pricing",
  "CallToAction",
  "Footer",
] as const;
export type BlockType = (typeof blockTypes)[number];
export type Device = "desktop" | "tablet" | "mobile";
export type StyleValues = {
  padding?: number;
  gap?: number;
  columns?: number;
  fontSize?: number;
  maxWidth?: number;
  minHeight?: number;
  radius?: number;
  borderWidth?: number;
  margin?: number;
  background?: string;
  color?: string;
  borderColor?: string;
  align?: string;
  shadow?: string;
  hidden?: boolean;
  fontFamily?: string;
  backgroundImage?: string;
};
export type ResponsiveStyle = Partial<Record<Device, StyleValues>>;
export type Block = {
  type: BlockType;
  props: {
    id: string;
    text?: string;
    src?: string;
    alt?: string;
    href?: string;
    label?: string;
    eyebrow?: string;
    style?: ResponsiveStyle;
    children?: Block[];
    [key: string]: unknown;
  };
};
export type BuilderData = {
  root: { props?: Record<string, unknown> };
  content: Block[];
};
export type Theme = {
  accent: string;
  background: string;
  color: string;
  fontFamily: string;
  fontUrl?: string;
  radius: number;
};
export type PageDocument = {
  schemaVersion: 1;
  title: string;
  slug: string;
  description: string;
  noIndex: boolean;
  theme: Theme;
  data: BuilderData;
};
export type Revision = {
  id: string;
  createdAt: string;
  label: string;
  document: PageDocument;
};
export type BuilderPage = {
  id: string;
  version: number;
  draft: PageDocument;
  published: PageDocument | null;
  publishedAt?: string;
  updatedAt: string;
  revisions: Revision[];
};
export type AssetKind =
  | "image"
  | "icon"
  | "font"
  | "licence"
  | "code"
  | "design"
  | "other";
export type Asset = {
  id: string;
  hash: string;
  name: string;
  path: string;
  pack: string;
  kind: AssetKind;
  mime: string;
  size: number;
  url: string;
  tags: string[];
  favourite: boolean;
  createdAt: string;
};
export type SavedBlock = {
  id: string;
  name: string;
  kind: "section" | "template";
  blocks: Block[];
  theme?: Theme;
};
export type Workspace = {
  pages: BuilderPage[];
  assets: Asset[];
  saved: SavedBlock[];
};
export const defaultTheme: Theme = {
  accent: "#d5f86b",
  background: "#f7f8f2",
  color: "#182421",
  fontFamily: "Inter, system-ui, sans-serif",
  radius: 16,
};
export const newId = () => crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function freshBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) => ({
    ...clone(block),
    props: {
      ...clone(block.props),
      id: newId(),
      ...(block.props.children
        ? { children: freshBlocks(block.props.children) }
        : {}),
    },
  }));
}
export function safeUrl(value: unknown, media = false): string {
  if (typeof value !== "string" || /[\x00-\x20\\]/.test(value)) return "";
  if (/^\/(?!\/)/.test(value) || (!media && /^#[\w-]*$/.test(value)))
    return value;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ||
      u.protocol === "http:" ||
      (!media && ["mailto:", "tel:"].includes(u.protocol))
      ? value
      : "";
  } catch {
    return "";
  }
}
export function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (
    !/^[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?$/.test(slug) ||
    slug.includes("//") ||
    slug.length > 180
  )
    throw new Error(
      "Use a URL such as campaigns/summer, with letters, numbers and hyphens.",
    );
  // Builder pages own new URLs; existing public routes and their descendants stay with Astro/Sanity.
  const reserved =
    /^(builder|studio|api|editor-api|_astro|blog|blogdetail|insights|services|products|case-studies|about|contact|thank-you|index|home|review|pledge|contract-product-owner|performance-scanner|get-started|privacy-policy|cookie-policy|gdpr-policy|terms-and-conditions|web-design[^/]*|digital-transformation|agile-coaching|project-rescue|product-owner)(\/|$)/;
  if (reserved.test(slug))
    throw new Error(
      "This URL belongs to the existing site. Choose a new page URL.",
    );
  return slug;
}
export function validateDocument(value: PageDocument): PageDocument {
  if (!value || value.schemaVersion !== BUILDER_VERSION)
    throw new Error("Unsupported page version. Please update the builder.");
  if (typeof value.slug !== "string") throw new Error("Add a valid page URL.");
  normalizeSlug(value.slug);
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 200
  )
    throw new Error("Add a page title of 1–200 characters.");
  if (
    typeof value.description !== "string" ||
    value.description.length > 5000 ||
    typeof value.noIndex !== "boolean"
  )
    throw new Error("Invalid page settings.");
  const theme = value.theme;
  if (
    !theme ||
    [theme.accent, theme.background, theme.color, theme.fontFamily].some(
      (v) => typeof v !== "string",
    ) ||
    !Number.isFinite(theme.radius) ||
    (theme.fontUrl !== undefined && typeof theme.fontUrl !== "string")
  )
    throw new Error("Invalid global styles.");
  if (JSON.stringify(value).length > 2_000_000)
    throw new Error("This page is too large. Split it into smaller pages.");
  const ids = new Set<string>();
  function walk(blocks: Block[], depth: number) {
    if (!Array.isArray(blocks) || depth > 12)
      throw new Error("Pages support up to 12 levels of nesting.");
    for (const block of blocks) {
      if (
        !block ||
        !blockTypes.includes(block.type) ||
        typeof block.props?.id !== "string" ||
        !/^[\w-]+$/.test(block.props?.id) ||
        ids.has(block.props.id)
      )
        throw new Error("Invalid or duplicate page component.");
      ids.add(block.props.id);
      for (const key of ["text", "src", "alt", "href", "tag"]) {
        if (
          block.props[key] !== undefined &&
          typeof block.props[key] !== "string"
        )
          throw new Error("Invalid component text or media settings.");
      }
      if (block.props.style !== undefined) {
        if (
          !block.props.style ||
          typeof block.props.style !== "object" ||
          Array.isArray(block.props.style)
        )
          throw new Error("Invalid responsive styles.");
        for (const [device, settings] of Object.entries(block.props.style)) {
          if (
            !["desktop", "tablet", "mobile"].includes(device) ||
            !settings ||
            typeof settings !== "object" ||
            Array.isArray(settings) ||
            Object.values(settings).some(
              (v) =>
                !["string", "number", "boolean"].includes(typeof v) ||
                (typeof v === "number" && !Number.isFinite(v)),
            )
          )
            throw new Error("Invalid responsive styles.");
        }
      }
      if (ids.size > 1000)
        throw new Error("A page can contain up to 1,000 components.");
      if (block.props.children) walk(block.props.children, depth + 1);
    }
  }
  walk(value.data?.content, 0);
  return value;
}
export function savePage(
  pages: BuilderPage[],
  document: PageDocument,
  id: string,
  expected: number,
  label = "Saved draft",
): BuilderPage {
  validateDocument(document);
  const old = pages.find((p) => p.id === id);
  if ((old?.version ?? 0) !== expected)
    throw new Error(
      "This page changed in another window. Export your draft, then reopen the page before saving.",
    );
  if (
    pages.some(
      (p) =>
        p.id !== id &&
        (p.draft.slug === document.slug || p.published?.slug === document.slug),
    )
  )
    throw new Error("Another page already uses this URL.");
  const now = new Date().toISOString();
  const revision: Revision = {
    id: newId(),
    createdAt: now,
    label,
    document: clone(document),
  };
  return {
    id,
    version: expected + 1,
    draft: clone(document),
    published: old?.published ?? null,
    publishedAt: old?.publishedAt,
    updatedAt: now,
    revisions: [...(old?.revisions ?? []), revision].slice(-50),
  };
}
