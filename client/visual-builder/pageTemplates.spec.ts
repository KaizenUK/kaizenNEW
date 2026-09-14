import { describe, expect, it, vi } from "vitest";
import {
  blockTypes,
  savePage,
  validateDocument,
  type Block,
  type Workspace,
} from "../../shared/visualBuilder";
import {
  initialSiteState,
  resolveSiteDocument,
} from "../../shared/builderSite";
import { pageTemplates, templateDocument, templateSlug } from "./starters";
import { previewHtml } from "./previewHtml";
import { saveTemplatePage } from "./templateCreation";

const empty = (): Workspace => ({
  pages: [],
  assets: [],
  saved: [],
  site: initialSiteState(),
});
const walk = (blocks: Block[]): Block[] =>
  blocks.flatMap((block) => [block, ...walk(block.props.children || [])]);

describe("page templates", () => {
  it("offers the six required page types with distinct section structures", () => {
    expect(pageTemplates.map((item) => item.name)).toEqual([
      "Home",
      "About",
      "Services",
      "Contact",
      "Pricing",
      "Landing page",
    ]);
    const structures = pageTemplates.map(({ id }) =>
      JSON.stringify(
        walk(templateDocument(id).data.content).map((block) => block.type),
      ),
    );
    expect(new Set(structures).size).toBe(6);
  });
  it.each(pageTemplates)(
    "validates and renders $name using existing blocks and local samples",
    ({ id, name }) => {
      const document = templateDocument(id, { siteName: "Garden studio" });
      expect(validateDocument(document)).toEqual(document);
      expect(document.title).toBe(name);
      expect(document.site?.useTheme).toBe(true);
      const blocks = walk(document.data.content);
      expect(blocks.length).toBeGreaterThan(10);
      for (const block of blocks) {
        expect(blockTypes).toContain(block.type);
        expect(["Registered", "Shared", "ContentList"]).not.toContain(
          block.type,
        );
        if (block.props.src)
          expect(block.props.src).toMatch(/^\/builder-samples\//);
      }
      const html = previewHtml(
        resolveSiteDocument(document, initialSiteState().draft),
      );
      expect(html).toContain("Garden studio");
      expect(html).toContain("data-kb-preview");
      expect(html).not.toContain("KAIZEN®");
    },
  );
  it("gives every use fresh nested IDs and preserves the template after editing a copy", () => {
    for (const { id } of pageTemplates) {
      const one = templateDocument(id),
        two = templateDocument(id);
      const ids = [...walk(one.data.content), ...walk(two.data.content)].map(
        (block) => block.props.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      one.data.content[0].props.text = "Changed";
      expect(two.data.content[0].props.text).not.toBe("Changed");
      expect(templateDocument(id).data.content[0].props.text).not.toBe(
        "Changed",
      );
    }
  });
  it("embeds bundled preview illustrations while preserving the saved image URL", () => {
    const document = templateDocument("home", { useSiteTheme: false });
    const before = structuredClone(document);
    const html = previewHtml(resolveSiteDocument(document));
    expect(html).toContain('src="data:image/svg+xml,');
    expect(html).not.toContain('src="/builder-samples/landscape.svg"');
    expect(document).toEqual(before);
    const image = walk(document.data.content).find(
      (block) => block.type === "Image",
    )!;
    image.props.src = "https://example.com/builder-samples/landscape.svg";
    expect(previewHtml(resolveSiteDocument(document))).toContain(
      'src="https://example.com/builder-samples/landscape.svg"',
    );
  });
  it("uses the project's saved site theme in previews and the editor", () => {
    const site = initialSiteState();
    site.draft.theme.accent = "#abc123";
    expect(
      resolveSiteDocument(templateDocument("home"), site.draft).theme.accent,
    ).toBe("#abc123");
    const independent = templateDocument("home", { useSiteTheme: false });
    expect(resolveSiteDocument(independent, site.draft).theme.accent).toBe(
      independent.theme.accent,
    );
    expect(previewHtml(resolveSiteDocument(independent))).toContain(
      "data-kb-preview",
    );
  });
  it("keeps draft, published, redirect and website URLs, and avoids the legacy reserved routes", () => {
    const workspace = empty();
    const document = templateDocument("about");
    workspace.pages = [
      {
        ...savePage([], document, "about-page", 0),
        published: { ...document, slug: "about-2" },
      },
    ];
    workspace.routes = {
      version: 1,
      draft: [
        {
          id: "redirect",
          source: "/about-3/",
          destination: "/about/",
          status: 301,
        },
      ],
      published: [],
      revisions: [],
    };
    expect(templateSlug("about", workspace, false, ["/about-4/"])).toBe(
      "about-5",
    );
    expect(templateSlug("home", empty(), true)).toBe("template-home");
    expect(templateSlug("contact", empty(), false)).toBe("contact");
    expect(() => templateDocument("missing" as "home")).toThrow(
      /available page templates/,
    );
  });
});

describe("creating a template page", () => {
  it("recovers a committed page after a lost acknowledgement without a second write", async () => {
    const workspace = empty(),
      document = templateDocument("home");
    const store = {
      saveSite: vi.fn(async () => initialSiteState()),
      save: vi.fn(async (id: string) => {
        workspace.pages.push(savePage([], document, id, 0));
        throw new Error("Connection lost");
      }),
      load: vi.fn(async () => workspace),
    };
    expect((await saveTemplatePage(store, "chosen-page", document)).id).toBe(
      "chosen-page",
    );
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(workspace.pages).toHaveLength(1);
  });
  it("retains the original failure when neither the write nor the recovery read succeeds", async () => {
    const store = {
      saveSite: vi.fn(async () => initialSiteState()),
      save: vi.fn(async () => {
        throw new Error("Save unavailable");
      }),
      load: vi
        .fn()
        .mockResolvedValueOnce(empty())
        .mockRejectedValue(new Error("Load unavailable")),
    };
    await expect(
      saveTemplatePage(store, "chosen-page", templateDocument("home")),
    ).rejects.toThrow("Save unavailable");
  });
  it("never treats different or newer content as acknowledgement of this creation", async () => {
    const document = templateDocument("home"),
      workspace = empty();
    workspace.pages = [
      savePage(
        [],
        { ...document, title: "Someone else's changes" },
        "chosen-page",
        0,
      ),
    ];
    const before = structuredClone(workspace);
    const store = {
      saveSite: vi.fn(async () => initialSiteState()),
      save: vi.fn(async () => {
        throw new Error("Page changed");
      }),
      load: vi.fn(async () => workspace),
    };
    await expect(
      saveTemplatePage(store, "chosen-page", document),
    ).rejects.toThrow("Page changed");
    expect(workspace).toEqual(before);
  });

  it("initialises a missing design only when Use template saves a linked page", async () => {
    const workspace = empty();
    delete workspace.site;
    const store = {
      load: async () => workspace,
      saveSite: vi.fn(
        async () => (workspace.site = { ...initialSiteState(), version: 1 }),
      ),
      save: vi.fn(
        async (
          id: string,
          version: number,
          document: ReturnType<typeof templateDocument>,
        ) => {
          const page = savePage(workspace.pages, document, id, version);
          workspace.pages.push(page);
          return page;
        },
      ),
    };
    const document = templateDocument("home");
    const saved = await saveTemplatePage(store, "home-page", document);
    expect(store.saveSite).toHaveBeenCalledTimes(1);
    expect(
      previewHtml(resolveSiteDocument(saved.draft, workspace.site!.draft)),
    ).toContain("data-kb-preview");
    await saveTemplatePage(store, "home-page", document);
    expect(store.saveSite).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("keeps a design saved concurrently instead of replacing it with the default", async () => {
    const workspace = empty();
    delete workspace.site;
    const chosen = { ...initialSiteState(), version: 1 };
    chosen.draft.theme.accent = "#aabbcc";
    const store = {
      load: async () => workspace,
      saveSite: vi.fn(async () => {
        workspace.site = chosen;
        throw new Error("Design changed");
      }),
      save: vi.fn(
        async (
          id: string,
          version: number,
          document: ReturnType<typeof templateDocument>,
        ) => savePage([], document, id, version),
      ),
    };
    await saveTemplatePage(store, "home-page", templateDocument("home"));
    expect(store.saveSite).toHaveBeenCalledTimes(1);
    expect(workspace.site).toBe(chosen);
  });
});
