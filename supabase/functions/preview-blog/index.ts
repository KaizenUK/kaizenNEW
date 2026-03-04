import {
  getCorsHeaders,
  getPublicSiteOrigin,
  getStudioOrigin,
  hasEditorCookie,
  isOriginAllowed,
} from "../_shared/editorAuth.ts";

type SanityImage = {
  asset?: {
    url?: string;
  };
};

type PortableTextChild = {
  _type?: string;
  text?: string;
};

type PortableTextBlock = {
  _type?: string;
  style?: string;
  children?: PortableTextChild[];
  code?: string;
};

type PreviewPost = {
  _id: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  body?: PortableTextBlock[];
  mainImage?: SanityImage;
  coverImage?: SanityImage;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
  };
};

function getEnv(key: string): string {
  return String(Deno.env.get(key) ?? "").trim();
}

function json(
  status: number,
  payload: Record<string, unknown>,
  corsHeaders: Headers,
): Response {
  const headers = new Headers(corsHeaders);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers });
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPortableBlocks(blocks: PortableTextBlock[] | undefined): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "<p>No body content available for this draft yet.</p>";
  }

  const html = blocks
    .map((block) => {
      if (block?._type !== "block") return "";

      const text = (Array.isArray(block.children) ? block.children : [])
        .map((child) => child?.text ?? "")
        .join("")
        .trim();

      if (!text) return "";
      const safe = escapeHtml(text);
      const style = block.style ?? "normal";

      if (style === "h2") return `<h2>${safe}</h2>`;
      if (style === "h3") return `<h3>${safe}</h3>`;
      if (style === "blockquote") return `<blockquote>${safe}</blockquote>`;
      return `<p>${safe}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html || "<p>No body content available for this draft yet.</p>";
}

function parseSlugFromPath(requestUrl: URL): string {
  const parts = requestUrl.pathname.split("/").filter(Boolean);
  const fnIndex = parts.findIndex((part) => part === "preview-blog");
  const slugParts = fnIndex >= 0 ? parts.slice(fnIndex + 1) : [];
  return decodeURIComponent(slugParts.join("/")).trim();
}

async function querySanity(query: string, params: Record<string, string>) {
  const projectId =
    getEnv("PUBLIC_SANITY_PROJECT_ID") || getEnv("SANITY_PROJECT_ID");
  const dataset = getEnv("PUBLIC_SANITY_DATASET") || getEnv("SANITY_DATASET");
  const token = getEnv("SANITY_API_TOKEN");

  if (!projectId || !dataset || !token) {
    throw new Error(
      "Missing Sanity env vars. Required: SANITY_PROJECT_ID/PUBLIC_SANITY_PROJECT_ID, SANITY_DATASET/PUBLIC_SANITY_DATASET, SANITY_API_TOKEN.",
    );
  }

  const url = new URL(
    `https://${projectId}.api.sanity.io/v2025-01-01/data/query/${dataset}`,
  );
  url.searchParams.set("query", query);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(`$${key}`, value);
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Sanity query failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  return payload?.result?.[0] ?? null;
}

async function getPreviewPost(slug: string, id: string): Promise<PreviewPost | null> {
  const projection = `{
    _id,
    title,
    "slug": slug.current,
    excerpt,
    mainImage{asset->{url}},
    coverImage{asset->{url}},
    seo{metaTitle,metaDescription},
    body[]{
      ...,
      _type == "block" => {
        ...,
        children[]{...,text}
      }
    }
  }`;

  const normalizedId = id.replace(/^drafts\./, "").trim();
  if (normalizedId) {
    const byId = await querySanity(
      `*[_type == "post" && _id in [$id, "drafts." + $id]][0]${projection}`,
      { id: normalizedId },
    );
    if (byId) return byId as PreviewPost;
  }

  if (!slug) return null;
  const bySlug = await querySanity(
    `*[_type == "post" && slug.current == $slug][0]${projection}`,
    { slug },
  );

  return bySlug as PreviewPost | null;
}

