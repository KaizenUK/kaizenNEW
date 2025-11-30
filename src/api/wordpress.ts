export const CMS_BASE = "https://www.kaizenweb.co.uk/cms";

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

export async function fetchPosts(): Promise<WPPost[]> {
  const res = await fetch(`${CMS_BASE}/wp-json/wp/v2/posts?_embed&per_page=10`);
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }
  return res.json();
}

export async function fetchPostBySlug(slug: string): Promise<WPPost | null> {
  const res = await fetch(
    `${CMS_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch post: ${res.status}`);
  }
  const data: WPPost[] = await res.json();
  return data[0] ?? null;
}
