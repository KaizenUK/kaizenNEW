import { clientSourceError } from "./sourceReview";
import { describe, expect, it } from "vitest";
import { sourceReviewChanges } from "./sourceReview";
import type { SourceEdits } from "../../shared/builderSourceEditing";

const edits = (): SourceEdits => ({
  inspection: {
    root: "/private/website",
    route: "src/pages/index.astro",
    files: [{ file: "src/pages/index.astro", hash: "before" }],
    boundaries: [],
    fields: [
      {
        id: "heading",
        file: "src/pages/index.astro",
        line: 1,
        label: "h1 text",
        kind: "text",
        value: "Original heading",
      },
      {
        id: "second",
        file: "src/pages/index.astro",
        line: 2,
        label: "h2 text",
        kind: "text",
        value: "Visit us",
      },
      {
        id: "link",
        file: "src/components/Header.tsx",
        line: 3,
        label: "a href",
        kind: "link",
        value: "/old/",
      },
      {
        id: "image",
        file: "src/pages/index.astro",
        line: 4,
        label: "img src",
        kind: "image",
        value: "/images/old.svg",
      },
      {
        id: "space",
        file: "src/content/card.json",
        line: 5,
        label: "mobile padding",
        kind: "text",
        value: "12",
        design: { property: "padding", unit: "px", device: "mobile" },
      },
    ],
    groups: [
      {
        id: "sections",
        label: "main sections",
        file: "src/pages/index.astro",
        items: [
          { id: "one", label: "section", fieldIds: ["heading"] },
          { id: "two", label: "section", fieldIds: ["second"] },
        ],
      },
    ],
  },
  values: {
    heading: "New heading",
    link: "/new/",
    image: "/images/123.svg",
    space: "24",
  },
  orders: { sections: ["two", "one"] },
  assets: [
    { fieldId: "image", assetId: "picture", path: "public/images/123.svg" },
  ],
});

describe("plain source review", () => {
  it("describes actual text, address, selected image, design units and section order without source paths", () => {
    const before = edits();
    const snapshot = structuredClone(before);
    const result = sourceReviewChanges(before, [
      { id: "picture", name: "Garden drawing.svg" },
    ]);
    expect(result).toEqual([
      {
        id: "heading",
        label: "Heading",
        before: ["Original heading"],
        after: ["New heading"],
        shared: false,
      },
      {
        id: "link",
        label: "Link address",
        before: ["/old/"],
        after: ["/new/"],
        shared: true,
      },
      {
        id: "image",
        label: "Image",
        before: ["old.svg"],
        after: ["Garden drawing.svg"],
        shared: false,
      },
      {
        id: "space",
        label: "Inner spacing · Phone",
        before: ["12 px"],
        after: ["24 px"],
        shared: true,
      },
      {
        id: "sections",
        label: "Section order",
        before: ["Original heading", "Visit us"],
        after: ["Visit us", "New heading"],
        ordered: true,
        shared: false,
      },
    ]);
    expect(before).toEqual(snapshot);
    expect(JSON.stringify(result)).not.toMatch(/src\/|public\/|\/private/);
  });

  it("keeps complete literal text and empty replacements, and omits unchanged fields and order", () => {
    const input = edits();
    const literal =
      '<script>alert("This is text")</script>\n' + "Long copy ".repeat(1000);
    input.values = { heading: literal, second: "", link: "/old/" };
    input.orders.sections = ["one", "two"];
    input.assets = [];
    const result = sourceReviewChanges(input, []);
    expect(result.map((item) => item.id)).toEqual(["heading", "second"]);
    expect(result[0].after).toEqual([literal]);
    expect(result[1].after).toEqual([""]);
  });
});

it("explains a saved-draft review race without replacing it with a generic failure", () => {
  expect(
    clientSourceError("Save the latest editing draft before reviewing it."),
  ).toBe(
    "Your newer edits are kept. Wait for Saved, then review your changes again.",
  );
  expect(
    clientSourceError(
      "Your edits changed while preparing the review. Review them again before applying.",
    ),
  ).toContain("review your changes again");
  expect(
    clientSourceError("Unexpected private /website/path detail"),
  ).not.toContain("/website/path");
});
