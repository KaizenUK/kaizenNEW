import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clone,
  freshBlocks,
  normalizeSlug,
  safeUrl,
  savePage,
  validateDocument,
  resolveResponsiveStyle,
  needsBuilderRuntime,
} from "../../shared/visualBuilder";
import { newDocument, starterBlocks } from "./starters";
import PublishedPage, { styleVars } from "./Renderer";
import { insertBlocks } from "./config";
import RichText from "./RichText";

describe("versioned builder pages", () => {
  it("keeps interactive markup safe and static fallbacks usable", () => {
    const doc = newDocument("Interactions", "interactions", false);
    const menu = starterBlocks.Menu();
    menu.props.links = [
      { label: "<img onerror=evil()>", href: "javascript:evil()" },
    ];
    const tabs = starterBlocks.Tabs();
    doc.data.content = [
      menu,
      tabs,
      starterBlocks.Accordion(),
      starterBlocks.Video(),
    ];
    expect(validateDocument(doc)).toBe(doc);
    const html = renderToStaticMarkup(<PublishedPage document={doc} />);
    expect(html).toContain("&lt;img onerror=evil()&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
    expect(html).toContain("data-kb-panel");
    expect(html).toContain("Launch with confidence");
    expect(html).toContain("<summary>");
    expect(needsBuilderRuntime(doc.data.content)).toBe(true);
    expect(
      needsBuilderRuntime([starterBlocks.Accordion(), starterBlocks.Video()]),
    ).toBe(false);
    tabs.props.items = [{ title: "Broken", content: {} }];
    expect(() => validateDocument(doc)).toThrow("Invalid items");
  });
  it("renders rich formatting as safe React elements and removes executable or unsafe content", () => {
    const html = renderToStaticMarkup(
      <RichText
        html={
          '<h2>A &amp; B</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/work/" target="_blank" onclick="evil()">Work</a></p><a href="java&#x73;cript:evil()">bad link</a><script>evil()</script><img src=x onerror=evil()><svg><script>evil()</script></svg><p style="text-align:center;background:url(evil)">Centred</p><ul><li>First</li></ul>'
        }
      />,
    );
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain(
      'href="/work/" target="_blank" rel="noopener noreferrer"',
    );
    expect(html).toContain("A &amp; B");
    expect(html).toContain('style="text-align:center"');
    expect(html).toContain("<ul><li>First</li></ul>");
    expect(html).not.toMatch(/evil|onclick|javascript|<script|<svg|<img/);
    expect(html).toContain("bad link");
  });
  it("resolves smaller-screen shorthands before side overrides without mutating the saved document", () => {
    const styles = {
      desktop: {
        padding: 64,
        paddingLeft: 100,
        gap: 24,
        columnGap: 40,
        columns: 2,
        columnWidths: "2 1",
      },
      tablet: { padding: 32, gap: 16 },
      mobile: { padding: 20, paddingBottom: 48, columns: 1 },
    };
    const original = clone(styles);
    expect(resolveResponsiveStyle(styles, "desktop").paddingLeft).toBe(100);
    expect(resolveResponsiveStyle(styles, "tablet")).toMatchObject({
      paddingLeft: 32,
      rowGap: 16,
      columnGap: 16,
      columnWidths: "2 1",
    });
    expect(resolveResponsiveStyle(styles, "mobile")).toMatchObject({
      paddingLeft: 20,
      paddingBottom: 48,
      columns: 1,
    });
    expect(
      resolveResponsiveStyle(styles, "mobile").columnWidths,
    ).toBeUndefined();
    expect(styles).toEqual(original);
  });
  it("keeps explicit zero, visibility and responsive ordering overrides", () => {
    expect(
      resolveResponsiveStyle(
        {
          desktop: { hidden: true, order: 2, margin: 30 },
          mobile: { hidden: false, order: 0, marginTop: 0 },
        },
        "mobile",
      ),
    ).toMatchObject({ hidden: false, order: 0, marginTop: 0, marginLeft: 30 });
  });
  it("constrains visual layout data before creating CSS", () => {
    const css = styleVars({
      desktop: {
        columnWidths: "2 1",
        focalX: 200,
        overlayOpacity: 150,
        paddingTop: -40,
      },
      mobile: { columns: 1, order: -1, objectFit: "contain" },
    });
    expect(css["--d-columnWidths"]).toBe("minmax(0, 2fr) minmax(0, 1fr)");
    expect(css["--m-columnWidths"]).toBe(
      "repeat(var(--v-columns), minmax(0, 1fr))",
    );
    expect(css["--d-focalX"]).toBe("100%");
    expect(css["--d-paddingTop"]).toBe("0px");
    expect(css["--m-objectFit"]).toBe("contain");
    const unsafe = styleVars({
      desktop: {
        columnWidths: "1; background: url(evil)",
        objectFit: "url(evil)",
        overlayColor: "red;position:fixed",
      },
    });
    expect(JSON.stringify(unsafe)).not.toContain("evil");
    expect(unsafe["--d-overlayColor"]).toBe("transparent");
  });
  it("keeps drafts and restored revisions independent from the published snapshot", () => {
    const doc = newDocument("First", "test-page");
    const original = savePage([], doc, "page", 0);
    original.published = clone(original.draft);
    const updated = savePage(
      [original],
      { ...doc, title: "Second" },
      "page",
      1,
    );
    expect(updated.published.title).toBe("First");
    const restored = savePage(
      [updated],
      original.revisions[0].document,
      "page",
      2,
      "Restored revision",
    );
    expect(restored.draft.title).toBe("First");
    expect(restored.version).toBe(3);
    expect(updated.revisions[1].document.title).toBe("Second");
  });
  it("rejects lost updates and both live and draft URL collisions", () => {
    const original = savePage([], newDocument("First", "first"), "page", 0);
    original.published = { ...clone(original.draft), slug: "live-url" };
    expect(() => savePage([original], original.draft, "page", 0)).toThrow(
      "another window",
    );
    expect(() =>
      savePage([original], newDocument("Other", "live-url"), "other", 0),
    ).toThrow("already uses");
    expect(() =>
      savePage([original], newDocument("Other", "first"), "other", 0),
    ).toThrow("already uses");
  });
  it("reserves site routes and rejects unsafe URLs", () => {
    for (const slug of [
      "builder",
      "studio/test",
      "blog/test",
      "../test",
      "test//bad",
      "",
      "api/test",
      "about",
    ])
      expect(() => normalizeSlug(slug)).toThrow();
    expect(normalizeSlug("/Campaigns/Summer/")).toBe("campaigns/summer");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "//evil.test",
      "/\\evil.test",
      "java\nscript:alert(1)",
    ])
      expect(safeUrl(url)).toBe("");
    expect(safeUrl("https://example.com/image.png", true)).toBe(
      "https://example.com/image.png",
    );
  });
  it("renews every nested id when reusing components", () => {
    const blocks = [starterBlocks.Hero()];
    const copied = freshBlocks(blocks);
    expect(copied[0].props.id).not.toBe(blocks[0].props.id);
    expect(copied[0].props.children[0].props.id).not.toBe(
      blocks[0].props.children[0].props.id,
    );
    expect(() =>
      validateDocument({
        ...newDocument("Reusable", "reusable"),
        data: { root: {}, content: [...blocks, ...copied] },
      }),
    ).not.toThrow();
  });
  it("inserts an asset into a selected nested container without duplicating it elsewhere", () => {
    const hero = starterBlocks.Hero();
    const image = starterBlocks.Image();
    const target = hero.props.children[0];
    const content = insertBlocks(
      [hero, starterBlocks.Footer()],
      [image],
      target.props.id,
    );
    expect(
      content[0].props.children[0].props.children.slice(-1)[0].props.id,
    ).toBe(image.props.id);
    expect(JSON.stringify(content).split(image.props.id)).toHaveLength(2);
  });
  it("rejects unsupported versions, components and duplicate ids", () => {
    const doc = newDocument("Safe", "safe");
    expect(() => validateDocument({ ...doc, schemaVersion: 2 } as any)).toThrow(
      "version",
    );
    doc.data.content.push(clone(doc.data.content[0]));
    expect(() => validateDocument(doc)).toThrow("duplicate");
  });
  it("renders React output without editor scripts and escapes untrusted content", () => {
    const doc = newDocument("Safe", "safe", false);
    doc.data.content = [
      {
        type: "Text",
        props: {
          id: "text",
          text: '<script>alert("x")</script>',
          style: {
            desktop: { fontSize: 48 },
            mobile: { fontSize: 24, padding: 20 },
          },
        },
      },
    ];
    const html = renderToStaticMarkup(<PublishedPage document={doc} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("puck");
    expect(html).toContain("--m-fontSize:24px");
    expect(html).toContain("--d-fontSize:48px");
  });
  it("rejects malformed documents before they reach the renderer", () => {
    const doc = newDocument("Safe", "safe");
    for (const change of [
      { theme: null },
      { title: 42 },
      { description: {} },
      { noIndex: "false" },
    ])
      expect(() => validateDocument({ ...doc, ...change } as any)).toThrow();
    doc.data.content = [
      { type: "Text", props: { id: "bad", text: {} as any } },
    ];
    expect(() => validateDocument(doc)).toThrow("component text");
    doc.data.content = [
      {
        type: "Text",
        props: { id: "bad", style: { mobile: { fontSize: {} as any } } },
      },
    ];
    expect(() => validateDocument(doc)).toThrow("responsive");
  });
});
