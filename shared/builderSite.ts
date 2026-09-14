import {
  clone,
  defaultTheme,
  newId,
  validateDocument,
  type Block,
  type PageDocument,
  type ResponsiveStyle,
  type SiteDesign,
  type SiteState,
  type Workspace,
} from "./visualBuilder.ts";
import { materializeImages } from "./builderImages.ts";

export const initialSiteDesign = (): SiteDesign => ({
  schemaVersion: 1,
  theme: {
    ...defaultTheme,
    tokens: {
      colors: { brand: "#d5f86b", ink: "#182421", paper: "#f7f8f2" },
      spacing: { small: 12, medium: 24, section: 64 },
      fontFamily: { body: "Inter, system-ui, sans-serif" },
      fontSize: { body: 18, heading: 48 },
      lineHeight: { body: 1.55 },
    },
  },
  components: [],
});
export const initialSiteState = (): SiteState => ({
  version: 0,
  draft: initialSiteDesign(),
  published: null,
  revisions: [],
});
export function usesSite(document: PageDocument): boolean {
  const walk = (blocks: Block[]): boolean =>
    blocks.some(
      (block) => block.type === "Shared" || walk(block.props.children || []),
    );
  return !!(
    document.site?.useTheme ||
    document.site?.headerId ||
    document.site?.footerId ||
    walk(document.data.content)
  );
}
export function sharedInstance(
  componentId: string,
  id: string = newId(),
): Block {
  return { type: "Shared", props: { id, componentId, overrides: {} } };
}
const scalarFields = new Set([
  "text",
  "html",
  "src",
  "alt",
  "href",
  "label",
  "eyebrow",
  "tag",
  "poster",
  "captions",
  "captionLanguage",
]);
function mergeStyle(
  base: ResponsiveStyle = {},
  override: ResponsiveStyle = {},
): ResponsiveStyle {
  return Object.fromEntries(
    (["desktop", "tablet", "mobile"] as const).map((device) => [
      device,
      {
        ...base[device],
        ...override[device],
        tokens: { ...base[device]?.tokens, ...override[device]?.tokens },
      },
    ]),
  );
}
/** Expand one linked instance while preserving independent overrides and unique nested IDs. */
export function resolveShared(
  block: Block,
  design: SiteDesign,
  stack: string[] = [],
): Block {
  const componentId = String(block.props.componentId);
  const component = design.components.find((item) => item.id === componentId);
  if (!component)
    throw new Error(
      "A shared component is missing. Choose another component or restore its definition.",
    );
  if (stack.includes(componentId) || stack.length > 10)
    throw new Error("Shared components cannot contain a circular reference.");
  const overrides = block.props.overrides || {};
  if (typeof overrides !== "object" || Array.isArray(overrides))
    throw new Error("Invalid instance overrides.");
  const prefix = block.props.id;
  const copy = (nodes: Block[]): Block[] =>
    nodes.map((node) => {
      const patch = (overrides as Record<string, unknown>)[node.props.id] || {};
      if (!patch || typeof patch !== "object" || Array.isArray(patch))
        throw new Error("Invalid instance overrides.");
      const props = clone(node.props);
      for (const [key, value] of Object.entries(patch)) {
        if (scalarFields.has(key)) {
          if (typeof value !== "string")
            throw new Error("Instance text overrides must be text.");
          props[key] = value;
        } else if (key === "style")
          props.style = mergeStyle(props.style, value as ResponsiveStyle);
        else
          throw new Error(
            "This instance override requires detaching the component first.",
          );
      }
      props.id = `${prefix}--${node.props.id}`;
      if (props.children) props.children = copy(props.children);
      const next = { ...node, props };
      return next.type === "Shared"
        ? resolveShared(next, design, [...stack, componentId])
        : next;
    });
  return {
    type: "Container",
    props: {
      id: prefix,
      style: block.props.style,
      children: copy(component.blocks),
    },
  };
}
/** Published/exported documents are independent snapshots; they need no site store. */
export function resolveSiteDocument(
  document: PageDocument,
  design?: SiteDesign | null,
): PageDocument {
  if (!usesSite(document)) {
    const result = clone(document);
    delete result.site;
    return result;
  }
  if (!design)
    throw new Error(
      "Publish your site design before publishing a page that uses shared content.",
    );
  const result = clone(document);
  const walk = (blocks: Block[]): Block[] =>
    blocks.map((block) =>
      block.type === "Shared"
        ? resolveShared(block, design)
        : {
            ...block,
            props: {
              ...block.props,
              ...(block.props.children
                ? { children: walk(block.props.children) }
                : {}),
            },
          },
    );
  const content = walk(result.data.content);
  if (document.site?.headerId)
    content.unshift(
      resolveShared(
        sharedInstance(document.site.headerId, "site-header"),
        design,
      ),
    );
  if (document.site?.footerId)
    content.push(
      resolveShared(
        sharedInstance(document.site.footerId, "site-footer"),
        design,
      ),
    );
  result.data.content = content;
  if (document.site?.useTheme) result.theme = clone(design.theme);
  else if (design.theme.tokens)
    result.theme.tokens = clone(design.theme.tokens);
  delete result.site;
  return validateDocument(result);
}
export function validateSiteDesign(design: SiteDesign): SiteDesign {
  if (
    !design ||
    design.schemaVersion !== 1 ||
    !Array.isArray(design.components) ||
    design.components.length > 100 ||
    JSON.stringify(design).length > 5_000_000
  )
    throw new Error("Invalid or oversized site design.");
  const ids = new Set<string>();
  const base: PageDocument = {
    schemaVersion: 1,
    title: "Site design",
    slug: "site-design-validation",
    description: "",
    noIndex: true,
    theme: design.theme,
    data: { root: {}, content: [] },
  };
  validateDocument(base);
  for (const component of design.components) {
    if (
      !component ||
      !/^[\w-]+$/.test(component.id) ||
      ids.has(component.id) ||
      typeof component.name !== "string" ||
      !component.name.trim() ||
      component.name.length > 120 ||
      !["section", "header", "footer"].includes(component.kind)
    )
      throw new Error("Invalid shared component.");
    ids.add(component.id);
    validateDocument({
      ...base,
      data: { root: {}, content: component.blocks },
    });
  }
  for (const component of design.components)
    resolveSiteDocument(
      { ...base, data: { root: {}, content: [sharedInstance(component.id)] } },
      design,
    );
  return design;
}
export function saveSiteDesign(
  state: SiteState | undefined,
  expected: number,
  design: SiteDesign,
): SiteState {
  const current = state || initialSiteState();
  if (current.version !== expected)
    throw new Error(
      "Site design changed in another window. Reopen it before saving.",
    );
  validateSiteDesign(design);
  return {
    ...current,
    version: expected + 1,
    draft: clone(design),
    revisions: [
      ...current.revisions,
      {
        id: newId(),
        createdAt: new Date().toISOString(),
        design: clone(design),
      },
    ].slice(-30),
  };
}
export function siteAffectedPages(workspace: Workspace) {
  return workspace.pages.filter((page) => usesSite(page.draft));
}
export function assertPageSitePublished(
  document: PageDocument,
  site?: SiteState,
) {
  const resolved = resolveSiteDocument(document, site?.published);
  if (
    usesSite(document) &&
    JSON.stringify(resolved) !==
      JSON.stringify(resolveSiteDocument(document, site?.draft))
  )
    throw new Error(
      "This page uses shared changes that are still drafts. Publish them from Site design first.",
    );
  return resolved;
}
export function publishSiteWorkspace(
  workspace: Workspace,
  expected: number,
  versions: Record<string, number>,
): Workspace {
  const next = clone(workspace);
  const site = next.site;
  if (!site || site.version !== expected)
    throw new Error("Site design changed. Review the affected pages again.");
  if (
    Object.keys(versions).length !== next.pages.length ||
    next.pages.some((page) => page.version !== versions[page.id])
  )
    throw new Error("Pages changed. Review the affected pages again.");
  validateSiteDesign(site.draft);
  const affected = siteAffectedPages(next);
  const snapshots = affected.map((page) =>
    materializeImages(resolveSiteDocument(page.draft, site.draft), next.assets),
  );
  const stamp = new Date().toISOString();
  affected.forEach((page, index) => {
    page.published = snapshots[index];
    page.publishedAt = stamp;
    page.version++;
    page.revisions = [
      ...page.revisions,
      {
        id: newId(),
        createdAt: stamp,
        label: "Published site design",
        document: clone(snapshots[index]),
      },
    ].slice(-50);
  });
  site.published = clone(site.draft);
  site.version++;
  return next;
}
