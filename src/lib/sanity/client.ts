import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import type {
  ManagedCallToAction,
  ManagedCtaSection,
  ManagedFaqSection,
  ManagedFeaturesSection,
  ManagedHeroSection,
  ManagedImageGallerySection,
  ManagedImageValue,
  ManagedPageData,
  ManagedPageSection,
  ManagedRichTextSection,
  ManagedSectionSettings,
  ManagedSeo,
  ManagedStatsSection,
  ManagedTestimonialsSection,
  ManagedVideoSection,
  ManagedLayoutColumn,
  ManagedLayoutRowSection,
} from "@shared/pageBuilder";
export type { SanityImageSource } from "@sanity/image-url";

/** Re-export shared types under Sanity-prefixed aliases for section components. */
export type SanitySectionSettings = ManagedSectionSettings;
export type SanityCallToAction = ManagedCallToAction;
export type SanityHeroSection = ManagedHeroSection;
export type SanityRichTextSection = ManagedRichTextSection;
export type SanityFeaturesSection = ManagedFeaturesSection;
export type SanityCtaSection = ManagedCtaSection;
export type SanityTestimonialsSection = ManagedTestimonialsSection;
export type SanityFaqSection = ManagedFaqSection;
export type SanityStatsSection = ManagedStatsSection;
export type SanityImageGallerySection = ManagedImageGallerySection;
export type SanityVideoEmbedSection = ManagedVideoSection;
export type SanityLayoutColumn = ManagedLayoutColumn;
export type SanityLayoutRowSection = ManagedLayoutRowSection;

// Resolve env vars from import.meta.env (Astro/Vite, client+server)
// with fallback to process.env (Node SSR).
function getEnv(key: string): string | undefined {
  const metaEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
  if (metaEnv[key]) return metaEnv[key];
  if (typeof process !== "undefined" && process.env?.[key]) return process.env[key];
  return undefined;
}

const projectId = getEnv("PUBLIC_SANITY_PROJECT_ID") ?? getEnv("SANITY_PROJECT_ID") ?? "";
const dataset = getEnv("PUBLIC_SANITY_DATASET") ?? getEnv("SANITY_DATASET") ?? "production";
const token = getEnv("SANITY_API_TOKEN");

const hasSanityConfig = Boolean(projectId && dataset);

// ── Types ──────────────────────────────────────────────────────────

export interface PortableTextSpan {
  _type: string;
  text?: string;
}

export interface PortableTextBlock {
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  code?: string;
  [key: string]: unknown;
}

export interface SanityImagePaletteSwatch {
  background?: string;
  foreground?: string;
  population?: number;
  title?: string;
}

export interface SanityImageMetadata {
  palette?: {
    dominant?: SanityImagePaletteSwatch;
  };
}

export interface SanityImageAsset {
  _id?: string;
  url?: string;
  metadata?: SanityImageMetadata;
}

export type SanityImageValue = SanityImageSource & {
  alt?: string;
  asset?: SanityImageAsset & { _ref?: string; _type?: "reference" };
};

export interface SanityAuthor {
  name: string;
  image?: SanityImageValue;
}

export interface SanityCategory {
  _id: string;
  title: string;
  slug: string;
}

export interface SanitySeo {
  metaTitle?: string;
  metaDescription?: string;
  shareImage?: SanityImageValue;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface SanityStaticPage {
  _id: string;
  title: string;
  slug: string;
  seo?: SanitySeo;
}

export interface SanityPage {
  _id: string;
  _type?: "page";
  title?: string;
  slug?: string;
  replaceRouteContent?: boolean;
  seo?: SanitySeo;
  content?: ManagedPageSection[];
}

export interface SanityPost {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt?: string;
  readTime?: number;
  coverImage?: SanityImageValue;
  mainImage?: SanityImageValue;
  body?: PortableTextBlock[];
  author?: SanityAuthor;
  categories?: SanityCategory[];
  seo?: SanitySeo;
}

export interface SanityRedirect {
  source: string;
  destination: string;
  isPermanent: boolean;
}

// ── Clients ────────────────────────────────────────────────────────

export const sanityClient = hasSanityConfig
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2025-01-01", // Align with sanity.config.ts
      useCdn: !token,
      token,
      perspective: "published",
    })
  : null;

