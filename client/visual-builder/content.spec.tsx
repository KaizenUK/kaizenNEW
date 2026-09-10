import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  bindContentBlock,
  CONTENT_QUERY,
  fetchContentCatalogue,
  normalizeCatalogue,
  resolveContentDocument,
} from "../../shared/builderContent";
import {
  needsBuilderRuntime,
  validateDocument,
} from "../../shared/visualBuilder";
import { contentFixture } from "../../tests/builder/content-fixture";
import { newDocument, starterBlocks } from "./starters";
import PublishedPage from "./Renderer";

describe("Sanity content bindings", () => {
  it("preserves non-English slugs and rejects broken published URLs explicitly", () => {
    const fixture = structuredClone(contentFixture);
    fixture.posts[0].slug = "créativité";
    expect(normalizeCatalogue(fixture).posts[0].href).toBe(
      "/blog/cr%C3%A9ativit%C3%A9/",
    );
    fixture.posts[0].slug = "../private";
    expect(() => normalizeCatalogue(fixture)).toThrow("invalid URL");
  });
  it("uses published metadata, optimises approved image URLs and filters/orders repeatable cards", () => {
    const catalogue = normalizeCatalogue(contentFixture);
    expect(catalogue.posts).toHaveLength(3);
    expect(catalogue.posts[0].image).toContain("auto=format");
    expect(catalogue.posts[0].href).toBe("/blog/thoughtful-first-impression/");
    const document = newDocument("Journal", "journal-test", false),
      listing = starterBlocks.ContentList();
    listing.props.categoryId = "design";
    listing.props.sort = "title";
    listing.props.limit = 1;
    document.data.content = [listing];
    const resolved = resolveContentDocument(document, catalogue);
    expect(
      (resolved.data.content[0].props.records as any[]).map((post) => post.id),
    ).toEqual(["design-one"]);
    expect(document.data.content[0].props.records).toBeUndefined();
    const html = renderToStaticMarkup(<PublishedPage document={resolved} />);
    expect(html).toContain("A thoughtful first impression");
    expect(html).not.toContain("Unpublished fixture");
    expect(needsBuilderRuntime(resolved.data.content)).toBe(false);
  });
  it("binds native text/image/link blocks and leaves source drafts unchanged", () => {
    const catalogue = normalizeCatalogue(contentFixture),
      document = newDocument("Bindings", "bindings-test", false);
    const text = starterBlocks.Text(),
      image = starterBlocks.Image(),
      button = starterBlocks.Button();
    text.props.contentBinding = { postId: "design-one", field: "title" };
    image.props.contentBinding = { postId: "design-one", field: "image" };
    button.props.contentBinding = { postId: "design-one", field: "link" };
    document.data.content = [text, image, button];
    const resolved = resolveContentDocument(document, catalogue);
    expect(resolved.data.content[0].props.text).toBe(
      contentFixture.posts[0].title,
    );
    expect(resolved.data.content[1].props.src).toContain("cdn.sanity.io");
    expect(resolved.data.content[2].props.href).toBe(
      "/blog/thoughtful-first-impression/",
    );
    expect(
      resolved.data.content.every((block) => !block.props.contentBinding),
    ).toBe(true);
    expect(document.data.content[0].props.contentBinding).toBeDefined();
    expect(
      bindContentBlock(
        {
          ...text,
          props: {
            ...text.props,
            contentBinding: { postId: "design-one", field: "publishedAt" },
          },
        },
        catalogue,
      ).props.text,
    ).toBe("20 August 2026");
    const changed = structuredClone(catalogue);
    changed.posts[0].title = "New published title";
    expect(
      resolveContentDocument(document, changed).data.content[0].props.text,
    ).toBe("New published title");
    expect(resolved.data.content[0].props.text).toBe(
      contentFixture.posts[0].title,
    );
  });
  it("stops unresolved or invalid bindings instead of silently publishing stale content", () => {
    const catalogue = normalizeCatalogue(contentFixture),
      document = newDocument("Missing", "missing-cms", false);
    document.data.content = [starterBlocks.Text()];
    document.data.content[0].props.contentBinding = {
      postId: "missing",
      field: "title",
    };
    expect(() => resolveContentDocument(document, catalogue)).toThrow(
      "missing or unpublished",
    );
    expect(() => resolveContentDocument(document)).toThrow(
      "Load Sanity content",
    );
    document.data.content = [starterBlocks.ContentList()];
    document.data.content[0].props.categoryId = "missing";
    expect(() => resolveContentDocument(document, catalogue)).toThrow(
      "category no longer exists",
    );
    expect(() =>
      resolveContentDocument(document, { ...catalogue, truncated: true }),
    ).toThrow("exceeds 1,000");
    document.data.content[0].props.limit = -1;
    expect(() => validateDocument(document)).toThrow("listing settings");
  });
  it("uses a fixed published-only query and treats CMS failure as failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: contentFixture }), {
          status: 200,
        }),
      );
    await fetchContentCatalogue(
      {
        projectId: "test-project",
        dataset: "production",
        token: "fixture-only-secret",
      },
      fetcher,
    );
    const [url, options] = fetcher.mock.calls[0];
    expect(url.searchParams.get("perspective")).toBe("published");
    expect(url.searchParams.get("query")).toBe(CONTENT_QUERY);
    expect(options.headers.Authorization).toBe("Bearer fixture-only-secret");
    expect(url.toString()).not.toContain("fixture-only-secret");
    await expect(fetchContentCatalogue({}, fetcher)).rejects.toThrow(
      "not connected",
    );
    fetcher.mockResolvedValue(new Response("", { status: 503 }));
    await expect(
      fetchContentCatalogue(
        { projectId: "test-project", dataset: "production" },
        fetcher,
      ),
    ).rejects.toThrow("503");
  });
});
