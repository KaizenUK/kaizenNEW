/** Versioned, JSON-only contract shared by the editor, storage and static renderer. */
import { validateRegisteredProps } from "./builderRegistry.ts";
import type { ConversionRequest } from "./builderConversions.ts";
import type { RouteState } from "./builderRouteTypes.ts";
export const BUILDER_VERSION = 1;
export const blockTypes = [
  "Section",
  "Container",
  "Columns",
  "Grid",
  "Text",
  "RichText",
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
  "Menu",
  "Accordion",
  "Tabs",
  "Video",
  "ContactForm",
  "ContentList",
  "Shared",
  "Registered",
] as const;
export type BlockType = (typeof blockTypes)[number];
export type ContentItem = { title: string; content: string };
export type MenuLink = { label: string; href: string };
export type ContentPost = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  image: string;
  alt: string;
  author: string;
  publishedAt: string;
  categories: string[];
};
export type ContentCatalogue = {
  posts: ContentPost[];
  categories: { id: string; title: string }[];
  fetchedAt: string;
  truncated: boolean;
};
export type ContentBinding = {
  postId: string;
  field: "title" | "excerpt" | "author" | "publishedAt" | "image" | "link";
};
export function needsBuilderRuntime(blocks: Block[]): boolean {
  return blocks.some(
    (block) =>
      ["Menu", "Tabs", "ContactForm"].includes(block.type) ||
      needsBuilderRuntime(block.props.children || []),
  );
}
export type Device = "desktop" | "tablet" | "mobile";
export type StyleValues = {
  tokens?: Record<string, string>;
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
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  rowGap?: number;
  columnGap?: number;
  columnWidths?: string;
  columnSpan?: number;
  order?: number;
  alignItems?: string;
  justifyItems?: string;
  width?: number;
  height?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  objectFit?: string;
  focalX?: number;
  focalY?: number;
  aspectRatio?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  hoverBackground?: string;
  hoverColor?: string;
  focusColor?: string;
};
export type ResponsiveStyle = Partial<Record<Device, StyleValues>>;
export function tokenGroupForStyle(key: string): string | undefined {
  if (
    [
      "color",
      "background",
      "borderColor",
      "overlayColor",
      "hoverBackground",
      "hoverColor",
      "focusColor",
    ].includes(key)
  )
    return "colors";
  if (["fontFamily", "fontSize", "lineHeight"].includes(key)) return key;
  if (
    /^(padding|margin)(Top|Right|Bottom|Left)?$/.test(key) ||
    [
      "gap",
      "rowGap",
      "columnGap",
      "radius",
      "borderWidth",
      "maxWidth",
      "minHeight",
      "height",
      "letterSpacing",
    ].includes(key)
  )
    return "spacing";
}
/** Resolve shorthands at each breakpoint before applying individual overrides. */
export function resolveResponsiveStyle(
  style: ResponsiveStyle = {},
  device: Device,
): StyleValues {
  let resolved: StyleValues = {};
  for (const breakpoint of ["desktop", "tablet", "mobile"] as const) {
    const next = style[breakpoint] || {};
    const tokens = { ...resolved.tokens };
    for (const key of Object.keys(next))
      if (key !== "tokens") delete tokens[key];
    for (const group of ["padding", "margin"] as const) {
      if (next[group] !== undefined) {
        for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
          resolved[`${group}${side}`] = next[group];
          delete tokens[`${group}${side}`];
        }
      }
    }
    if (next.gap !== undefined) {
      resolved.rowGap = resolved.columnGap = next.gap;
      delete tokens.rowGap;
      delete tokens.columnGap;
    }
    if (next.columns !== undefined) delete resolved.columnWidths;
    const mergedTokens = { ...tokens, ...next.tokens };
    for (const group of ["padding", "margin", "gap"])
      if (next.tokens?.[group] !== undefined) {
        for (const key of group === "gap"
          ? ["rowGap", "columnGap"]
          : ["Top", "Right", "Bottom", "Left"].map((side) => group + side))
          if (
            next[key as keyof StyleValues] === undefined &&
            next.tokens[key] === undefined
          )
            mergedTokens[key] = next.tokens[group];
      }
    resolved = { ...resolved, ...next };
    if (Object.keys(mergedTokens).length) resolved.tokens = mergedTokens;
    else delete resolved.tokens;
    if (breakpoint === device) break;
  }
  return resolved;
}
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
  tokens?: DesignTokens;
};
export type DesignTokens = Partial<
  Record<
    "colors" | "spacing" | "fontFamily" | "fontSize" | "lineHeight",
    Record<string, string | number>
  >