/** Client that fetches draft content for preview mode. */
export const previewClient = hasSanityConfig
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2025-01-01", // Align with sanity.config.ts
      useCdn: false,
      token,
      perspective: "previewDrafts",
      stega: {
        enabled: true,
        studioUrl: "/studio",
      },
    })
  : null;

// ── Image helpers ──────────────────────────────────────────────────

const imageBuilder = sanityClient ? createImageUrlBuilder(sanityClient) : null;

export const urlFor = (source: SanityImageSource) => {
  if (!imageBuilder) {
    throw new Error(
      "Sanity image URL builder is unavailable. Configure PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET.",
    );
  }
  return imageBuilder.image(source);
};

export function getDominantImagePalette(
  image?: SanityImageValue,
): SanityImagePaletteSwatch | undefined {
  return image?.asset?.metadata?.palette?.dominant;
}

// ── Read-time estimation ───────────────────────────────────────────

export function estimateReadTime(body: PortableTextBlock[] = []): number {
  const text = body
    .map((block) => {
      const blockCode = typeof block.code === "string" ? block.code : undefined;
      if (blockCode) return blockCode;
      if (!Array.isArray(block.children)) return "";
      return block.children
        .map((child) => (typeof child?.text === "string" ? child.text : ""))
        .join(" ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return 1;
  return Math.max(1, Math.round(text.split(" ").length / 220));
}

function normalizePost(post: SanityPost): SanityPost {
  return {
    ...post,
    excerpt: post.excerpt?.trim() || "No summary has been added yet.",
    readTime:
      typeof post.readTime === "number" && post.readTime > 0
        ? post.readTime
        : estimateReadTime(post.body ?? []),
  };
}

// ── GROQ Queries ───────────────────────────────────────────────────

const IMAGE_ASSET_PROJECTION = `{
  _id,
  url,
  metadata {
    palette {
      dominant { background, foreground, population, title }
    }
  }
}`;

const POST_PROJECTION = `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  readTime,
  coverImage {
    ...,
    asset->${IMAGE_ASSET_PROJECTION}
  },
  mainImage {
    ...,
    asset->${IMAGE_ASSET_PROJECTION}
  },
  seo {
    metaTitle,
    metaDescription,
    canonicalUrl,
    shareImage {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  },
  body[] {
    ...,
    _type == "image" => {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  },
  "author": author->{ name, image { ..., asset->${IMAGE_ASSET_PROJECTION} } },
  "categories": categories[]->{ _id, title, "slug": slug.current }
`;

const POSTS_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
  ${POST_PROJECTION}
}`;

const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0] {
  ${POST_PROJECTION}
}`;

const POST_BY_ID_QUERY = `*[_type == "post" && _id in [$id, "drafts." + $id]][0] {
  ${POST_PROJECTION}
}`;

const POSTS_BY_CATEGORY_QUERY = `*[_type == "post" && defined(slug.current) && $categoryId in categories[]._ref] | order(publishedAt desc) {
  ${POST_PROJECTION}
}`;

const CATEGORIES_QUERY = `*[_type == "category"] | order(title asc) {
  _id,
  title,
  "slug": slug.current
}`;

const REDIRECTS_QUERY = `*[_type == "redirect"] {
  source,
  destination,
  isPermanent
}`;

const STATIC_PAGE_BY_SLUG_QUERY = `*[_type == "staticPage" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  seo {
    metaTitle,
    metaDescription,
    canonicalUrl,
    noIndex,
    shareImage {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  }
}`;

const SETTINGS_PROJECTION = `
  settings {
    ...,
    backgroundImage {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  }
`;

const PAGE_SECTION_PROJECTION = `
  ...,
  ${SETTINGS_PROJECTION},
  _type == "hero" => {
    ...,
    ${SETTINGS_PROJECTION},
    image {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    },
    buttonLink {
      ...
    }
  },
  _type == "richTextSection" => {
    ...,
    ${SETTINGS_PROJECTION},
    body[] {
      ...,
      _type == "image" => {
        ...,
        asset->${IMAGE_ASSET_PROJECTION}
      },
      _type == "callToAction" => {
        ...
      },
      _type == "codeBlock" => {
        ...
      },
      _type == "videoEmbed" => {
        ...
      }
    }
  },
  _type == "features" => {
    ...,
    ${SETTINGS_PROJECTION},
    items[] {
      ...
    }
  },
  _type == "ctaSection" => {
    ...,
    ${SETTINGS_PROJECTION},
    buttonLink {
      ...
    }
  },
  _type == "testimonials" => {
    ...,
    ${SETTINGS_PROJECTION},
    items[] {
      ...,
      image {
        ...,
        asset->${IMAGE_ASSET_PROJECTION}
      }
    }
  },
  _type == "faqSection" => {
    ...,
    ${SETTINGS_PROJECTION},
    items[] {
      ...
    }
  },
  _type == "statsSection" => {
    ...,
    ${SETTINGS_PROJECTION},
    items[] {
      ...
    }
  },
  _type == "imageGallery" => {
    ...,
    ${SETTINGS_PROJECTION},
    images[] {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  },
  _type == "videoEmbed" => {
    ...,
    ${SETTINGS_PROJECTION}
  },
  _type == "pricingSection" => {
    ...,
    ${SETTINGS_PROJECTION},
    tiers[] {
      ...,
      buttonLink {
        ...
      }
    }
  },
  _type == "logoBar" => {
    ...,
    ${SETTINGS_PROJECTION},
    logos[] {
      ...,
      "imageUrl": image.asset->url
    }
  },
  _type == "teamGrid" => {
    ...,
    ${SETTINGS_PROJECTION},
    members[] {
      ...,
      "imageUrl": image.asset->url
    }
  },
  _type == "contactForm" => {
    ...,
    ${SETTINGS_PROJECTION},
    fields[] {
      ...
    }
  },
  _type == "layoutRow" => {
    ...,
    ${SETTINGS_PROJECTION},
    columns[] {
      ...,
      content[] {
        ...,
        ${SETTINGS_PROJECTION},
        _type == "hero" => {
          ...,
          ${SETTINGS_PROJECTION},
          image { ..., asset->${IMAGE_ASSET_PROJECTION} },
          buttonLink { ... }
        },
        _type == "richTextSection" => {
          ...,
          ${SETTINGS_PROJECTION},
          body[] {
            ...,
            _type == "image" => { ..., asset->${IMAGE_ASSET_PROJECTION} },
            _type == "callToAction" => { ... },
            _type == "codeBlock" => { ... },
            _type == "videoEmbed" => { ... }
          }
        },
        _type == "testimonials" => {
          ...,
          ${SETTINGS_PROJECTION},
          items[] { ..., image { ..., asset->${IMAGE_ASSET_PROJECTION} } }
        },
        _type == "imageGallery" => {
          ...,
          ${SETTINGS_PROJECTION},
          images[] { ..., asset->${IMAGE_ASSET_PROJECTION} }
        },
        _type == "pricingSection" => {
          ...,
          ${SETTINGS_PROJECTION},
          tiers[] { ..., buttonLink { ... } }
        },
        _type == "logoBar" => {
          ...,
          ${SETTINGS_PROJECTION},
          logos[] { ..., "imageUrl": image.asset->url }
        },
        _type == "teamGrid" => {
          ...,
          ${SETTINGS_PROJECTION},
          members[] { ..., "imageUrl": image.asset->url }
        }
      }
    }
  }
`;

const PAGE_BY_SLUGS_QUERY = `*[_type == "page" && slug.current in $slugs][0] {
  _id,
  _type,
  title,
  "slug": slug.current,
  "replaceRouteContent": coalesce(replaceRouteContent, false),
  seo {
    metaTitle,
    metaDescription,
    canonicalUrl,
    noIndex,
    shareImage {
      ...,
      asset->${IMAGE_ASSET_PROJECTION}
    }
  },
  content[] {
    ${PAGE_SECTION_PROJECTION}
  }
}`;

function normalizeRoutePath(pathname: string): string {
  const raw = String(pathname ?? "").trim();
  if (!raw || raw === "/") return "/";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized !== "/" && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

function getPageSlugCandidates(pathname: string): string[] {
  const normalizedRoute = normalizeRoutePath(pathname);
  if (normalizedRoute === "/") {
    return ["home", "index", ""];
  }

  const noLeadingSlash = normalizedRoute.replace(/^\/+/, "");
  const noTrailingSlash = noLeadingSlash.replace(/\/+$/, "");
  const dashedPath = noTrailingSlash.replace(/\//g, "-");
  const lastSegment = noTrailingSlash.split("/").filter(Boolean).pop() || "";

  return Array.from(
    new Set(
      [
        noTrailingSlash,
        normalizedRoute,
        noLeadingSlash,
        dashedPath,
        lastSegment,
      ].filter(Boolean),
    ),
  );
}

function normalizeManagedPage(
  page: SanityPage | null,
  pathname: string,
): ManagedPageData | null {
  if (!page) return null;

  const seo: ManagedSeo | undefined = page.seo
    ? {
        metaTitle: page.seo.metaTitle,
        metaDescription: page.seo.metaDescription,
        canonicalUrl: page.seo.canonicalUrl,
        noIndex: page.seo.noIndex,
        shareImage: page.seo.shareImage as ManagedImageValue | undefined,
      }
    : undefined;

  return {
    _id: page._id,
    _type: page._type,
    title: page.title,
    slug: page.slug,
    routePath: normalizeRoutePath(pathname),
    replaceRouteContent: Boolean(page.replaceRouteContent),
    seo,
    content: (page.content ?? []) as ManagedPageSection[],
  };
}

// ── Query functions ────────────────────────────────────────────────

export async function getAllPosts(): Promise<SanityPost[]> {
  if (!sanityClient) return [];
  const posts = await sanityClient.fetch<SanityPost[]>(POSTS_QUERY);
  return posts.map(normalizePost);
}

export async function getPostBySlug(
  slug: string,
  preview = false,
): Promise<SanityPost | null> {
  const client = preview ? previewClient : sanityClient;
  if (!client) return null;
  const post = await client.fetch<SanityPost | null>(POST_BY_SLUG_QUERY, {
    slug,
  });
  return post ? normalizePost(post) : null;
}

export async function getPostById(
  id: string,
  preview = false,
): Promise<SanityPost | null> {
  const normalizedId = String(id)
    .replace(/^drafts\./, "")
    .trim();
  if (!normalizedId) return null;

  const client = preview ? previewClient : sanityClient;
  if (!client) return null;

  const post = await client.fetch<SanityPost | null>(POST_BY_ID_QUERY, {
    id: normalizedId,
  });

  return post ? normalizePost(post) : null;
}

export async function getPostsByCategory(
  categoryId: string,
): Promise<SanityPost[]> {
  if (!sanityClient) return [];
  const posts = await sanityClient.fetch<SanityPost[]>(
    POSTS_BY_CATEGORY_QUERY,
    { categoryId },
  );
  return posts.map(normalizePost);
}

export async function getAllCategories(): Promise<SanityCategory[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<SanityCategory[]>(CATEGORIES_QUERY);
}

export async function getAllRedirects(): Promise<SanityRedirect[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<SanityRedirect[]>(REDIRECTS_QUERY);
}

export async function getStaticPageBySlug(
  slug: string,
  preview = false,
): Promise<SanityStaticPage | null> {
  const client = preview ? previewClient : sanityClient;
  if (!client) return null;
  return client.fetch<SanityStaticPage | null>(STATIC_PAGE_BY_SLUG_QUERY, {
    slug,
  });
}

export async function getPageByPath(
  pathname: string,
  preview = false,
): Promise<ManagedPageData | null> {
  const client = preview ? previewClient : sanityClient;
  if (!client) return null;

  const slugCandidates = getPageSlugCandidates(pathname);
  if (!slugCandidates.length) return null;

  const page = await client.fetch<SanityPage | null>(PAGE_BY_SLUGS_QUERY, {
    slugs: slugCandidates,
  });

  return normalizeManagedPage(page, pathname);
}
