import { describe, it, expect } from "vitest";
import {
  applyProjectDraftAction,
  assertProjectAssetReferences,
  projectAssetUrl,
} from "../../shared/builderProjectOperations";
import { newDocument } from "./starters";
import { libraryFixture } from "./library-fixture";

describe("hosted project draft validation", () => {
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
