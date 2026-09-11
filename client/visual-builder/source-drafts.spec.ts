import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SourceDrafts } from "../../scripts/builder-source-drafts";
import { RepositoryCompanion } from "../../scripts/builder-repository";

describe("private source editing drafts", () => {
  it("restores across companion instances, separates projects and detects another window's save", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "kaizen-source-drafts-"));
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          astro: "6.4.8",
          react: "19.2.4",
          "@astrojs/react": "5.0.0",
        },
      }),
    );
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "<main><h1>Original</h1><p>Original copy</p></main>",
    );
    const companion = new RepositoryCompanion();
    const inspection = await companion.inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    const directory = path.join(root, "private-project-alpha");
    const drafts = new SourceDrafts(directory);
    const field = inspection.fields.find((f) => f.value === "Original")!;
    const edits = {
      inspection,
      values: { [field.id]: "Unapplied headline" },
      orders: {},
    };
    expect((await drafts.read(root, inspection.route)).version).toBe(0);
    await drafts.save(root, inspection.route, 0, edits);
    expect(
      (await new SourceDrafts(directory).read(root, inspection.route)).edits,
    ).toEqual(edits);
    expect(
      (
        await new SourceDrafts(path.join(root, "private-project-beta")).read(
          root,
          inspection.route,
        )
      ).edits,
    ).toBeNull();
    expect((await drafts.read(root, "src/pages/about.astro")).edits).toBeNull();
    await expect(drafts.save(root, inspection.route, 0, edits)).rejects.toThrow(
      "another window",
    );
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "<h1>Changed externally</h1>",
    );
    expect((await drafts.read(root, inspection.route)).edits).toEqual(edits);
    await expect(companion.prepareSource("alpha", edits)).rejects.toThrow(
      "Source changed",
    );
    expect(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
    ).toBe("<h1>Changed externally</h1>");
    const discarded = await drafts.save(root, inspection.route, 1, null);
    expect(discarded.version).toBe(2);
    expect(discarded.edits).toBeNull();
    await expect(drafts.save(root, inspection.route, 1, edits)).rejects.toThrow(
      "another window",
    );
    await expect(
      drafts.save(root, inspection.route, 2, {
        ...edits,
        values: { unknown: "Bad field" },
      }),
    ).rejects.toThrow("field");
    await expect(
      drafts.read(root, "src/pages/../../secret.astro"),
    ).rejects.toThrow("inspected");
  });
});
