import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync } from "fflate";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportProject } from "./exportProject";
import { newDocument, starterBlocks } from "./starters";

describe("portable developer project", () => {
  it("exports executable React source, static rendering, page data and localised media", async () => {
    const document = newDocument("Export demonstration", "export-demo", false);
    document.data.content = [starterBlocks.Hero()];
    const second = newDocument(
      "Second & private",
      "campaigns/second-page",
      false,
    );
    second.data.content = [starterBlocks.Hero()];
    second.noIndex = true;
    let downloads = 0;
    const result = await exportProject(
      [document, second],
      [],
      () => {},
      async () => {
        downloads++;
        return strToU8(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect width="120" height="100" fill="#779f43"/></svg>',
        );
      },
    );
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(strFromU8(files["src/pages.json"])).toContain("/assets/external-");
    const pages = JSON.parse(strFromU8(files["src/pages.json"]));
    expect(pages.map((page) => page.slug)).toEqual([
      "export-demo",
      "campaigns/second-page",
    ]);
    expect(pages[1].noIndex).toBe(true);
    expect(downloads).toBe(1);
    expect(
      Object.keys(files).filter((name) => name.startsWith("public/assets/")),
    ).toHaveLength(1);
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
    expect(strFromU8(files["src/page.css"])).toContain("--m-fontSize");
    expect(files["src/page.css"].length).toBeGreaterThan(1000);
    expect(result.warnings).toEqual([]);
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
