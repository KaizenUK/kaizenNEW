import type { APIRoute } from "astro";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllPosts,
  getManagedRoutePaths,
  getPageByPath,
  getStaticPageBySlug,
} from "../lib/sanity/client";
import {
  getLocalSitePath,
  getSiteOrigin,
  isCanonicalForPath,
  normalizeSitePath,
  resolveCanonicalUrl,
} from "../lib/site";

export const prerender = true;

const PAGES_DIR = fileURLToPath(new URL(".", import.meta.url));
const EXCLUDED_SITEMAP_ROUTES = new Set([
  "/studio/",
  "/thank-you/",
  "/blogdetail/",
  "/insights/",
  "/privacy-policy/",
  "/cookie-policy/",
  "/gdpr-policy/",
]);

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

async function walkPageFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkPageFiles(fullPath);
      }

      return [fullPath];
    }),
  );

  return files.flat();
}

function toStaticRoute(filePath: string): string | null {
  const relativePath = path.relative(PAGES_DIR, filePath).split(path.sep).join("/");

  if (!relativePath.endsWith(".astro")) return null;
  if (relativePath.startsWith("api/")) return null;
  if (relativePath.includes("[")) return null;

  const noExtension = relativePath.replace(/\.astro$/, "");
  const segments = noExtension.split("/").filter(Boolean);

  if (segments[segments.length - 1] === "index") {
    segments.pop();
  }

  const route = normalizeSitePath(`/${segments.join("/")}`);
  if (EXCLUDED_SITEMAP_ROUTES.has(route)) {
    return null;
  }

  return route;
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function buildXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${entry.loc}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const GET: APIRoute = async () => {
  const buildTimestamp = new Date().toISOString();
  const staticPageFiles = await walkPageFiles(PAGES_DIR);
  const staticRoutes = Array.from(
    new Set(staticPageFiles.map(toStaticRoute).filter((route): route is string => Boolean(route))),
  );

  const entries = new Map<string, SitemapEntry>();
  const upsertEntry = (route: string, lastmod?: string) => {
    const normalizedRoute = normalizeSitePath(route);
    if (EXCLUDED_SITEMAP_ROUTES.has(normalizedRoute)) return;

    entries.set(normalizedRoute, {
      loc: resolveCanonicalUrl(undefined, normalizedRoute),
      lastmod,
    });
  };

  for (const route of staticRoutes) {
    upsertEntry(route, buildTimestamp);
  }

  const [managedRoutes, blogPageSeo, blogManagedPage, posts] = await Promise.all([
    getManagedRoutePaths(),
    getStaticPageBySlug("/blog", false),
    getPageByPath("/blog", false),
    getAllPosts(),
  ]);

  const blogCanonical = blogManagedPage?.seo?.canonicalUrl || blogPageSeo?.seo?.canonicalUrl;
  const blogNoIndex = blogManagedPage?.seo?.noIndex || blogPageSeo?.seo?.noIndex;
  if (blogNoIndex || !isCanonicalForPath("/blog", blogCanonical)) {
    entries.delete("/blog/");
  } else if (entries.has("/blog/")) {
    entries.set("/blog/", {
      loc: resolveCanonicalUrl(blogCanonical, "/blog"),
      lastmod: buildTimestamp,
    });
  }

  const managedPages = await Promise.all(
    managedRoutes.map(async (route) => ({
      route,
      page: await getPageByPath(route, false),
    })),
  );

  for (const { route, page } of managedPages) {
    if (!page) continue;
    if (page.seo?.noIndex) continue;
    if (!isCanonicalForPath(route, page.seo?.canonicalUrl)) continue;

    const normalizedRoute = normalizeSitePath(route);
    if (EXCLUDED_SITEMAP_ROUTES.has(normalizedRoute)) continue;

    entries.set(normalizedRoute, {
      loc: resolveCanonicalUrl(page.seo?.canonicalUrl, route),
      lastmod: buildTimestamp,
    });
  }

  for (const post of posts) {
    const route = `/blog/${post.slug}`;
    if (post.seo?.noIndex) continue;
    if (!isCanonicalForPath(route, post.seo?.canonicalUrl)) continue;

    entries.set(normalizeSitePath(route), {
      loc: resolveCanonicalUrl(post.seo?.canonicalUrl, route),
      lastmod: toIsoDate(post.publishedAt) ?? buildTimestamp,
    });
  }

  const siteOrigin = getSiteOrigin();
  const xml = buildXml(
    Array.from(entries.values())
      .filter((entry) => {
        const localPath = getLocalSitePath(entry.loc);
        return localPath !== null && entry.loc.startsWith(siteOrigin);
      })
      .sort((a, b) => a.loc.localeCompare(b.loc)),
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
