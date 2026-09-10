import { redirectPath, nginxRedirectRules } from "./nginxRedirects.js";
import {
  PUBLIC_ROUTE_REDIRECTS,
  ACTIVE_PUBLIC_PAGE_SLUGS,
} from "./publicRoutePolicy.js";

export const technicalRoute =
  /^\/(?:builder|studio|api|editor-api|_astro|builder-media|__builder[^/]*|\.well-known|\.kaizen-builder|\.git|\.env[^/]*)(?:\/|$)/i;
const existingArea =
  /^\/(?:blog|blogdetail|insights|services|products|case-studies|about|contact|thank-you|index|home|review|pledge|contract-product-owner|performance-scanner|get-started|privacy-policy|cookie-policy|gdpr-policy|terms-and-conditions|web-design[^/]*|digital-transformation|agile-coaching|project-rescue|product-owner)(?:\/|$)/i;
export function canonicalRedirectPath(value) {
  const result = redirectPath(value);
  if (result.includes("//") || result.length > 200)
    throw new Error(
      "Use a path of at most 200 characters without repeated slashes.",
    );
  const trimmed = result.replace(/\/+$/, "") || "/";
  return trimmed === "/" || /\.[a-z0-9]+$/i.test(trimmed)
    ? trimmed
    : `${trimmed}/`;
}
export function redirectAliases(value) {
  const source = canonicalRedirectPath(value);
  return source !== "/" && source.endsWith("/")
    ? [source.slice(0, -1), source]
    : [source];
}
export function validateBuilderRedirects(entries, occupied = []) {
  if (
    !Array.isArray(entries) ||
    entries.length > 200 ||
    JSON.stringify(entries).length > 200_000
  )
    throw new Error("Use at most 200 redirects.");
  const ids = new Set(),
    sources = new Set(),
    paths = new Set(occupied.map(canonicalRedirectPath));
  const normalized = entries.map((entry) => {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        entry.id,
      ) ||
      ids.has(entry.id) ||
      ![301, 302].includes(entry.status)
    )
      throw new Error(
        "Each redirect needs a unique ID and a permanent (301) or temporary (302) status.",
      );
    ids.add(entry.id);
    const source = canonicalRedirectPath(entry.source),
      destination = canonicalRedirectPath(entry.destination);
    if (
      source === "/" ||
      technicalRoute.test(source) ||
      existingArea.test(source)
    )
      throw new Error(
        `This source belongs to the existing site or editor: ${source}`,
      );
    if (technicalRoute.test(destination))
      throw new Error(
        "Redirect visitors to a public page, not an editor or service URL.",
      );
    if (source === destination || sources.has(source))
      throw new Error(`This source is repeated or points to itself: ${source}`);
    if (paths.has(source))
      throw new Error(
        `A page already uses ${source}. Publish its new URL before publishing this redirect.`,
      );
    sources.add(source);
    return { id: entry.id, source, destination, status: entry.status };
  });
  nginxRedirectRules(
    normalized.map((rule) => ({ ...rule, isPermanent: rule.status === 301 })),
  );
  return normalized;
}
export function builderRedirectChecks(entries) {
  return validateBuilderRedirects(entries).flatMap((rule) =>
    redirectAliases(rule.source).map((source) => ({
      source,
      destination: rule.destination,
      status: rule.status,
      preserveQuery: true,
    })),
  );
}
export function builderNginxRules(entries) {
  return builderRedirectChecks(entries).map(
    (rule) =>
      `location = "${rule.source}" { return ${rule.status} "${rule.destination}$is_args$args"; }`,
  );
}
/** Validate the whole redirect graph and destination availability against the actual built output. */
export function mergeRedirectConfiguration(builder, cms, available) {
  // Generated assets may contain characters outside the redirect path contract.
  // Such files cannot be chosen as redirect paths and do not belong in this lookup.
  const availablePaths = available.flatMap((value) => {
    try {
      return [canonicalRedirectPath(value)];
    } catch {
      return [];
    }
  });
  const normalized = validateBuilderRedirects(builder, availablePaths);
  const other = cms.map((rule) => ({
    source: canonicalRedirectPath(rule.source),
    destination: canonicalRedirectPath(rule.destination),
    isPermanent: Boolean(rule.isPermanent),
  }));
  const fixed = Object.entries(PUBLIC_ROUTE_REDIRECTS).map(
    ([source, destination]) => ({
      source: canonicalRedirectPath(source),
      destination: canonicalRedirectPath(destination),
      isPermanent: true,
    }),
  );
  const graph = new Map();
  for (const rule of [...fixed, ...other]) {
    const previous = graph.get(rule.source);
    if (
      previous &&
      (previous.destination !== rule.destination ||
        previous.isPermanent !== rule.isPermanent)
    )
      throw new Error(`Conflicting existing redirects at ${rule.source}`);
    graph.set(rule.source, rule);
  }
  for (const rule of normalized) {
    if (graph.has(rule.source))
      throw new Error(
        `This redirect is already managed by the site or Sanity: ${rule.source}`,
      );
    graph.set(rule.source, { ...rule, isPermanent: rule.status === 301 });
  }
  nginxRedirectRules([...graph.values()]);
  const paths = new Set(availablePaths);
  for (const rule of normalized) {
    let destination = rule.destination;
    while (graph.has(destination))
      destination = graph.get(destination).destination;
    if (!paths.has(destination))
      throw new Error(
        `The redirect destination is not in this published site: ${destination}`,
      );
  }
  return {
    rules: [...nginxRedirectRules(cms), ...builderNginxRules(normalized)],
    checks: builderRedirectChecks(normalized),
  };
}
/** @returns {string[]} */
export function localRedirectPaths(pages) {
  return [
    "/",
    ...ACTIVE_PUBLIC_PAGE_SLUGS.map((slug) =>
      slug === "home" ? "/" : `/${slug}/`,
    ),
    ...pages
      .filter((page) => page.published)
      .map((page) => `/${page.published.slug}/`),
  ];
}
