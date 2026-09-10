// Exact internal paths only. Never interpolate CMS strings as Nginx directives.
export function redirectPath(value) {
  const raw = String(value ?? "").trim();
  const pathname = raw.startsWith("/") ? raw : `/${raw}`;
  if (
    !raw ||
    !/^\/[a-zA-Z0-9/_.-]*$/.test(pathname) ||
    pathname.startsWith("//") ||
    pathname.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error(
      "Redirects need an internal path containing letters, numbers, slashes, dots, hyphens or underscores.",
    );
  return pathname;
}
export function nginxRedirectRules(entries) {
  if (!Array.isArray(entries)) throw new Error("Redirect data must be a list.");
  const sources = new Set();
  return entries
    .map((entry) => {
      const source = redirectPath(entry?.source),
        destination = redirectPath(entry?.destination);
      if (source === destination || sources.has(source))
        throw new Error(
          `Redirect source is duplicated or points to itself: ${source}`,
        );
      sources.add(source);
      return { source, destination, status: entry.isPermanent ? 301 : 302 };
    })
    .map((entry, _, all) => {
      const visited = new Set([entry.source]);
      let target = entry.destination;
      for (;;) {
        if (visited.has(target))
          throw new Error(`Redirect cycle at ${entry.source}`);
        visited.add(target);
        const next = all.find((item) => item.source === target);
        if (!next) break;
        target = next.destination;
      }
      return `location = "${entry.source}" { return ${entry.status} "${entry.destination}"; }`;
    });
}
