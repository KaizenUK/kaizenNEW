import { PUBLIC_ROUTE_REDIRECTS } from "./publicRoutePolicy.js";
export type ExistingPage = {
  path: string;
  title: string;
  kind: "site" | "cms" | "redirect";
  destination?: string;
};
export type PageInventory = {
  pages: ExistingPage[];
  generatedAt: string;
  cmsStatus: "available" | "not-configured" | "unavailable";
  studioUrl: string;
};
function pagePath(value: string): string | undefined {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return /^[a-zA-Z0-9/-]*$/.test(trimmed) &&
    !trimmed.includes("//") &&
    !trimmed.split("/").some((part) => part === "." || part === "..")
    ? trimmed
      ? `/${trimmed}/`
      : "/"
    : undefined;
}
const title = (path: string) =>
  path === "/"
    ? "Home"
    : path
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .map((part) =>
          part
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
        )
        .join(" / ");
/** Only public path metadata leaves the server; no page source is serialized. */
export function existingPageInventory(
  sources: Record<string, string>,
  managedPaths: string[],
): ExistingPage[] {
  const pages = new Map<string, ExistingPage>();
  for (const [file, source] of Object.entries(sources)) {
    const route = file.match(/\/pages\/(.+)\.astro$/)?.[1];
    if (!route || route.includes("[") || /^builder(?:\/|$)/.test(route)) continue;
    const path = pagePath(route.replace(/(?:^|\/)index$/, ""));
    if (!path) continue;
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
    const redirect = frontmatter.match(
      /return\s+Astro\.redirect\(\s*["'](\/[^"']*)["']/,
    )?.[1];
    const destination = redirect && pagePath(redirect);
    pages.set(path, {
      path,
      title: title(path),
      kind: destination ? "redirect" : path === "/blog/" ? "cms" : "site",
      ...(destination ? { destination } : {}),
    });
  }
  for (const value of managedPaths) {
    const path = pagePath(value);
    if (
      !path ||
      /^\/(?:builder|studio|api|editor-api|_astro)(?:\/|$)/.test(path)
    )
      continue;
    // A static route's code owns its layout even when its metadata also exists in Sanity.
    if (!pages.has(path))
      pages.set(path, { path, title: title(path), kind: "cms" });
  }
  for (const [from, to] of Object.entries(PUBLIC_ROUTE_REDIRECTS)) {
    const path = pagePath(from),
      destination = pagePath(to as string);
    if (path && destination)
      pages.set(path, {
        path,
        title: title(path),
        kind: "redirect",
        destination,
      });
  }
  return [...pages.values()].sort((a, b) =>
    a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path),
  );
}
