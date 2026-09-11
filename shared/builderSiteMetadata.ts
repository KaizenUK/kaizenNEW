export type PublicSiteConfig = {
  siteUrl: string;
  favicon: string;
  formEndpoint: string;
};
type PageMetadata = {
  title: string;
  description: string;
  slug: string;
  noIndex: boolean;
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function canonicalUrl(page: PageMetadata, config: PublicSiteConfig) {
  return config.siteUrl ? `${config.siteUrl}/${page.slug}/` : "";
}
export function pageMetadataHead(page: PageMetadata, config: PublicSiteConfig) {
  const canonical = canonicalUrl(page, config);
  return (
    `<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="${page.noIndex ? "noindex, nofollow" : "index, follow"}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><link rel="icon" href="${escape(config.favicon || "data:,")}">` +
    (canonical
      ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">`
      : "")
  );
}
export function siteSitemap(pages: PageMetadata[], config: PublicSiteConfig) {
  if (!config.siteUrl) return "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
    .filter((page) => !page.noIndex)
    .map(
      (page) => `<url><loc>${escape(canonicalUrl(page, config))}</loc></url>`,
    )
    .join("")}</urlset>\n`;
}