function buildHtml(post: PreviewPost): string {
  const publicOrigin = getPublicSiteOrigin();
  const studioOrigin = getStudioOrigin();
  const slug = String(post.slug ?? "").trim();
  const cleanId = String(post._id ?? "").replace(/^drafts\./, "").trim();
  const title = String(post.seo?.metaTitle ?? post.title ?? "Preview").trim();
  const description = String(post.seo?.metaDescription ?? post.excerpt ?? "").trim();
  const imageUrl = post.mainImage?.asset?.url || post.coverImage?.asset?.url || "";
  const liveUrl = slug ? `${publicOrigin}/blog/${encodeURIComponent(slug)}` : `${publicOrigin}/blog`;
  const editUrl = cleanId
    ? `${studioOrigin}/intent/edit/id=${encodeURIComponent(cleanId)};type=post`
    : `${studioOrigin}/structure`;
  const bodyHtml = renderPortableBlocks(post.body);

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} (Draft Preview)</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="noindex,nofollow" />
    <style>
      body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0b0f14; color: #e5edf5; }
      .bar { position: sticky; top: 0; z-index: 50; background: #f59e0b; color: #111827; font-weight: 700; padding: 10px 14px; text-align: center; }
      .bar a { color: #111827; text-decoration: underline; font-weight: 800; }
      .wrap { max-width: 840px; margin: 0 auto; padding: 24px 18px 60px; }
      h1 { font-size: clamp(1.8rem, 3vw, 2.6rem); line-height: 1.1; margin: 18px 0 12px; color: #f8fafc; }
      h2, h3 { color: #f8fafc; margin-top: 1.7rem; }
      p, li, blockquote { line-height: 1.7; color: #cbd5e1; }
      blockquote { border-left: 3px solid #22d3ee; padding-left: 12px; margin-left: 0; }
      .excerpt { font-size: 1.05rem; color: #93a4b8; margin-bottom: 20px; }
      .hero { width: 100%; border-radius: 14px; border: 1px solid rgba(255,255,255,.12); margin: 18px 0 20px; }
      .content p { margin: 0 0 1rem; }
    </style>
  </head>
  <body>
    <div class="bar">
      Draft preview - this content is not published yet.
      <a href="${escapeHtml(liveUrl)}">View live</a>
      |
      <a href="${escapeHtml(editUrl)}">Back to editor</a>
    </div>
    <main class="wrap">
      <h1>${escapeHtml(String(post.title ?? "Untitled Post"))}</h1>
      ${
        description
          ? `<p class="excerpt">${escapeHtml(description)}</p>`
          : ""
      }
      ${
        imageUrl
          ? `<img class="hero" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(String(post.title ?? "Preview image"))}" />`
          : ""
      }
      <article class="content">
        ${bodyHtml}
      </article>
    </main>
  </body>
</html>`;
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isOriginAllowed(request)) {
    return json(403, { ok: false, error: "Forbidden origin" }, corsHeaders);
  }

  if (request.method !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  if (!hasEditorCookie(request)) {
    return json(
      401,
      { ok: false, error: "Studio authentication required" },
      corsHeaders,
    );
  }

  const requestUrl = new URL(request.url);
  const slugFromPath = parseSlugFromPath(requestUrl);
  const querySlug = String(requestUrl.searchParams.get("slug") ?? "").trim();
  const slug = slugFromPath || querySlug;
  const id = String(requestUrl.searchParams.get("id") ?? "").trim();

  if (!slug && !id) {
    return json(
      400,
      { ok: false, error: "Missing post slug or id for preview" },
      corsHeaders,
    );
  }

  try {
    const post = await getPreviewPost(slug, id);
    if (!post) {
      return json(404, { ok: false, error: "Preview post not found" }, corsHeaders);
    }

    const headers = new Headers(corsHeaders);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "no-store");
    return new Response(buildHtml(post), { status: 200, headers });
  } catch (error) {
    return json(
      500,
      {
        ok: false,
        error: "Failed to render draft preview",
        details: error instanceof Error ? error.message : String(error),
      },
      corsHeaders,
    );
  }
});
