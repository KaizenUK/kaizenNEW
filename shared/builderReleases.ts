import {
  clone,
  validateDocument,
  type PageDocument,
  type SiteDesign,
  type Workspace,
} from "./visualBuilder.ts";
import {
  assertPageSitePublished,
  publishSiteWorkspace,
  usesSite,
  validateSiteDesign,
} from "./builderSite.ts";
import { materializeImages } from "./builderImages.ts";
import type { BuilderRedirect } from "./builderRoutes.ts";
import { validateBuilderRedirects } from "./builderRedirects.js";

/** Private deployment input. The public publications table remains the verified live baseline. */
export type ReleaseSnapshot = {
  schemaVersion: 1;
  pages: { id: string; document: PageDocument }[];
  site: SiteDesign | null;
  redirects?: BuilderRedirect[];
};
export type ReleaseRequest = {
  schemaVersion: 1;
  action: "page" | "site" | "unpublish" | "deploy";
  expected: {
    pages: Record<string, number>;
    site: Workspace["site"] | null;
    assets: Workspace["assets"];
  };
  changes: { id: string; document: PageDocument | null }[];
  site: SiteDesign | null;
};
export const releasePhases = [
  "queued",
  "building",
  "activating",
  "verifying",
  "live",
  "failed",
  "rolled_back",
  "recovery_required",
] as const;
export type ReleasePhase = (typeof releasePhases)[number];
export type ReleaseStatus = {
  id: string;
  action: ReleaseRequest["action"] | "rollback" | "redirects";
  status: ReleasePhase;
  createdAt: string;
  updatedAt: string;
  artifactId: string | null;
  previousReleaseId: string | null;
  rollbackOf: string | null;
  error: string | null;
  live: boolean;
};

/** Resolve only the explicitly reviewed changes; never mutate drafts or mark them published here. */
export function prepareReleaseRequest(
  workspace: Workspace,
  action: ReleaseRequest["action"],
  pageId?: string,
): ReleaseRequest {
  const expected = {
    pages: Object.fromEntries(
      workspace.pages.map((page) => [page.id, page.version]),
    ),
    site: workspace.site || null,
    assets: [...workspace.assets].sort((a, b) => a.id.localeCompare(b.id)),
  };
  let changes: ReleaseRequest["changes"] = [];
  let site = workspace.site?.published || null;
  if (action === "site") {
    const proposed = publishSiteWorkspace(
      workspace,
      workspace.site?.version || 0,
      expected.pages,
    );
    changes = proposed.pages
      .filter((page) => usesSite(page.draft))
      .map((page) => {
        if (!page.published)
          throw new Error("A shared page snapshot could not be prepared.");
        return { id: page.id, document: validateDocument(page.published) };
      });
    site = proposed.site!.published;
  } else if (action === "page" || action === "unpublish") {
    const page = workspace.pages.find((item) => item.id === pageId);
    if (!page) throw new Error("Page not found. Reopen the page list.");
    if (action === "unpublish" && !page.published)
      throw new Error("This page has no published version.");
    changes = [
      {
        id: page.id,
        document:
          action === "unpublish"
            ? null
            : materializeImages(
                assertPageSitePublished(
                  validateDocument(page.draft),
                  workspace.site,
                ),
                workspace.assets,
              ),
      },
    ];
  } else if (action !== "deploy")
    throw new Error("Unsupported release action.");
  return clone({ schemaVersion: 1, action, expected, changes, site });
}

export function validateReleaseSnapshot(input: unknown): ReleaseSnapshot {
  const value = input as ReleaseSnapshot;
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.pages) ||
    value.pages.length > 500
  )
    throw new Error("Unsupported release snapshot.");
  const ids = new Set<string>(),
    slugs = new Set<string>();
  for (const page of value.pages) {
    if (
      !page ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        page.id,
      ) ||
      ids.has(page.id)
    )
      throw new Error("Invalid or repeated release page ID.");
    const document = validateDocument(page.document);
    if (usesSite(document))
      throw new Error("Release pages must contain resolved shared content.");
    if (slugs.has(document.slug))
      throw new Error("Two release pages use the same URL.");
    ids.add(page.id);
    slugs.add(document.slug);
  }
  if (value.site !== null) validateSiteDesign(value.site);
  if (value.redirects)
    validateBuilderRedirects(
      value.redirects,
      value.pages.map((page) => `/${page.document.slug}/`),
    );
  return clone(value);
}
