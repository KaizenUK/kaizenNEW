import { describe, it, expect } from "vitest";
import {
  applyProjectDraftAction,
  assertProjectAssetReferences,
  projectAssetUrl,
} from "../../shared/builderProjectOperations";
import { newDocument } from "./starters";
import { libraryFixture } from "./library-fixture";

describe("hosted project draft validation", () => {
  it("keeps the homepage and page order when saving either existing page", () => {
    let workspace = { pages: [], assets: [], saved: [] } as ReturnType<
      typeof libraryFixture
    >;
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    for (const [index, slug] of ["home", "about"].entries()) {
      workspace = applyProjectDraftAction(workspace, {
        action: "save",
        id: ids[index],
        version: 0,
        document: newDocument(slug, slug, false),
      }).workspace;
    }
    for (const id of [ids[0], ids[1], ids[0]]) {
      const page = workspace.pages.find((page) => page.id === id)!;
      workspace = applyProjectDraftAction(workspace, {
        action: "save",
        id,
        version: page.version,
        document: { ...page.draft, description: "A newer draft" },
      }).workspace;
      expect(workspace.pages.map((page) => page.id)).toEqual(ids);
      expect(workspace.pages[0].draft.slug).toBe("home");
    }
  });
  it("retains publications/history and rejects stale edits or malformed saved components", () => {
    const original = libraryFixture();
    const page = original.pages[0];
    const result = applyProjectDraftAction(original, {
      action: "save",
      id: page.id,
      version: page.version,
      document: { ...page.draft, title: "New project draft" },
    });
    expect(
      result.workspace.pages.find((p) => p.id === page.id)?.published,
    ).toEqual(page.published);
    expect(original.pages[0]).toEqual(page);
    expect(() =>
      applyProjectDraftAction(result.workspace, {
        action: "save",
        id: page.id,
        version: page.version,
        document: page.draft,
      }),
    ).toThrow(/another window/);
    expect(() =>
      applyProjectDraftAction(original, {
        action: "saved",
        item: {
          id: crypto.randomUUID(),
          name: "Bad",
          kind: "section",
          blocks: [{ type: "ExecuteSource", props: { id: "bad" } }],
        },
      }),
    ).toThrow();
    expect(() =>
      applyProjectDraftAction(original, { action: "publish" }),
    ).toThrow(/Unsupported/);
  });
  it("allows client routes and prevents cross-project asset references and temporary-token persistence", () => {
    const id = crypto.randomUUID(),
      assetId = crypto.randomUUID();
    const result = applyProjectDraftAction(
      { pages: [], assets: [], saved: [] },
      {
        action: "save",
        id: crypto.randomUUID(),
        version: 0,
        document: newDocument("About", "about", false),
      },
    );
    expect(result.result.draft.slug).toBe("about");
    assertProjectAssetReferences(result.workspace, id);
    result.workspace.pages[0].draft.theme.fontUrl = projectAssetUrl(
      crypto.randomUUID(),
      assetId,
    );
    expect(() => assertProjectAssetReferences(result.workspace, id)).toThrow(
      /outside/,
    );
    result.workspace.pages[0].draft.theme.fontUrl =
      "https://example.supabase.co/storage/v1/object/sign/builder-project-files/file?token=temporary";
    expect(() => assertProjectAssetReferences(result.workspace, id)).toThrow(
      /temporary/,
    );
  });
});
