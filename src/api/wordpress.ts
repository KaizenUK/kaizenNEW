export const CMS_BASE = "https://kaizenweb.co.uk/cms";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type WPPost = {
  id: number;
  slug: string;
  date: string;
  modified?: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  yoast_head_json?: any;
  _embedded?: any;
};

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

let postsCache: CacheEntry<WPPost[]> | null = null;
const postBySlugCache = new Map<string, CacheEntry<WPPost | null>>();

function isFresh(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

function savePostInCache(post: WPPost | null) {
  if (!post?.slug) return;
  postBySlugCache.set(post.slug, { data: post, timestamp: Date.now() });
}

function getPostFromPostsCache(slug: string): WPPost | null {
  if (!postsCache || !isFresh(postsCache.timestamp)) return null;
  return postsCache.data.find((p) => p.slug === slug) ?? null;
}

export async function fetchPosts(): Promise<WPPost[]> {
  if (postsCache && isFresh(postsCache.timestamp)) {
    return postsCache.data;
  }

  const res = await fetch(`${CMS_BASE}/wp-json/wp/v2/posts?_embed&per_page=10`);
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }

  const posts: WPPost[] = await res.json();
  postsCache = { data: posts, timestamp: Date.now() };
  posts.forEach((post) => savePostInCache(post));
  return posts;
}

export async function fetchPostBySlug(slug: string): Promise<WPPost | null> {
  const cachedBySlug = postBySlugCache.get(slug);
  if (cachedBySlug && isFresh(cachedBySlug.timestamp)) {
    return cachedBySlug.data;
  }

  const cachedFromPosts = getPostFromPostsCache(slug);
  if (cachedFromPosts) {
    savePostInCache(cachedFromPosts);
    return cachedFromPosts;
  }

  const res = await fetch(
    `${CMS_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch post: ${res.status}`);
  }
  const data: WPPost[] = await res.json();
  const post = data[0] ?? null;
  postBySlugCache.set(slug, { data: post, timestamp: Date.now() });
  savePostInCache(post);
  return post;
}

export function prefetchPostBySlug(slug: string): void {
  if (!slug) return;
  void fetchPostBySlug(slug).catch(() => {
    // Best-effort prefetch: ignore errors and preserve navigation flow.
  });
}
