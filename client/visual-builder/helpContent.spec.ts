import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  helpLinkTarget,
  helpTopics,
  readHelpSection,
  type HelpTopic,
} from "./helpContent";

const guide = readFileSync(
  new URL("../../docs/visual-builder.md", import.meta.url),
  "utf8",
);
describe("the maintained in-app guide", () => {
  it.each(Object.keys(helpTopics) as HelpTopic[])(
    "has a short, renderable %s section with working help links",
    (topic) => {
      const blocks = readHelpSection(guide, topic);
      expect(blocks[0]).toEqual({
        kind: "heading",
        text: helpTopics[topic].title,
      });
      const text = blocks
        .flatMap((block) =>
          block.kind === "list" ? block.items : [block.text],
        )
        .join(" ");
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(220);
      expect(text.length).toBeGreaterThan(100);
      for (const [, target] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
        expect(helpLinkTarget(target)).toBeDefined();
    },
  );
  it("rejects missing, repeated, empty, oversized or unsupported sections", () => {
    const section = (value: string) =>
      `<!-- builder-help:pages -->\n${value}\n<!-- /builder-help -->`;
    for (const value of [
      "",
      "<!-- builder-help:pages -->",
      section(""),
      section("x".repeat(12001)),
      section("# Wrong heading"),
      section("<script>alert(1)</script>"),
      section("```js\nalert(1)\n```"),
      section("| table |"),
      section("First") + section("Second"),
    ])
      expect(() => readHelpSection(value, "pages")).toThrow();
  });
  it("keeps paragraphs, headings and numbered and bulleted instructions in order", () => {
    expect(
      readHelpSection(
        "<!-- builder-help:pages -->\n## Pages\n\nA line\ncontinued.\n\n- First\n- Second\n\n1. Open\n2. Save\n<!-- /builder-help -->",
        "pages",
      ),
    ).toEqual([
      { kind: "heading", text: "Pages" },
      { kind: "paragraph", text: "A line continued." },
      { kind: "list", ordered: false, items: ["First", "Second"] },
      { kind: "list", ordered: true, items: ["Open", "Save"] },
    ]);
  });
  it("allows only known help topics and plain HTTPS links", () => {
    expect(helpLinkTarget("#help-editor")).toEqual({ topic: "editor" });
    expect(helpLinkTarget("https://example.test/guide")).toEqual({
      href: "https://example.test/guide",
    });
    for (const target of [
      "#help-unknown",
      "#help-__proto__",
      "javascript:alert(1)",
      "data:text/html,hello",
      "http://example.test/",
      "//example.test/",
      "https://name:password@example.test/",
      "/builder/?publish=true",
    ])
      expect(helpLinkTarget(target)).toBeUndefined();
  });
});
