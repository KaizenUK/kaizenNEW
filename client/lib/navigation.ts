const DOCUMENT_NAVIGATION_EXACT_PATHS = new Set([
  "/blog",
  "/studio",
  "/insights",
  "/blogdetail",
  "/privacy-policy",
  "/cookie-policy",
  "/gdpr-policy",
  "/terms-and-conditions",
  "/services",
  "/case-studies",
  "/thank-you",
]);

const DOCUMENT_NAVIGATION_PREFIXES = [
  "/blog/",
  "/studio/",
  "/insights/",
  "/blogdetail/",
  "/preview/blog/",
];

function normalizePath(href: string): string {
  const path = String(href || "").split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function requiresDocumentNavigation(href: string): boolean {
  const path = normalizePath(href);
  if (DOCUMENT_NAVIGATION_EXACT_PATHS.has(path)) return true;
  return DOCUMENT_NAVIGATION_PREFIXES.some((prefix) =>
    path.startsWith(prefix),
  );
}
