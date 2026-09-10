import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clone,
  freshBlocks,
  normalizeSlug,
  safeUrl,
  savePage,
  validateDocument,
} from "../../shared/visualBuilder";
import { newDocument, starterBlocks } from "./starters";
import PublishedPage from "./Renderer";
import { insertBlocks } from "./config";

describe("versioned builder pages", () => {
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
