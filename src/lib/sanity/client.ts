import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
export type { SanityImageSource } from "@sanity/image-url";

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

const projectId =
  env.PUBLIC_SANITY_PROJECT_ID ??
  env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  process.env.PUBLIC_SANITY_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  "";

const dataset =
  env.PUBLIC_SANITY_DATASET ??
  env.NEXT_PUBLIC_SANITY_DATASET ??
  process.env.PUBLIC_SANITY_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  "production";

const token = env.SANITY_API_TOKEN ?? process.env.SANITY_API_TOKEN;

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
      apiVersion: "2025-01-01",
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
      apiVersion: "2025-01-01",
      useCdn: false,
      token,
      perspective: "previewDrafts",
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
      const blockCode =
        typeof block.code === "string" ? block.code : undefined;
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
