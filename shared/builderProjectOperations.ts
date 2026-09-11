import {
  clone,
  savePage,
  type Workspace,
  type Asset,
} from "./visualBuilder.ts";
import { validateBackupWorkspace, applyRestorePlan } from "./builderBackup.ts";
import { saveSiteDesign } from "./builderSite.ts";
import { saveRoutes } from "./builderRoutes.ts";
import { replaceAssetInDrafts, updateAssetMetadata } from "./builderLibrary.ts";
import { attachAssetImage } from "./builderImages.ts";
import { saveConversion } from "./builderConversions.ts";
import { saveClientSettings } from "./builderSettings.ts";

/** Shared server-side draft transitions. Publication is deliberately a separate release operation. */
export function applyProjectDraftAction(
  original: Workspace,
  input: any,
): { workspace: Workspace; result: any } {
  let workspace = clone(original),
    result: any;
  switch (input.action) {
    case "settings":
      result = workspace.settings = saveClientSettings(
        workspace.settings,
        input.version,
        input.settings,
      );
      break;
    case "save": {
      if (
        workspace.routes?.published.some(
          (rule) => rule.source === `/${input.document?.slug}/`,
        )
      )
        throw new Error(
          "This URL has a published redirect. Remove it from the next release before changing the page.",
        );
      result = savePage(
        workspace.pages,
        input.document,
        input.id,
        input.version,
        input.label,
      );
      // Publication serves the first page at /. Editing must not change it.
      workspace.pages = workspace.pages.some((page) => page.id === result.id)
        ? workspace.pages.map((page) => page.id === result.id ? result : page)
        : [...workspace.pages, result];
      break;
    }
    case "site":
      result = workspace.site = saveSiteDesign(
        workspace.site,
        input.version,
        input.design,
      );
      break;
    case "routes":
      result = workspace.routes = saveRoutes(
        workspace.routes,
        input.version,
        input.rules,
      );
      break;
    case "restore-backup":
      workspace = applyRestorePlan(workspace, input.plan);
      result = workspace;
      break;
    case "replace-asset":
      workspace = replaceAssetInDrafts(workspace, input.review);
      result = workspace;
      break;
    case "asset-metadata":
      workspace.assets = updateAssetMetadata(workspace.assets, input.changes);
      result = workspace.assets.filter((asset) =>
        input.changes.some((change: any) => change.id === asset.id),
      );
      break;
    case "asset":
      workspace.assets = updateAssetMetadata(workspace.assets, [
        {
          id: input.asset.id,
          expected: workspace.assets.find(
            (asset) => asset.id === input.asset.id,
          )!,
          patch: { tags: input.asset.tags, favourite: input.asset.favourite },
        },
      ]);
      result = workspace.assets.find((asset) => asset.id === input.asset.id);
      break;
    case "asset-image":
      result = attachAssetImage(workspace.assets, input.expected, input.image);
      workspace.assets = workspace.assets.map((asset) =>
        asset.id === result.id ? result : asset,
      );
      break;
    case "asset-conversion":
      result = saveConversion(workspace.assets, input.expected, input.draft);
      workspace.assets = workspace.assets.map((asset) =>
        asset.id === result.id ? result : asset,
      );
      break;
    case "saved":
      workspace.saved = [
        ...workspace.saved.filter((item) => item.id !== input.item?.id),
        input.item,
      ];
      result = input.item;
      break;
    case "register-asset": {
      const asset = input.asset as Asset;
      const previous = workspace.assets.find((item) => item.id === asset.id);
      if (
        previous &&
        (previous.hash !== asset.hash ||
          previous.pack !== asset.pack ||
          previous.path !== asset.path)
      )
        throw new Error("This asset ID is already in use.");
      result = previous || asset;
      if (!previous) workspace.assets.push(asset);
      break;
    }
    default:
      throw new Error("Unsupported project draft operation.");
  }
  validateBackupWorkspace(workspace);
  return { workspace, result };
}

export function projectAssetUrl(projectId: string, assetId: string) {
  return `/builder-project-media/${projectId}/${assetId}`;
}
/** Do not accept another client's asset references, even when the editor is a member of both. */
export function assertProjectAssetReferences(
  workspace: Workspace,
  projectId: string,
) {
  const assets = new Set(
    workspace.assets.map((asset) => projectAssetUrl(projectId, asset.id)),
  );
  for (const asset of workspace.assets)
    if (asset.url !== projectAssetUrl(projectId, asset.id))
      throw new Error("Asset files must belong to the selected project.");
  function check(value: unknown) {
    if (typeof value === "string") {
      if (value.startsWith("/builder-project-media/") && !assets.has(value))
        throw new Error(
          "This content references an asset outside the selected project. Import it into this project first.",
        );
      if (value.includes("/storage/v1/object/sign/builder-project-files/"))
        throw new Error(
          "Save stable project asset references, not temporary access URLs.",
        );
    } else if (Array.isArray(value)) value.forEach(check);
    else if (value && typeof value === "object")
      Object.values(value).forEach(check);
  }
  check(workspace);
}
