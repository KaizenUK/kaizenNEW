import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clone,
  freshBlocks,
  resolveResponsiveStyle,
  savePage,
  type Workspace,
} from "../../shared/visualBuilder";
import {
  assertPageSitePublished,
  initialSiteDesign,
  publishSiteWorkspace,
  resolveShared,
  resolveSiteDocument,
  saveSiteDesign,
  sharedInstance,
  validateSiteDesign,
} from "../../shared/builderSite";
import { newDocument, starterBlocks } from "./starters";
import PublishedPage from "./Renderer";
import { validatePreviewDocument } from "../../shared/builderPreviews";

function fixture(): Workspace {
  const design = initialSiteDesign();
  design.components = [
    {
      id: "shared-header",
      name: "Main header",
      kind: "header",
      blocks: [starterBlocks.Menu()],
    },
    {
      id: "shared-cta",
      name: "Call to action",
      kind: "section",
      blocks: [starterBlocks.CallToAction()],
    },
  ];
  const site = saveSiteDesign(undefined, 0, design);
  const pages = ["first", "second", "third"].map((slug) => {
    const document = newDocument(slug, `site-${slug}`, false);
    document.site = { useTheme: true, headerId: "shared-header" };
    document.data.content = [sharedInstance("shared-cta")];
    return savePage([], document, slug, 0);
  });
  return { pages, site, assets: [], saved: [] };
}
const versions = (workspace: Workspace) =>
  Object.fromEntries(workspace.pages.map((page) => [page.id, page.version]));

describe("shared site design", () => {
  it.each([{ useTheme: false }, {}])(
    "removes inactive site metadata before preview or publication without changing the saved page (%j)",
    (site) => {
      const document = newDocument("Independent page", "independent");
      document.site = site;
      const original = clone(document);
      const resolved = resolveSiteDocument(document);
      expect(resolved.site).toBeUndefined();
      expect(validatePreviewDocument(resolved)).toEqual(resolved);
      expect(assertPageSitePublished(document)).toEqual(resolved);
      expect(document).toEqual(original);
    },
  );
  it("updates three linked pages and preserves explicit and empty instance overrides", () => {
    const workspace = fixture();
    const text = workspace.site.draft.components[1].blocks[0].props.children[0];
    workspace.pages[1].draft.data.content[0].props.overrides = {
      [text.props.id]: { text: "Only on this page" },
    };
    workspace.pages[2].draft.data.content[0].props.overrides = {
      [text.props.id]: { text: "" },
    };
    text.props.text = "New shared heading";
    const resolved = workspace.pages.map((page) =>
      resolveSiteDocument(page.draft, workspace.site.draft),
    );
    expect(JSON.stringify(resolved[0])).toContain("New shared heading");
    expect(JSON.stringify(resolved[1])).toContain("Only on this page");
    expect(JSON.stringify(resolved[1])).not.toContain("New shared heading");
    expect(JSON.stringify(resolved[2])).not.toContain("New shared heading");
    expect(resolved[0].site).toBeUndefined();
    expect(
      resolved.every(
        (document) => !JSON.stringify(document).includes('"type":"Shared"'),
      ),
    ).toBe(true);
    const instance = workspace.pages[0].draft.data.content[0];
    const duplicate = freshBlocks([instance])[0];
    expect(
      resolveShared(instance, workspace.site.draft).props.children[0].props.id,
    ).not.toBe(
      resolveShared(duplicate, workspace.site.draft).props.children[0].props.id,
    );
    const detached = resolveShared(instance, workspace.site.draft);
    text.props.text = "Later definition";
    expect(JSON.stringify(detached)).toContain("New shared heading");
    expect(JSON.stringify(detached)).not.toContain("Later definition");
  });
  it("publishes the reviewed set atomically and leaves live snapshots unchanged on shared edits or failed review", () => {
    let workspace = fixture();
    expect(() =>
      assertPageSitePublished(workspace.pages[0].draft, workspace.site),
    ).toThrow("Publish your site design");
    workspace = publishSiteWorkspace(
      workspace,
      workspace.site.version,
      versions(workspace),
    );
    const before = clone(workspace.pages.map((page) => page.published));
    const draft = clone(workspace.site.draft);
    draft.theme.accent = "#ff5500";
    workspace.site = saveSiteDesign(
      workspace.site,
      workspace.site.version,
      draft,
    );
    expect(workspace.pages.map((page) => page.published)).toEqual(before);
    expect(() =>
      assertPageSitePublished(workspace.pages[0].draft, workspace.site),
    ).toThrow("still drafts");
    const stale = versions(workspace);
    stale.first--;
    expect(() =>
      publishSiteWorkspace(workspace, workspace.site.version, stale),
    ).toThrow("Pages changed");
    expect(workspace.pages.map((page) => page.published)).toEqual(before);
    const next = publishSiteWorkspace(
      workspace,
      workspace.site.version,
      versions(workspace),
    );
    expect(
      next.pages.every((page) => page.published.theme.accent === "#ff5500"),
    ).toBe(true);
    expect(workspace.pages.map((page) => page.published)).toEqual(before);
    expect(
      assertPageSitePublished(next.pages[0].draft, next.site).theme.accent,
    ).toBe("#ff5500");
  });
  it("validates definitions and rejects missing references, cycles and stale saves", () => {
    const workspace = fixture();
    expect(() =>
      saveSiteDesign(workspace.site, 0, workspace.site.draft),
    ).toThrow("another window");
    const broken = clone(workspace.site.draft);
    broken.components[0].blocks = [sharedInstance("shared-cta")];
    broken.components[1].blocks = [sharedInstance("shared-header")];
    expect(() => validateSiteDesign(broken)).toThrow("circular");
    expect(() =>
      resolveShared(sharedInstance("missing"), workspace.site.draft),
    ).toThrow("missing");
    const invalid = clone(workspace.pages[0].draft);
    invalid.data.content[0].props.overrides = {
      [workspace.site.draft.components[1].blocks[0].props.id]: { children: [] },
    };
    expect(() => resolveSiteDocument(invalid, workspace.site.draft)).toThrow(
      "detaching",
    );
  });
  it("renders referenced colour, spacing and typography tokens with responsive override/reset semantics", () => {
    const workspace = fixture();
    const page = workspace.pages[0].draft;
    const text = starterBlocks.Text();
    text.props.style = {
      desktop: {
        tokens: { color: "brand", padding: "section", fontSize: "heading" },
      },
      mobile: { padding: 20, fontSize: 24 },
    };
    page.data.content = [text];
    const desktop = resolveResponsiveStyle(text.props.style, "desktop");
    const mobile = resolveResponsiveStyle(text.props.style, "mobile");
    expect(desktop.tokens.paddingLeft).toBe("section");
    expect(mobile.tokens.color).toBe("brand");
    expect(mobile.tokens.paddingLeft).toBeUndefined();
    expect(mobile.paddingLeft).toBe(20);
    const html = renderToStaticMarkup(
      <PublishedPage
        document={resolveSiteDocument(page, workspace.site.draft)}
      />,
    );
    expect(html).toContain("--kb-token-colors-brand:#d5f86b");
    expect(html).toContain("--d-paddingLeft:var(--kb-token-spacing-section");
    expect(html).toContain("--m-fontSize:24px");
    expect(html).not.toContain("<script");
  });
});
