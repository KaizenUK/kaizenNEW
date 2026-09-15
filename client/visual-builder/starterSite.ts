import { clone, newId, type Workspace } from "../../shared/visualBuilder";
import { initialSiteDesign } from "../../shared/builderSite";
import { matchesStarter, type StarterPlan } from "../../shared/builderStarter";
import { pageTemplates, templateDocument, templateSlug } from "./starters";

export function smallBusinessStarter(
  workspace: Workspace,
  siteName: string,
): StarterPlan {
  if (workspace.pages.length)
    throw new Error("Create a starter in a project with no pages.");
  const pages = pageTemplates.map(({ id }) => ({
    id: newId(),
    document: templateDocument(id, {
      siteName,
      slug: templateSlug(id, workspace),
    }),
  }));
  const home = pages[0].document;
  const header = clone(home.data.content[0]);
  header.props.href = `/${home.slug}/`;
  header.props.links = pages.map(({ document }) => ({
    label: document.title,
    href: `/${document.slug}/`,
  }));
  const footer = clone(home.data.content[home.data.content.length - 1]);
  const headerId = newId(),
    footerId = newId();
  const design = clone(workspace.site?.draft || initialSiteDesign());
  design.components.push(
    {
      id: headerId,
      name: "Small business navigation",
      kind: "header",
      blocks: [header],
    },
    {
      id: footerId,
      name: "Small business footer",
      kind: "footer",
      blocks: [footer],
    },
  );
  // Resolve all links to the actual created routes, including redirect collisions.
  const routes = new Map(
    pageTemplates.map(({ id }, index) => [
      `/${id}/`,
      `/${pages[index].document.slug}/`,
    ]),
  );
  const remap = (value: any): any =>
    typeof value === "string"
      ? routes.get(value) || value
      : Array.isArray(value)
        ? value.map(remap)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, item]) => [key, remap(item)]),
            )
          : value;
  for (const { document } of pages) {
    document.data.content = remap(document.data.content.slice(1, -1));
    document.site = { useTheme: true, headerId, footerId };
  }
  design.components.slice(-2).forEach((component) => {
    component.blocks = remap(component.blocks);
  });
  return {
    pages,
    design,
    siteVersion: workspace.site?.version || 0,
    routeVersion: workspace.routes?.version || 0,
  };
}

export async function saveStarterSite(
  store: {
    createStarter: (plan: StarterPlan) => Promise<Workspace>;
    load: () => Promise<Workspace>;
  },
  plan: StarterPlan,
) {
  try {
    return await store.createStarter(plan);
  } catch (failure) {
    try {
      const saved = await store.load();
      if (matchesStarter(saved, plan)) return saved;
    } catch {
      /* Preserve the original save failure. */
    }
    throw failure;
  }
}