>;
export type SharedComponent = {
  id: string;
  name: string;
  kind: "section" | "header" | "footer";
  blocks: Block[];
};
export type SiteDesign = {
  schemaVersion: 1;
  theme: Theme;
  components: SharedComponent[];
};
export type SiteState = {
  version: number;
  draft: SiteDesign;
  published: SiteDesign | null;
  revisions: { id: string; createdAt: string; design: SiteDesign }[];
};
export type PageDocument = {
  schemaVersion: 1;
  title: string;
  slug: string;
  description: string;
  noIndex: boolean;
  theme: Theme;
  data: BuilderData;
  site?: { useTheme?: boolean; headerId?: string; footerId?: string };
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
export type ImageVariant = {
  url: string;
  width: number;
  height: number;
  size: number;
  hash: string;
};
export type AssetImage = {
  source: string;
  status: "ready" | "original";
  width?: number;
  height?: number;
  variants: ImageVariant[];
  note?: string;
};
export type Asset = {
  id: string;
  hash: string;
  name: string;
  path: string;
  pack: string;
  originalPack?: string;
  generatedFrom?: string;
  image?: AssetImage;
  conversion?: ConversionRequest;
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
  site?: SiteState;
  routes?: RouteState;
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
  if (theme.tokens !== undefined) {
    if (
      !theme.tokens ||
      typeof theme.tokens !== "object" ||
      Array.isArray(theme.tokens)
    )
      throw new Error("Invalid design tokens.");
    for (const [group, values] of Object.entries(theme.tokens)) {
      if (
        !["colors", "spacing", "fontFamily", "fontSize", "lineHeight"].includes(
          group,
        ) ||
        !values ||
        typeof values !== "object" ||
        Array.isArray(values) ||
        Object.keys(values).length > 100
      )
        throw new Error("Invalid design tokens.");
      for (const [key, token] of Object.entries(values))
        if (
          !/^[a-z][\w-]{0,40}$/.test(key) ||
          (group === "colors" || group === "fontFamily"
            ? typeof token !== "string"
            : typeof token !== "number" || !Number.isFinite(token))
        )
          throw new Error("Invalid design token value.");
    }
  }
  if (
    value.site !== undefined &&
    (!value.site ||
      typeof value.site !== "object" ||
      Array.isArray(value.site) ||
      (value.site.useTheme !== undefined &&
        typeof value.site.useTheme !== "boolean") ||
      [value.site.headerId, value.site.footerId].some(
        (id) =>
          id !== undefined && (typeof id !== "string" || !/^[\w-]+$/.test(id)),
      ))
  )
    throw new Error("Invalid shared page settings.");
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
      if (block.type === "Registered") validateRegisteredProps(block.props);
      for (const key of [
        "text",
        "html",
        "src",
        "alt",
        "href",
        "tag",
        "label",
        "poster",
        "captions",
        "captionLanguage",
        "description",
        "submitLabel",
        "successMessage",
        "privacyText",
        "privacyUrl",
        "marketingText",
      ]) {
        if (
          block.props[key] !== undefined &&
          typeof block.props[key] !== "string"
        )
          throw new Error("Invalid component text or media settings.");
      }
      if (block.type === "ContactForm") {
        for (const key of [
          "showPhone",
          "showSurname",
          "showWebsite",
          "showMarketing",
        ])
          if (
            block.props[key] !== undefined &&
            !["yes", "no"].includes(String(block.props[key]))
          )
            throw new Error("Invalid contact form field settings.");
      }
      const binding = block.props.contentBinding as ContentBinding | undefined;
      if (
        binding !== undefined &&
        (!binding ||
          typeof binding !== "object" ||
          typeof binding.postId !== "string" ||
          !binding.postId ||
          binding.postId.length > 200 ||
          !["Text", "Image", "Button"].includes(block.type) ||
          !(
            block.type === "Text"
              ? ["title", "excerpt", "author", "publishedAt"]
              : block.type === "Image"
                ? ["image"]
                : ["link"]
          ).includes(binding.field))
      )
        throw new Error("Choose a supported Sanity field for this component.");
      if (block.type === "ContentList") {
        if (
          typeof block.props.limit !== "number" ||
          !Number.isInteger(block.props.limit) ||
          block.props.limit < 1 ||
          block.props.limit > 24 ||
          !["newest", "oldest", "title"].includes(String(block.props.sort)) ||
          !["cards", "minimal", "list"].includes(String(block.props.variant)) ||
          typeof block.props.categoryId !== "string" ||
          block.props.categoryId.length > 200
        )
          throw new Error("Check the Sanity listing settings (1–24 posts).");
        for (const key of [
          "showImages",
          "showExcerpts",
          "showAuthors",
          "showDates",
        ])
          if (!["yes", "no"].includes(String(block.props[key])))
            throw new Error("Invalid listing display settings.");
        if (
          block.props.records !== undefined &&
          (!Array.isArray(block.props.records) ||
            block.props.records.length > 24 ||
            block.props.records.some(
              (record) =>
                !record ||
                [
                  "id",
                  "title",
                  "excerpt",
                  "href",
                  "image",
                  "alt",
                  "author",
                  "publishedAt",
                ].some((key) => typeof record[key] !== "string") ||
                !Array.isArray(record.categories) ||
                record.categories.some((id: unknown) => typeof id !== "string"),
            ))
        )
          throw new Error("Invalid listing content snapshot.");
      }
      for (const [key, fields, limit] of [
        ["items", ["title", "content"], 30],
        ["links", ["label", "href"], 20],
      ] as const) {
        const entries = block.props[key];
        if (
          entries !== undefined &&
          (!Array.isArray(entries) ||
            entries.length > limit ||
            entries.some(
              (item) =>
                !item ||
                fields.some((field) => typeof item[field] !== "string"),
            ))
        )
          throw new Error(`Invalid ${key}. Use up to ${limit} text entries.`);
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
            Object.entries(settings).some(([key, v]) =>
              key === "tokens"
                ? !v ||
                  typeof v !== "object" ||
                  Array.isArray(v) ||
                  Object.values(v).some((token) => typeof token !== "string")
                : !["string", "number", "boolean"].includes(typeof v) ||
                  (typeof v === "number" && !Number.isFinite(v)),
            )
          )
            throw new Error("Invalid responsive styles.");
        }
      }
      if (
        block.type === "Shared" &&
        (typeof block.props.componentId !== "string" ||
          !/^[\w-]+$/.test(block.props.componentId))
      )
        throw new Error("Choose a valid shared component.");
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
