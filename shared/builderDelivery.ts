import type { BuilderRedirect } from "./builderRouteTypes.ts";
import type {
  ContentCatalogue,
  PageDocument,
  Workspace,
} from "./visualBuilder.ts";
import { resolveSiteDocument } from "./builderSite.ts";
import { resolveContentDocument } from "./builderContent.ts";
import { validateBuilderRedirects } from "./builderRedirects.js";

/** Check the resolved page content, including shared sections and CMS snapshots. */
export function projectLinkWarnings(
  documents: PageDocument[],
  routes: BuilderRedirect[] = [],
  origin?: string,
): string[] {
  const paths = new Set(["/", ...documents.map((page) => `/${page.slug}/`)]);
  const redirects = validateBuilderRedirects(routes, [...paths]);
  const links = new Set<string>();
  const base = origin ? new URL(origin).origin : "https://export.invalid";
  const collectHref = (href: string) => {
    if (href.startsWith("/") && !href.startsWith("//")) links.add(href);
    else if (origin && /^https?:\/\//i.test(href)) {
      try {
        if (new URL(href).origin === base) links.add(href);
      } catch {
        /* Invalid links are handled by document validation. */
      }
    }
  };
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([key, item]) => {
        if (key === "href" && typeof item === "string") collectHref(item);
        collect(item);
      });
    else if (typeof value === "string" && /<a\b/i.test(value))
      for (const match of value.matchAll(/href\s*=\s*["']([^"']*)["']/gi))
        collectHref(match[1]);
  };
  documents.forEach(collect);
  const warnings: string[] = [];
  for (const href of links) {
    const pathname = new URL(href, base).pathname.replace(/\/?$/, "/");
    if (
      !paths.has(pathname) &&
      !redirects.some((rule) => rule.source === pathname)
    )
      warnings.push(
        `Link ${href} has no page or redirect in this project. Add the destination or update the link before delivery.`,
      );
  }
  for (const rule of redirects) {
    let destination = rule.destination;
    while (redirects.some((next) => next.source === destination))
      destination = redirects.find(
        (next) => next.source === destination,
      )!.destination;
    if (!paths.has(destination))
      warnings.push(
        `Redirect ${rule.source} ends at ${destination}, which is outside this project. Provide that page on the destination host or update this rule.`,
      );
  }
  return warnings;
}

export function projectDeliveryWarnings(
  workspace: Workspace,
  catalogue?: ContentCatalogue,
  origin?: string,
) {
  const documents = workspace.pages.map((page) =>
    resolveContentDocument(
      resolveSiteDocument(page.draft, workspace.site?.draft),
      catalogue,
    ),
  );
  const warnings = projectLinkWarnings(
    documents,
    workspace.routes?.draft,
    origin || workspace.settings?.value.siteUrl,
  );
  if (
    JSON.stringify(documents).includes('"ContactForm"') &&
    !workspace.settings?.value.formEndpoint
  )
    warnings.push(
      "Contact forms have no receiving service configured. Set the public form receiver in Client settings before accepting enquiries. A stored submission does not confirm notification delivery.",
    );
  return warnings;
}
