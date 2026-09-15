import { describe, it, expect, vi } from "vitest";
import { smallBusinessStarter, saveStarterSite } from "./starterSite";
import { applyProjectDraftAction } from "../../shared/builderProjectOperations";
import { applyStarterSite, matchesStarter } from "../../shared/builderStarter";
import {
  initialSiteState,
  resolveSiteDocument,
} from "../../shared/builderSite";
import { newDocument, starterBlocks } from "./starters";
import { savePage, type Workspace } from "../../shared/visualBuilder";
import { previewHtml } from "./previewHtml";
import { libraryFixture } from "./library-fixture";
import { defaultClientSettings } from "../../shared/builderSettings";

const empty = (): Workspace => ({
  pages: [],
  assets: [],
  saved: [],
  site: initialSiteState(),
});
describe("Small business starter", () => {
  it("creates all six drafts atomically with a shared header, footer and chosen theme", () => {
    const original = empty();
    original.site!.draft.theme.accent = "#123456";
    const plan = smallBusinessStarter(original, "Garden studio");
    const { workspace } = applyProjectDraftAction(original, {
      action: "create-starter",
      plan,
    });
    expect(original.pages).toEqual([]);
    expect(workspace.pages.map((page) => page.draft.title)).toEqual([
      "Home",
      "About",
      "Services",
      "Contact",
      "Pricing",
      "Landing page",
    ]);
    expect(workspace.site?.draft.theme).toEqual(original.site!.draft.theme);
    expect(workspace.site?.published).toBeNull();
    for (const page of workspace.pages) {
      expect(page.published).toBeNull();
      expect(page.version).toBe(1);
      expect(page.revisions[page.revisions.length - 1]?.label).toBe(
        "Created Small business starter",
      );
      const document = resolveSiteDocument(page.draft, workspace.site!.draft);
      const html = previewHtml(document);
      expect(html).toContain("Garden studio");
      expect(html).toContain('href="/pricing/"');
      expect(html).toContain('href="/landing/"');
      expect(document.theme.accent).toBe("#123456");
    }
    expect(matchesStarter(workspace, plan)).toBe(true);
    workspace.site!.draft.components[0].blocks[0].props.text =
      "New business name";
    for (const page of workspace.pages)
      expect(
        previewHtml(resolveSiteDocument(page.draft, workspace.site!.draft)),
      ).toContain("New business name");
  });
  it("preserves existing assets, settings, saved blocks, shared components and redirects", () => {
    const original = empty();
    original.assets = libraryFixture().assets;
    original.settings = {
      version: 2,
      value: {
        ...defaultClientSettings(),
        siteUrl: "https://example.com",
        formEndpoint: "/enquiries",
      },
    };
    original.saved = [
      {
        id: crypto.randomUUID(),
        kind: "section",
        name: "Existing section",
        blocks: [starterBlocks.Text()],
      },
    ];
    original.site!.draft.components = [
      {
        id: crypto.randomUUID(),
        name: "Existing shared section",
        kind: "section",
        blocks: [starterBlocks.Text()],
      },
    ];
    original.routes = {
      version: 1,
      draft: [
        {
          id: crypto.randomUUID(),
          source: "/pricing/",
          destination: "/pricing-2/",
          status: 301,
        },
      ],
      published: [],
      revisions: [],
    };
    const plan = smallBusinessStarter(original, "Garden studio");
    const next = applyStarterSite(original, plan);
    expect(next.pages[4].draft.slug).toBe("pricing-2");
    expect(next.routes).toEqual(original.routes);
    expect(next.saved).toEqual(original.saved);
    expect(next.assets).toEqual(original.assets);
    expect(next.settings).toEqual(original.settings);
    expect(next.site!.draft.components[0]).toEqual(
      original.site!.draft.components[0],
    );
    expect(
      previewHtml(resolveSiteDocument(next.pages[0].draft, next.site!.draft)),
    ).toContain('href="/pricing-2/"');
  });
  it("refuses a changed project, occupied routes, duplicates and malformed pages without partial writes", () => {
    const original = empty();
    const plan = smallBusinessStarter(original, "Garden studio");
    const occupied = {
      ...original,
      pages: [
        savePage(
          [],
          newDocument("Existing", "existing", false),
          crypto.randomUUID(),
          0,
        ),
      ],
    };
    expect(() => applyStarterSite(occupied, plan)).toThrow(/already has pages/);
    expect(() =>
      applyStarterSite(
        { ...original, site: { ...original.site!, version: 1 } },
        plan,
      ),
    ).toThrow(/project changed/);
    const bad = structuredClone(plan);
    bad.pages[5].document.data.content[0].type = "Invalid" as any;
    expect(() => applyStarterSite(original, bad)).toThrow();
    expect(original.pages).toHaveLength(0);
    expect(original.site?.version).toBe(0);
    const duplicate = structuredClone(plan);
    duplicate.pages[5].id = duplicate.pages[0].id;
    expect(() => applyStarterSite(original, duplicate)).toThrow();
    const routes = {
      ...original,
      routes: {
        version: 1,
        draft: [
          {
            id: crypto.randomUUID(),
            source: "/pricing/",
            destination: "/elsewhere/",
            status: 301 as const,
          },
        ],
        published: [],
        revisions: [],
      },
    };
    expect(() => applyStarterSite(routes, plan)).toThrow(/project changed/);
    expect(() =>
      applyStarterSite(routes, { ...plan, routeVersion: 1 }),
    ).toThrow(/redirect/);
  });
  it("recovers a lost creation response but never overwrites newer work", async () => {
    const original = empty(),
      plan = smallBusinessStarter(original, "Garden studio");
    let saved = original;
    const failure = new Error("Response lost");
    const store = {
      createStarter: vi.fn(async () => {
        saved = applyStarterSite(saved, plan);
        throw failure;
      }),
      load: async () => saved,
    };
    expect((await saveStarterSite(store, plan)).pages).toHaveLength(6);
    expect(store.createStarter).toHaveBeenCalledTimes(1);
    saved.pages[0].draft.title = "Newer work";
    expect(matchesStarter(saved, plan)).toBe(false);
    await expect(
      saveStarterSite(
        {
          ...store,
          createStarter: async () => {
            throw failure;
          },
        },
        plan,
      ),
    ).rejects.toBe(failure);
    expect(saved.pages[0].draft.title).toBe("Newer work");
  });
});
