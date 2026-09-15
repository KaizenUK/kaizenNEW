import {
  clone,
  savePage,
  type PageDocument,
  type SiteDesign,
  type Workspace,
} from "./visualBuilder.ts";
import { saveSiteDesign } from "./builderSite.ts";
import { validateBackupWorkspace } from "./builderBackup.ts";

export type StarterPlan = {
  pages: { id: string; document: PageDocument }[];
  design: SiteDesign;
  siteVersion: number;
  routeVersion: number;
};

/** One draft transaction: a starter cannot replace existing pages or activate a release. */
export function applyStarterSite(
  workspace: Workspace,
  plan: StarterPlan,
): Workspace {
  if (workspace.pages.length)
    throw new Error(
      "This project already has pages. Browse page templates to add another page.",
    );
  if (
    !plan ||
    plan.siteVersion !== (workspace.site?.version || 0) ||
    plan.routeVersion !== (workspace.routes?.version || 0)
  )
    throw new Error(
      "The project changed. Close the starter and open it again before creating your site.",
    );
  if (!Array.isArray(plan.pages) || plan.pages.length !== 6)
    throw new Error("The Small business starter needs all six pages.");
  const next = clone(workspace);
  next.site = saveSiteDesign(workspace.site, plan.siteVersion, plan.design);
  for (const { id, document } of plan.pages) {
    if (
      [
        ...(workspace.routes?.draft || []),
        ...(workspace.routes?.published || []),
      ].some((rule) => rule.source === `/${document?.slug}/`)
    )
      throw new Error(
        "A starter page URL is already used by a redirect. Close the starter and open it again.",
      );
    next.pages.push(
      savePage(next.pages, document, id, 0, "Created Small business starter"),
    );
  }
  validateBackupWorkspace(next);
  return next;
}

/** A lost acknowledgement can be recovered only when all of the saved draft still matches. */
export function matchesStarter(
  workspace: Workspace,
  plan: StarterPlan,
): boolean {
  return (
    workspace.pages.length === plan.pages.length &&
    JSON.stringify(workspace.site?.draft) === JSON.stringify(plan.design) &&
    plan.pages.every(
      ({ id, document }, index) =>
        workspace.pages[index]?.id === id &&
        JSON.stringify(workspace.pages[index].draft) ===
          JSON.stringify(document),
    )
  );
}
