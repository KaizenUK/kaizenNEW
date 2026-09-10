import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportProject } from "./exportProject";
import { newDocument, starterBlocks } from "./starters";
import { initialSiteDesign, sharedInstance } from "../../shared/builderSite";
import { normalizeCatalogue } from "../../shared/builderContent";
import { contentFixture } from "../../tests/builder/content-fixture";

describe("portable developer project", () => {
  it("exports executable React source, static rendering, page data and localised media", async () => {
    const document = newDocument("Export demonstration", "export-demo", false);
    document.data.content = [starterBlocks.Hero()];
    document.data.content.push({
      ...starterBlocks.Registered(),
      props: {
        ...starterBlocks.Registered().props,
        text: "Reviewed export <script>example</script>",
      },
    });
    document.data.content[0].props.style.mobile.backgroundImage = "none";
    document.data.content[0].props.style.desktop.columnWidths = "2 1";
    const second = newDocument(
      "Second & private",
      "campaigns/second-page",
      false,
    );
    second.data.content = [starterBlocks.Hero()];
    second.data.content.push(starterBlocks.RichText());
    second.data.content.push(
      starterBlocks.Menu(),
      starterBlocks.Accordion(),
      starterBlocks.Tabs(),
      starterBlocks.Video(),
      starterBlocks.ContactForm(),
    );
    second.noIndex = true;
    const site = initialSiteDesign();
    const section = starterBlocks.CallToAction();
    site.components = [
      {
        id: "export-header",
        name: "Header",
        kind: "header",
        blocks: [starterBlocks.Menu()],
      },
      {
        id: "export-section",
        name: "Section",
        kind: "section",
        blocks: [section],
      },
    ];
    const third = newDocument("Shared styles", "shared-export", false);
    third.site = { useTheme: true, headerId: "export-header" };
    const instance = sharedInstance("export-section");
    instance.props.overrides = {
      [section.props.children[0].props.id]: {
        text: "An exported shared section",
      },
    };
    instance.props.style = { desktop: { tokens: { padding: "medium" } } };
    third.data.content = [instance];
    const fourth = newDocument("From Sanity", "cms-export", false);
    const listing = starterBlocks.ContentList();
    listing.props.categoryId = "design";
    const bound = starterBlocks.Text();
    bound.props.contentBinding = { postId: "design-one", field: "title" };
    fourth.data.content = [bound, listing];
    let downloads = 0;
    const result = await exportProject(
      [document, second, third, fourth],
      [],
      () => {},
      async (url) => {
        downloads++;
        if (url.endsWith("story.webm") || url.endsWith("story.vtt"))
          return new Uint8Array(
            await readFile(path.resolve("public", url.slice(1))),
          );
        return strToU8(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect width="120" height="100" fill="#779f43"/></svg>',
        );
      },
      site,
      normalizeCatalogue(contentFixture),
      [
        {
          id: crypto.randomUUID(),
          source: "/old-export/",
          destination: "/export-demo/",
          status: 302,
        },
      ],
    );
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(strFromU8(files["hosting/nginx-redirects.conf"])).toContain(
      'return 302 "/export-demo/$is_args$args"',
    );
    expect(JSON.parse(strFromU8(files["redirects.json"]))[0].source).toBe(
      "/old-export/",
    );
    expect(strFromU8(files["src/pages.json"])).toContain("/assets/external-");
    const pages = JSON.parse(strFromU8(files["src/pages.json"]));
    expect(pages.map((page) => page.slug)).toEqual([
      "export-demo",
      "campaigns/second-page",
      "shared-export",
      "cms-export",
    ]);
    expect(pages[1].noIndex).toBe(true);
    expect(pages[2].site).toBeUndefined();
    expect(pages[2].theme.tokens.colors.brand).toBe("#d5f86b");
    expect(JSON.stringify(pages[2])).toContain("An exported shared section");
    expect(JSON.stringify(pages[2])).not.toContain('"type":"Shared"');
    expect(downloads).toBe(4);
    expect(
      Object.keys(files).filter((name) => name.startsWith("public/assets/")),
    ).toHaveLength(4);
    expect(JSON.stringify(pages[3])).not.toContain("contentBinding");
    expect(pages[3].data.content[1].props.records).toHaveLength(2);
    expect(
      pages[3].data.content[1].props.records[1].image ||
        pages[3].data.content[1].props.records[0].image,
    ).toContain("/assets/external-");
    expect(strFromU8(files["src/builderContent.ts"])).not.toContain(
      "api.sanity.io",
    );
    expect(strFromU8(files["src/Renderer.tsx"])).toContain('"./schema"');
    expect(strFromU8(files["src/Renderer.tsx"])).not.toContain(
      'import "./page.css"',
    );
    expect(strFromU8(files["package.json"])).not.toMatch(
      /puck|supabase|sanity/i,
    );
    expect(strFromU8(files["HANDOFF.md"])).toContain(
      "Do not execute or import uploaded code",
    );
    expect(files["scripts/prerender.tsx"]).toBeDefined();
    expect(files["src/RichText.tsx"]).toBeDefined();
    expect(files["src/InteractiveBlocks.tsx"]).toBeDefined();
    expect(files["public/builder-runtime.js"]).toBeDefined();
    expect(strFromU8(files["src/page.css"])).toContain("--m-fontSize");
    expect(files["src/page.css"].length).toBeGreaterThan(1000);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("Sanity content was captured");
    expect(result.warnings[1]).toContain(
      "Contact forms need a receiving service",
    );
    expect(strFromU8(files["src/formConfig.ts"])).toContain(
      'builderFormEndpoint: string = ""',
    );
    expect(strFromU8(files["src/formConfig.ts"])).not.toContain(
      "__builder-contact",
    );
    expect(files["src/ContactBlock.tsx"]).toBeDefined();
    // Optional integration fixture: build the actual emitted project independently after this test.
    if (process.env.BUILDER_EXPORT_FIXTURE === "1") {
      const root = path.resolve("test-results/export-project");
      for (const [name, bytes] of Object.entries(files)) {
        const file = path.resolve(root, name);
        if (!file.startsWith(root + path.sep))
          throw new Error("Unsafe archive path");
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes);
      }
    }
  });
  it("fails clearly when an uploaded or local asset cannot be bundled", async () => {
    const doc = newDocument("Missing asset", "missing", false);
    doc.data.content = [starterBlocks.Image()];
    await expect(
      exportProject(
        [doc],
        [],
        () => {},
        async () => {
          throw new Error("File unavailable");
        },
      ),
    ).rejects.toThrow("Could not bundle");
  });
});
