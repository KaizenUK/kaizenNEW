import {
  clone,
  savePage,
  type Asset,
  type Workspace,
} from "./visualBuilder.ts";
import { resolveSiteDocument, saveSiteDesign } from "./builderSite.ts";

const urlKeys = new Set([
  "src",
  "href",
  "poster",
  "captions",
  "backgroundImage",
  "fontUrl",
  "image",
]);
/** Replace only media/link fields; never rewrite titles, prose, IDs, metadata or old revisions. */
export function replaceAssetUrl<T>(value: T, from: string, to: string): T {
  const walk = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(walk)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.entries(item).map(([key, child]) => [
              key,
              urlKeys.has(key) && child === from ? to : walk(child),
            ]),
          )
        : item;
  return walk(value) as T;
}
export function referencesAsset(value: unknown, url: string): boolean {
  if (!url) return false;
  if (Array.isArray(value))
    return value.some((item) => referencesAsset(item, url));
  return (
    !!value &&
    typeof value === "object" &&
    Object.entries(value).some(
      ([key, item]) =>
        (urlKeys.has(key) && item === url) || referencesAsset(item, url),
    )
  );
}
export function assetUsage(workspace: Workspace, asset: Asset) {
  return {
    pages: workspace.pages.flatMap((page) => {
      let draft = page.draft;
      try {
        draft = resolveSiteDocument(draft, workspace.site?.draft);
      } catch {
        /* Direct references remain inspectable in an incomplete page. */
      }
      const inDraft = referencesAsset(draft, asset.url),
        live = referencesAsset(page.published, asset.url);
      return inDraft || live
        ? [
            {
              id: page.id,
              title: page.draft.title,
              slug: page.draft.slug,
              draft: inDraft,
              live,
            },
          ]
        : [];
    }),
    saved: workspace.saved
      .filter((item) => referencesAsset(item, asset.url))
      .map((item) => ({ id: item.id, name: item.name })),
    shared: (workspace.site?.draft.components || [])
      .filter((item) => referencesAsset(item.blocks, asset.url))
      .map((item) => ({ id: item.id, name: item.name })),
    siteStyles: referencesAsset(workspace.site?.draft.theme, asset.url),
    historicalPages: workspace.pages.filter((page) =>
      page.revisions.some((revision) =>
        referencesAsset(revision.document, asset.url),
      ),
    ).length,
  };
}
export type AssetMetadataPatch = {
  tags?: string[];
  favourite?: boolean;
  pack?: string;
};
export type AssetMetadataChange = {
  id: string;
  expected: Asset;
  patch: AssetMetadataPatch;
};
export function updateAssetMetadata(
  assets: Asset[],
  changes: AssetMetadataChange[],
): Asset[] {
  if (
    !Array.isArray(changes) ||
    !changes.length ||
    changes.length > 2000 ||
    new Set(changes.map((change) => change.id)).size !== changes.length
  )
    throw new Error("Choose between 1 and 2,000 different assets.");
  const next = clone(assets);
  const indexes = new Map(next.map((asset, index) => [asset.id, index]));
  for (const change of changes) {
    const index = indexes.get(change.id) ?? -1,
      current = next[index];
    if (!current || JSON.stringify(current) !== JSON.stringify(change.expected))
      throw new Error(
        "An asset changed in another window. Refresh the library and try again.",
      );
    const patch = change.patch;
    if (
      !patch ||
      typeof patch !== "object" ||
      Array.isArray(patch) ||
      Object.keys(patch).some(
        (key) => !["tags", "pack", "favourite"].includes(key),
      ) ||
      (patch.tags !== undefined &&
        (!Array.isArray(patch.tags) ||
          patch.tags.length > 50 ||
          patch.tags.some(
            (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 80,
          ))) ||
      (patch.pack !== undefined &&
        (typeof patch.pack !== "string" ||
          !patch.pack.trim() ||
          patch.pack.length > 120)) ||
      (patch.favourite !== undefined && typeof patch.favourite !== "boolean")
    )
      throw new Error(
        "Use a pack name up to 120 characters and up to 50 tags of 80 characters.",
      );
    next[index] = {
      ...current,
      ...patch,
      ...(patch.pack !== undefined
        ? {
            pack: patch.pack.trim(),
            originalPack: current.originalPack || current.pack,
          }
        : {}),
      ...(patch.tags !== undefined
        ? { tags: [...new Set(patch.tags.map((tag) => tag.trim()))] }
        : {}),
    };
  }
  return next;
}
export type AssetReplacementReview = {
  source: Asset;
  replacement: Asset;
  pageVersions: Record<string, number>;
  siteVersion: number;
  saved: Workspace["saved"];
  usage: ReturnType<typeof assetUsage>;
};
export function reviewAssetReplacement(
  workspace: Workspace,
  sourceId: string,
  replacementId: string,
): AssetReplacementReview {
  const source = workspace.assets.find((item) => item.id === sourceId),
    replacement = workspace.assets.find((item) => item.id === replacementId);
  if (
    !source ||
    !replacement ||
    source.id === replacement.id ||
    !source.url ||
    !replacement.url
  )
    throw new Error("Choose a different replacement asset.");
  if (
    !["image", "icon", "font"].includes(source.kind) ||
    replacement.kind !== source.kind
  )
    throw new Error("Choose the same asset type: image, SVG icon or font.");
  return clone({
    source,
    replacement,
    pageVersions: Object.fromEntries(
      workspace.pages.map((page) => [page.id, page.version]),
    ),
    siteVersion: workspace.site?.version || 0,
    saved: workspace.saved,
    usage: assetUsage(workspace, source),
  });
}
export function replaceAssetInDrafts(
  workspace: Workspace,
  review: AssetReplacementReview,
): Workspace {
  const current = reviewAssetReplacement(
    workspace,
    review.source.id,
    review.replacement.id,
  );
  if (
    JSON.stringify(current.source) !== JSON.stringify(review.source) ||
    JSON.stringify(current.replacement) !==
      JSON.stringify(review.replacement) ||
    current.siteVersion !== review.siteVersion ||
    JSON.stringify(current.saved) !== JSON.stringify(review.saved) ||
    Object.keys(current.pageVersions).length !==
      Object.keys(review.pageVersions).length ||
    Object.entries(current.pageVersions).some(
      ([id, version]) => version !== review.pageVersions[id],
    )
  )
    throw new Error("The workspace changed. Review the replacement again.");
  const next = clone(workspace),
    { source, replacement } = current;
  next.pages = next.pages.map((page) =>
    referencesAsset(page.draft, source.url)
      ? savePage(
          next.pages,
          replaceAssetUrl(page.draft, source.url, replacement.url),
          page.id,
          page.version,
          `Replaced ${source.name}`,
        )
      : page,
  );
  if (next.site && referencesAsset(next.site.draft, source.url))
    next.site = saveSiteDesign(
      next.site,
      next.site.version,
      replaceAssetUrl(next.site.draft, source.url, replacement.url),
    );
  next.saved = next.saved.map((item) =>
    replaceAssetUrl(item, source.url, replacement.url),
  );
  return next;
}
