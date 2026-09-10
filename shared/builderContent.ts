import {
  clone,
  validateDocument,
  type Block,
  type ContentBinding,
  type ContentCatalogue,
  type ContentPost,
  type PageDocument,
} from "./visualBuilder.ts";

export function hasContentBindings(blocks: Block[]): boolean {
  return blocks.some(
    (block) =>
      block.type === "ContentList" ||
      !!block.props.contentBinding ||
      hasContentBindings(block.props.children || []),
  );
}
export function selectContentPosts(
  block: Block,
  catalogue: ContentCatalogue,
): ContentPost[] {
  const category = String(block.props.categoryId || "");
  if (category && !catalogue.categories.some((item) => item.id === category))
    throw new Error(
      "The selected Sanity category no longer exists. Choose another category.",
    );
  const posts = catalogue.posts.filter(
    (post) => !category || post.categories.includes(category),
  );
  const sort = String(block.props.sort || "newest");
  posts.sort(
    (a, b) =>
      (sort === "title"
        ? a.title.localeCompare(b.title, "en")
        : sort === "oldest"
          ? a.publishedAt.localeCompare(b.publishedAt)
          : b.publishedAt.localeCompare(a.publishedAt)) ||
      a.id.localeCompare(b.id),
  );
  return posts.slice(0, Number(block.props.limit) || 6);
}
export function bindContentBlock(
  block: Block,
  catalogue: ContentCatalogue,
): Block {
  const binding = block.props.contentBinding as ContentBinding | undefined;
  if (!binding) return block;
  const post = catalogue.posts.find((item) => item.id === binding.postId);
  if (!post)
    throw new Error(
      "A linked Sanity post is missing or unpublished. Choose another post or disconnect the field.",
    );
  const props = { ...block.props };
  if (block.type === "Image") {
    props.src = post.image;
    props.alt = post.alt || post.title;
  } else if (block.type === "Button") props.href = post.href;
  else
    props.text =
      {
        title: post.title,
        excerpt: post.excerpt,
        author: post.author,
        publishedAt: displayContentDate(post.publishedAt),
        image: post.image,
        link: post.href,
      }[binding.field] || "";
  return { ...block, props };
}
export function displayContentDate(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
/** Materialise published CMS content for a build/export, while the stored draft keeps its bindings. */
export function resolveContentDocument(
  document: PageDocument,
  catalogue?: ContentCatalogue,
): PageDocument {
  if (!hasContentBindings(document.data.content)) return clone(document);
  if (!catalogue)
    throw new Error(
      "Load Sanity content before previewing or exporting this page.",
    );
  if (catalogue.truncated)
    throw new Error(
      "This Sanity catalogue exceeds 1,000 posts or categories. Narrow the integration before publishing; content will not be silently omitted.",
    );
  const result = clone(document);
  const walk = (blocks: Block[]): Block[] =>
    blocks.map((original) => {
      const block = bindContentBlock(original, catalogue);
      if (block.type === "ContentList")
        block.props.records = selectContentPosts(block, catalogue);
      delete block.props.contentBinding;
      if (block.props.children)
        block.props.children = walk(block.props.children);
      return block;
    });
  result.data.content = walk(result.data.content);
  return validateDocument(result);
}

export const CONTENT_QUERY = `{
  "posts": *[_type == "post" && defined(slug.current) && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(publishedAt desc, _id asc)[0...1001] {
    _id, title, "slug": slug.current, excerpt, publishedAt,
    "image": coalesce(mainImage.asset->url, coverImage.asset->url),
    "alt": coalesce(mainImage.alt, coverImage.alt),
    "author": author->name, "categories": categories[]._ref
  },
  "categories": *[_type == "category" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(title asc)[0...1001] { _id, title }
}`;
export function normalizeCatalogue(value: unknown): ContentCatalogue {
  const data = value as { posts?: unknown[]; categories?: unknown[] };
  if (!data || !Array.isArray(data.posts) || !Array.isArray(data.categories))
    throw new Error("Sanity returned an invalid content catalogue.");
  const text = (value: unknown, max = 1000) =>
    typeof value === "string" ? value.slice(0, max) : "";
  const published = (id: string) =>
    id && !id.startsWith("drafts.") && !id.startsWith("versions.");
  const posts: ContentPost[] = data.posts.slice(0, 1000).flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    if (!item || !published(text(item._id))) return [];
    const slug = typeof item.slug === "string" ? item.slug : "";
    if (
      !slug ||
      slug.length > 500 ||
      slug.split("/").some((part) => !part || [".", ".."].includes(part)) ||
      /\u0000/.test(slug)
    )
      throw new Error(
        "A published Sanity post has an invalid URL. Correct its slug in Studio.",
      );
    let image = "";
    try {
      const url = new URL(text(item.image));
      if (
        url.protocol === "https:" &&
        url.hostname === "cdn.sanity.io" &&
        url.pathname.startsWith("/images/")
      ) {
        url.searchParams.set("w", "1200");
        url.searchParams.set("fit", "max");
        url.searchParams.set("auto", "format");
        image = url.toString();
      }
    } catch {
      /* Posts without an image still have a useful text card. */
    }
    return [
      {
        id: text(item._id, 200),
        title: text(item.title, 300) || "Untitled post",
        excerpt: text(item.excerpt),
        href: `/blog/${slug.split("/").map(encodeURIComponent).join("/")}/`,
        image,
        alt: text(item.alt, 500),
        author: text(item.author, 200),
        publishedAt:
          typeof item.publishedAt === "string" &&
          Number.isFinite(Date.parse(item.publishedAt))
            ? new Date(item.publishedAt).toISOString()
            : "",
        categories: Array.isArray(item.categories)
          ? item.categories
              .filter((id): id is string => typeof id === "string")
              .slice(0, 100)
          : [],
      },
    ];
  });
  const categories = data.categories.slice(0, 1000).flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    return item && published(text(item._id))
      ? [
          {
            id: text(item._id, 200),
            title: text(item.title, 200) || "Untitled category",
          },
        ]
      : [];
  });
  return {
    posts,
    categories,
    fetchedAt: new Date().toISOString(),
    truncated: data.posts.length > 1000 || data.categories.length > 1000,
  };
}
/** Fixed published-only query; private Sanity tokens are passed by server adapters, never by page data. */
export async function fetchContentCatalogue(
  config: { projectId?: string; dataset?: string; token?: string },
  fetcher: typeof fetch = fetch,
): Promise<ContentCatalogue> {
  if (
    !/^[a-z0-9-]+$/.test(config.projectId || "") ||
    !/^[a-zA-Z0-9_-]+$/.test(config.dataset || "")
  )
    throw new Error(
      "Sanity is not connected. Configure the existing Sanity project and dataset on the server.",
    );
  const url = new URL(
    `https://${config.projectId}.api.sanity.io/v2025-01-01/data/query/${config.dataset}`,
  );
  url.searchParams.set("query", CONTENT_QUERY);
  url.searchParams.set("perspective", "published");
  const response = await fetcher(url, {
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(
      `Sanity content could not be loaded (${response.status}). Check the server connection and read permissions.`,
    );
  const payload = await response.json();
  return normalizeCatalogue(payload.result);
}
