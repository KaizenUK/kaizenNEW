function normalizePathname(pathname) {
  const raw = String(pathname ?? "").trim();
  if (!raw || raw === "/") return "/";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

function toPageSlug(pathname) {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") return "home";
  return normalized.replace(/^\/+|\/+$/g, "");
}

export const PUBLIC_ROUTE_REDIRECTS = {
  "/services": "/services/wordpress-web-design/",
  "/services/contract-product-owner": "/contract-product-owner/",
  "/services/web-design-liverpool": "/",
  "/web-design-liverpool": "/",
  "/web-design-liverpool-city-centre": "/",
  "/web-design-wirral": "/",
  "/web-design-warrington": "/",
  "/web-design-chester": "/",
  "/services/ecommerce": "/services/wordpress-web-design/",
  "/services/digital-transformation": "/contract-product-owner/",
  "/digital-transformation": "/contract-product-owner/",
  "/agile-coaching": "/contract-product-owner/",
  "/project-rescue": "/contract-product-owner/",
  "/case-studies/as-collections": "/case-studies/",
  "/case-studies/high-five-games": "/case-studies/",
  "/case-studies/independent-retailer": "/case-studies/",
  "/case-studies/kaizen-rebuild": "/case-studies/",
  "/product-owner": "/contract-product-owner/",
};

export const RETIRED_PUBLIC_PATHS = Object.freeze(
  Object.keys(PUBLIC_ROUTE_REDIRECTS).map((pathname) => normalizePathname(pathname)),
);

export const RETIRED_PUBLIC_PAGE_SLUGS = Object.freeze(
  RETIRED_PUBLIC_PATHS.map((pathname) => toPageSlug(pathname)),
);

export const ACTIVE_PUBLIC_PAGE_SLUGS = Object.freeze([
  "home",
  "blog",
  "services/local-seo",
  "services/wordpress-web-design",
  "contract-product-owner",
  "about",
  "pledge",
  "case-studies",
  "case-studies/helen-moore-hairdressing",
  "case-studies/midland-oil-group",
  "contact",
  "thank-you",
  "privacy-policy",
  "cookie-policy",
  "gdpr-policy",
  "terms-and-conditions",
  "performance-scanner",
]);

export const ACTIVE_STATIC_SEO_ROUTES = Object.freeze([
  "/",
  "/blog",
  "/contact",
  "/terms-and-conditions",
  "/privacy-policy",
  "/cookie-policy",
  "/gdpr-policy",
  "/thank-you",
]);
