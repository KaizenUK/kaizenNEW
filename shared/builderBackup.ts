import {
  clone,
  newId,
  savePage,
  validateDocument,
  type BuilderPage,
  type SiteDesign,
  type Workspace,
} from "./visualBuilder.ts";
import {
  resolveSiteDocument,
  saveSiteDesign,
  validateSiteDesign,
} from "./builderSite.ts";
import { validAssetImage } from "./builderImages.ts";
import { validateConversion } from "./builderConversions.ts";
import { validateRouteState, saveRoutes } from "./builderRoutes.ts";
import { validateBuilderRedirects } from "./builderRedirects.js";
import {
  validateSettingsState,
  saveClientSettings,
} from "./builderSettings.ts";

export const BACKUP_FORMAT = "kaizen-builder-project";
export const BACKUP_VERSION = 2;
export function supportedBackupVersion(version: unknown): version is 1 | 2 {
  return version === 1 || version === 2;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: 1 | 2;
  createdAt: string;
  workspace: Workspace;
  files: { assetId: string; path: string; sha256: string; size: number }[];
};
export type RestoreExpected = {
  pageVersions: Record<string, number>;
  siteVersion: number;
  routeVersion?: number;
  settingsVersion?: number;
  saved: Workspace["saved"];
};
export type RestoredAsset = {
  expected: Workspace["assets"][number];
  asset: Workspace["assets"][number];
};
export type RestorePlan = {
  pages: BuilderPage[];
  saved: Workspace["saved"];
  site?: Workspace["site"];
  routes?: Workspace["routes"];
  settings?: Workspace["settings"];
  expected: RestoreExpected;
  assetUpdates?: RestoredAsset[];
};
function uniqueIds(items: { id: string }[], label: string) {
  if (
    !Array.isArray(items) ||
    items.some((item) => !item || !uuid.test(item.id)) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new Error(`Invalid or duplicate ${label} IDs in backup.`);
}
export function validateBackupWorkspace(value: Workspace): Workspace {
  if (
    !value ||
    !Array.isArray(value.pages) ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.saved) ||
    value.pages.length > 500 ||
    value.assets.length > 20_000 ||
    value.saved.length > 2000 ||
    JSON.stringify(value).length > 50_000_000
  )
    throw new Error("Invalid or oversized builder backup.");
  uniqueIds(value.pages, "page");
  uniqueIds(value.assets, "asset");
  uniqueIds(value.saved, "saved section");
  if (value.routes) validateRouteState(value.routes);
  if (value.settings) validateSettingsState(value.settings);
  for (const page of value.pages) {
    validateDocument(page.draft);
    if (page.published) validateDocument(page.published);
    if (!Array.isArray(page.revisions) || page.revisions.length > 50)
      throw new Error("Invalid page revision history.");
    for (const revision of page.revisions) {
      if (
        !revision ||
        typeof revision.id !== "string" ||
        typeof revision.label !== "string" ||
        typeof revision.createdAt !== "string"
      )
        throw new Error("Invalid page revision.");
      validateDocument(revision.document);
    }
  }
  for (const asset of value.assets) {
    if (asset.conversion)
      validateConversion(asset.conversion, asset, value.assets);
    if (
      !/^[a-f0-9]{64}$/.test(asset.hash) ||
      typeof asset.name !== "string" ||
      !asset.name ||
      typeof asset.path !== "string" ||
      !asset.path ||
      asset.path.split(/[\\/]/).some((part) => part === ".." || part === ".") ||
      /^[/\\]/.test(asset.path) ||
      /[\x00-\x1f:]/.test(asset.path) ||
      typeof asset.pack !== "string" ||
      !asset.pack ||
      !["image", "icon", "font", "licence", "code", "design", "other"].includes(
        asset.kind,
      ) ||
      typeof asset.mime !== "string" ||
      typeof asset.url !== "string" ||
      !asset.url ||
      !Number.isFinite(asset.size) ||
      asset.size < 0 ||
      typeof asset.favourite !== "boolean" ||
      typeof asset.createdAt !== "string" ||
      (asset.originalPack !== undefined &&
        typeof asset.originalPack !== "string") ||
      !Array.isArray(asset.tags) ||
      asset.tags.some((tag) => typeof tag !== "string")
    )
      throw new Error("Invalid asset metadata in backup.");
    if (
      (asset.image !== undefined && !validAssetImage(asset.image, asset.url)) ||
      (asset.generatedFrom !== undefined &&
        typeof asset.generatedFrom !== "string")
    )
      throw new Error("Invalid generated image metadata in backup.");
  }
  const base = value.pages[0]?.draft || {
    schemaVersion: 1 as const,
    title: "Saved content",
    slug: "saved-content",
    description: "",
    noIndex: true,
    theme: {
      accent: "#000",
      color: "#000",
      background: "#fff",
      radius: 0,
      fontFamily: "sans-serif",
    },
    data: { root: {}, content: [] },
  };
  for (const saved of value.saved) {
    if (
      typeof saved.name !== "string" ||
      !["section", "template"].includes(saved.kind)
    )
      throw new Error("Invalid saved content.");
    validateDocument({
      ...base,
      theme: saved.theme || base.theme,
      data: { root: {}, content: saved.blocks },
    });
  }
  if (value.site) {
    validateSiteDesign(value.site.draft);
    if (value.site.published) validateSiteDesign(value.site.published);
    if (
      !Array.isArray(value.site.revisions) ||
      value.site.revisions.length > 30
    )
      throw new Error("Invalid shared design history.");
    value.site.revisions.forEach((revision) => {
      if (
        !revision ||
        typeof revision.id !== "string" ||
        typeof revision.createdAt !== "string"
      )
        throw new Error("Invalid shared design revision.");
      validateSiteDesign(revision.design);
    });
  }
  value.pages.forEach((page) =>
    resolveSiteDocument(page.draft, value.site?.draft),
  );
  return value;
}
export function restoreExpected(workspace: Workspace): RestoreExpected {
  return clone({
    pageVersions: Object.fromEntries(
      workspace.pages.map((page) => [page.id, page.version]),
    ),
    siteVersion: workspace.site?.version || 0,
    routeVersion: workspace.routes?.version || 0,
    settingsVersion: workspace.settings?.version || 0,
    saved: workspace.saved,
  });
}
/** Preserve other definitions/tokens; imported definitions with matching IDs and global defaults win. */
function mergeDesign(
  current: SiteDesign | undefined,
  incoming: SiteDesign,
): SiteDesign {
  if (!current) return clone(incoming);
  const components = new Map(current.components.map((item) => [item.id, item]));
  incoming.components.forEach((item) => components.set(item.id, item));
  const tokens = clone(current.theme.tokens || {});
  for (const [group, values] of Object.entries(incoming.theme.tokens || {}))
    tokens[group as keyof typeof tokens] = {
      ...tokens[group as keyof typeof tokens],
      ...values,
    };
  return validateSiteDesign({
    ...clone(incoming),
    components: [...components.values()],
    theme: { ...clone(incoming.theme), tokens },
  });
}
export function makeRestorePlan(
  current: Workspace,
  incoming: Workspace,
  expected = restoreExpected(current),
): RestorePlan {
  validateBackupWorkspace(incoming);
  const plan: RestorePlan = {
    pages: clone(incoming.pages),
    saved: clone(incoming.saved),
    expected,
  };
  if (incoming.site)
    plan.site = {
      ...clone(incoming.site),
      draft: mergeDesign(current.site?.draft, incoming.site.draft),
    };
  const documents = new Map(current.pages.map((page) => [page.id, page.draft]));
  if (incoming.routes) plan.routes = validateRouteState(incoming.routes);
  if (incoming.settings)
    plan.settings = validateSettingsState(incoming.settings);
  plan.pages.forEach((page) => documents.set(page.id, page.draft));
  validateBuilderRedirects(
    current.routes?.published || [],
    [...documents.values()].map((document) => `/${document.slug}/`),
  );
  for (const [id, document] of documents) {
    if (
      [...documents].some(
        ([other, value]) => other !== id && value.slug === document.slug,
      ) ||
      current.pages.some(
        (page) => page.id !== id && page.published?.slug === document.slug,
      )
    )
      throw new Error(
        `The URL /${document.slug}/ belongs to another page. Rename the conflicting page before restoring.`,
      );
    resolveSiteDocument(document, plan.site?.draft || current.site?.draft);
  }
  return plan;
}
export function applyRestorePlan(
  workspace: Workspace,
  plan: RestorePlan,
): Workspace {
  const expected = restoreExpected(workspace);
  if (
    !plan.expected ||
    (plan.settings &&
      expected.settingsVersion !== (plan.expected.settingsVersion || 0)) ||
    expected.siteVersion !== plan.expected.siteVersion ||
    (plan.routes &&
      expected.routeVersion !== (plan.expected.routeVersion || 0)) ||
    JSON.stringify(expected.saved) !== JSON.stringify(plan.expected.saved) ||
    Object.keys(expected.pageVersions).length !==
      Object.keys(plan.expected.pageVersions).length ||
    Object.entries(expected.pageVersions).some(
      ([id, version]) => plan.expected.pageVersions[id] !== version,
    )
  )
    throw new Error(
      "The workspace changed. Review the backup again before restoring.",
    );
  // Revalidate the complete future draft graph before any write.
  makeRestorePlan(
    workspace,
    {
      pages: plan.pages,
      assets: [],
      saved: plan.saved,
      site: plan.site,
      routes: plan.routes,
      settings: plan.settings,
    },
    plan.expected,
  );
  const next = clone(workspace);
  if (plan.settings)
    next.settings = saveClientSettings(
      workspace.settings,
      workspace.settings?.version || 0,
      plan.settings.value,
    );
  const assetIndexes = new Map(
    next.assets.map((asset, index) => [asset.id, index]),
  );
  for (const item of plan.assetUpdates || []) {
    const index = assetIndexes.get(item.expected.id) ?? -1,
      old = next.assets[index];
    if (!old || JSON.stringify(old) !== JSON.stringify(item.expected))
      throw new Error("An asset changed. Review the backup again.");
    if (
      Object.keys(item.asset).some(
        (key) =>
          ![
            "tags",
            "favourite",
            "originalPack",
            "image",
            "generatedFrom",
            "conversion",
          ].includes(key) &&
          JSON.stringify(item.asset[key as keyof typeof item.asset]) !==
            JSON.stringify(old[key as keyof typeof old]),
      )
    )
      throw new Error("Restoring metadata cannot overwrite an asset file.");
    next.assets[index] = {
      ...old,
      tags: clone(item.asset.tags),
      favourite: item.asset.favourite,
      originalPack: item.asset.originalPack || item.asset.pack,
      ...(item.asset.image ? { image: clone(item.asset.image) } : {}),
      ...(item.asset.conversion
        ? { conversion: clone(item.asset.conversion) }
        : {}),
      ...(item.asset.generatedFrom
        ? { generatedFrom: item.asset.generatedFrom }
        : {}),
    };
  }
  for (const asset of next.assets)
    if (asset.conversion)
      validateConversion(asset.conversion, asset, next.assets);
  const incoming = new Map(plan.pages.map((page) => [page.id, page]));
  const staged = next.pages.map((page) =>
    incoming.has(page.id)
      ? { ...page, draft: incoming.get(page.id)!.draft }
      : page,
  );
  for (const page of plan.pages) {
    const old = workspace.pages.find((item) => item.id === page.id);
    const result = savePage(
      staged,
      page.draft,
      page.id,
      old?.version || 0,
      "Restored project backup",
    );
    const publication = page.published
      ? [
          {
            id: newId(),
            label: "Published snapshot from backup",
            createdAt: page.publishedAt || new Date().toISOString(),
            document: clone(page.published),
          },
        ]
      : [];
    // Keep a pre-restore draft immediately before the new revision, even when both histories are full.
    const previous = old
      ? [
          {
            id: newId(),
            label: "Before project restore",
            createdAt: new Date().toISOString(),
            document: clone(old.draft),
          },
        ]
      : [];
    const revisions = [
      ...page.revisions,
      ...publication,
      ...(old?.revisions || []),
      ...previous,
      result.revisions.slice(-1)[0],
    ];
    result.revisions = [
      ...new Map(revisions.map((revision) => [revision.id, revision])).values(),
    ].slice(-50);
    const index = next.pages.findIndex((item) => item.id === page.id);
    if (index === -1) next.pages.push(result);
    else next.pages[index] = result;
  }
  if (plan.site) {
    const site = saveSiteDesign(
      workspace.site,
      workspace.site?.version || 0,
      plan.site.draft,
    );
    const previous = workspace.site
      ? [
          {
            id: newId(),
            createdAt: new Date().toISOString(),
            design: clone(workspace.site.draft),
          },
        ]
      : [];
    site.revisions = [
      ...new Map(
        [
          ...plan.site.revisions,
          ...(workspace.site?.revisions || []),
          ...previous,
          site.revisions.slice(-1)[0],
        ].map((revision) => [revision.id, revision]),
      ).values(),
    ].slice(-30);
    next.site = site;
  }
  if (plan.routes) {
    const routes = saveRoutes(
      workspace.routes,
      workspace.routes?.version || 0,
      plan.routes.draft,
    );
    const previous = workspace.routes
      ? [
          {
            id: newId(),
            createdAt: new Date().toISOString(),
            rules: clone(workspace.routes.draft),
          },
        ]
      : [];
    routes.revisions = [
      ...new Map(
        [
          ...plan.routes.revisions,
          ...(workspace.routes?.revisions || []),
          ...previous,
          routes.revisions.slice(-1)[0],
        ].map((revision) => [revision.id, revision]),
      ).values(),
    ].slice(-30);
    next.routes = routes;
  }
  const saved = new Map(next.saved.map((item) => [item.id, item]));
  plan.saved.forEach((item) => saved.set(item.id, clone(item)));
  next.saved = [...saved.values()];
  return next;
}
