import { describe, expect, it } from "vitest";
import { clone, savePage } from "../../shared/visualBuilder";
import {
  assetUsage,
  referencesAsset,
  replaceAssetInDrafts,
  replaceAssetUrl,
  reviewAssetReplacement,
  updateAssetMetadata,
} from "../../shared/builderLibrary";
import { libraryFixture } from "./library-fixture";

describe("asset library operations", () => {
  it("bulk-organises assets while retaining their original licence pack and immutable file identity", () => {
    const workspace = libraryFixture(),
      before = clone(workspace.assets);
    const changed = updateAssetMetadata(
      workspace.assets,
      workspace.assets.map((asset) => ({
        id: asset.id,
        expected: asset,
        patch: {
          tags: [" hero ", "hero", "campaign"],
          favourite: true,
          pack: " Launch ",
        },
      })),
    );
    expect(workspace.assets).toEqual(before);
    for (let index = 0; index < changed.length; index++)
      expect(changed[index]).toEqual({
        ...before[index],
        tags: ["hero", "campaign"],
        favourite: true,
        pack: "Launch",
        originalPack: "Source pack",
      });
    const movedAgain = updateAssetMetadata(changed, [
      { id: changed[0].id, expected: changed[0], patch: { pack: "Archive" } },
    ]);
    expect(movedAgain[0].originalPack).toBe("Source pack");
    expect(() =>
      updateAssetMetadata(workspace.assets, [
        { id: before[0].id, expected: before[0], patch: { favourite: true } },
        {
          id: before[1].id,
          expected: { ...before[1], name: "stale" },
          patch: { tags: [] },
        },
      ]),
    ).toThrow(/another window/);
    expect(workspace.assets).toEqual(before);
    expect(() =>
      updateAssetMetadata(before, [
        {
          id: before[0].id,
          expected: before[0],
          patch: { url: "/evil" } as any,
        },
      ]),
    ).toThrow();
  });
  it("replaces nested URL fields without corrupting prose, IDs or partial URL matches", () => {
    const value = {
      src: "/old",
      text: "/old",
      id: "/old",
      nested: [
        {
          backgroundImage: "/old",
          href: "/old-other",
          mobile: { fontUrl: "/old" },
        },
      ],
    };
    expect(replaceAssetUrl(value, "/old", "/new")).toEqual({
      ...value,
      src: "/new",
      nested: [
        {
          backgroundImage: "/new",
          href: "/old-other",
          mobile: { fontUrl: "/new" },
        },
      ],
    });
    expect(referencesAsset({ text: "/old" }, "/old")).toBe(false);
  });
  it("reports shared usage and replaces only drafts and reusable sources, retaining publications and restorable history", () => {
    const workspace = libraryFixture(),
      before = clone(workspace),
      [source, replacement] = workspace.assets;
    const usage = assetUsage(workspace, source);
    expect(usage.pages).toHaveLength(3);
    expect(usage.pages.every((page) => page.draft && page.live)).toBe(true);
    expect(usage.shared.map((item) => item.name)).toEqual(["Library header"]);
    expect(usage.saved).toHaveLength(1);
    const next = replaceAssetInDrafts(
      workspace,
      reviewAssetReplacement(workspace, source.id, replacement.id),
    );
    expect(workspace).toEqual(before);
    expect(next.assets).toEqual(before.assets);
    expect(next.pages.map((page) => page.published)).toEqual(
      before.pages.map((page) => page.published),
    );
    expect(next.site!.published).toEqual(before.site!.published);
    expect(next.pages[0].revisions.slice(0, -1)).toEqual(
      before.pages[0].revisions,
    );
    expect(next.pages[2].version).toBe(before.pages[2].version); // Shared-only page references the revised site source.
    expect(
      assetUsage(next, source).pages.every((page) => !page.draft && page.live),
    ).toBe(true);
    expect(
      assetUsage(next, replacement).pages.every(
        (page) => page.draft && !page.live,
      ),
    ).toBe(true);
    const restored = savePage(
      next.pages,
      before.pages[0].revisions[0].document,
      next.pages[0].id,
      next.pages[0].version,
    );
    expect(restored.draft.data.content[0].props.src).toBe(source.url);
  });
  it("rejects stale page, shared design, saved block and asset reviews without partial changes", () => {
    for (const mutate of [
      (w) => {
        w.pages[0].version++;
      },
      (w) => {
        w.site.version++;
      },
      (w) => {
        w.saved[0].name = "Changed";
      },
      (w) => {
        w.assets[1].favourite = true;
      },
      (w) => {
        w.pages.pop();
      },
    ]) {
      const workspace = libraryFixture(),
        review = reviewAssetReplacement(
          workspace,
          workspace.assets[0].id,
          workspace.assets[1].id,
        );
      mutate(workspace);
      const before = clone(workspace);
      expect(() => replaceAssetInDrafts(workspace, review)).toThrow(/changed/);
      expect(workspace).toEqual(before);
    }
    const workspace = libraryFixture();
    workspace.assets[1].kind = "code";
    expect(() =>
      reviewAssetReplacement(
        workspace,
        workspace.assets[0].id,
        workspace.assets[1].id,
      ),
    ).toThrow(/same asset type/);
  });
});
