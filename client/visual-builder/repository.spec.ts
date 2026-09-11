import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import {
  RepositoryCompanion,
  inspectRepository,
  readEditableArchive,
} from "../../scripts/builder-repository";
import { LocalProjects } from "../../scripts/builder-projects";
import { exportProject } from "./exportProject";
import { newDocument, starterBlocks } from "./starters";
import { savePage, type Workspace } from "../../shared/visualBuilder";
import {
  defaultClientSettings,
  saveClientSettings,
} from "../../shared/builderSettings";

async function fixture(astro = true) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-repository-test-"));
  if (astro) {
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await mkdir(path.join(root, "src/components"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          type: "module",
          scripts: {
            build: "astro build",
            dev: "astro dev --host 127.0.0.1",
            preview: "astro preview --host 127.0.0.1",
          },
          dependencies: {
            astro: "6.4.8",
            "@astrojs/react": "5.0.0",
            react: "19.2.4",
            "react-dom": "19.2.4",
            htmlparser2: "12.0.0",
          },
          overrides: { sharp: "0.35.4", esbuild: "0.28.1" },
          devDependencies: {
            typescript: "5.9.3",
            "@types/react": "19.2.14",
            "@types/react-dom": "19.2.3",
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(root, "astro.config.mjs"),
      "import {defineConfig} from 'astro/config'; import react from '@astrojs/react'; export default defineConfig({output:'static', integrations:[react()], site:'https://fixture.invalid', trailingSlash:'always'});\n",
    );
    await writeFile(
      path.join(root, "src/pages/existing.astro"),
      "<html><body><h1>Existing code stays intact</h1></body></html>",
    );
    await writeFile(
      path.join(root, "src/components/Unrelated.tsx"),
      "export default function Unrelated(){return <p>Uncommitted developer work</p>}",
    );
    await writeFile(path.join(root, "README.md"), "Uncommitted README edits\n");
  }
  return root;
}
function workspace(): Workspace {
  return {
    settings: saveClientSettings(undefined, 0, {
      ...defaultClientSettings(),
      siteUrl: "https://client.example",
      formEndpoint: "/api/contact",
    }),
    pages: ["about", "contact"].map((slug) => {
      const document = newDocument(`Client ${slug}`, slug, false);
      if (slug === "contact") document.noIndex = true;
      const heading = starterBlocks.Text();
      heading.props.text = `Independent client ${slug}`;
      const menu = starterBlocks.Menu();
      menu.props.links = [
        { label: "About", href: "/about/" },
        { label: "Contact", href: "/contact/" },
      ];
      document.data.content = [menu, heading];
      return savePage([], document, crypto.randomUUID(), 0);
    }),
    assets: [],
    saved: [],
  };
}
async function archive(value = workspace()) {
  const exported = await exportProject(
    value.pages.map((p) => p.draft),
    value.assets,
    () => {},
    undefined,
    value.site?.draft,
    undefined,
    [],
    value,
  );
  return new Uint8Array(await exported.blob.arrayBuffer());
}
describe("safe local repository round trips", () => {
  it("reviews, integrates and reopens an Astro project while preserving unrelated code and developer edits", async () => {
    const root = await fixture();
    const companion = new RepositoryCompanion();
    const original = workspace();
    const proposal = await companion.prepare(
      root,
      "alpha",
      await archive(original),
    );
    expect(proposal.conflicts).toEqual([]);
    expect(proposal.changes.some((c) => c.file === "package.json")).toBe(false);
    await expect(
      readFile(path.join(root, "src/pages/about.astro")),
    ).rejects.toThrow();
    await expect(companion.apply(proposal.id, "beta")).rejects.toThrow(
      /another project/,
    );
    await companion.apply(proposal.id, "alpha");
    expect(
      await readFile(path.join(root, "src/pages/existing.astro"), "utf8"),
    ).toContain("Existing code stays intact");
    expect(
      await readFile(path.join(root, "src/components/Unrelated.tsx"), "utf8"),
    ).toContain("Uncommitted developer work");
    expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
      "Uncommitted README edits\n",
    );
    const reopened = readEditableArchive(await companion.editableArchive(root));
    expect(reopened.workspace).toEqual(original);
    const localRoot = await fixture(false);
    const projects = new LocalProjects(localRoot);
    const project = await projects.importWorkspace(
      "Reopened client",
      reopened.workspace,
      reopened.files,
    );
    expect(project.destination.kind).toBe("unconfigured");
    const updated = reopened.workspace;
    updated.pages[0] = savePage(
      updated.pages,
      { ...updated.pages[0].draft, title: "Second visual edit" },
      updated.pages[0].id,
      updated.pages[0].version,
    );
    const second = await companion.prepare(
      root,
      project.id,
      await archive(updated),
    );
    expect(second.conflicts).toEqual([]);
    expect(
      second.changes.find((c) => c.file === "src/pages/index.astro")?.action,
    ).not.toBe("delete");
    await companion.apply(second.id, project.id);
    expect(
      readEditableArchive(await companion.editableArchive(root)).workspace
        .pages[0].draft.title,
    ).toBe("Second visual edit");
    expect(
      (await inspectRepository(root)).routes.find(
        (r) => r.file === "src/pages/about.astro",
      )?.ownership,
    ).toBe("builder-editable");
    await mkdir("test-results", { recursive: true });
    await writeFile("test-results/astro-integration-fixture-path.txt", root);
  });
  it("rejects external edits, deleted generated files, route aliases and changes after review", async () => {
    const root = await fixture();
    const companion = new RepositoryCompanion();
    const exported = await archive();
    const plan = await companion.prepare(root, "alpha", exported);
    await writeFile(
      path.join(root, "src/pages/about.astro"),
      "<h1>Developer created this after review</h1>",
    );
    await expect(companion.apply(plan.id, "alpha")).rejects.toThrow(
      /Changed since review/,
    );
    expect(
      await readFile(path.join(root, "src/pages/about.astro"), "utf8"),
    ).toContain("Developer created");
    const conflict = await companion.prepare(root, "alpha", exported);
    expect(conflict.conflicts).toContain("src/pages/about.astro");
    const other = await fixture();
    await mkdir(path.join(other, "src/pages/about"));
    await writeFile(
      path.join(other, "src/pages/about/index.astro"),
      "<h1>Existing URL</h1>",
    );
    expect(
      (await companion.prepare(other, "alpha", exported)).conflicts,
    ).toContain("src/pages/about.astro");
    const clean = await fixture();
    const first = await companion.prepare(clean, "alpha", exported);
    await companion.apply(first.id, "alpha");
    await writeFile(
      path.join(clean, "src/kaizen/Renderer.tsx"),
      "developer changes",
    );
    await expect(companion.editableArchive(clean)).rejects.toThrow(
      /External change/,
    );
    expect(
      (await companion.prepare(clean, "alpha", exported)).conflicts,
    ).toContain("src/kaizen/Renderer.tsx");
  });
  it("exports a complete standalone repository and identifies unsupported frameworks", async () => {
    const root = await fixture(false);
    const exported = await archive();
    const files = unzipSync(exported);
    expect(files[".kaizen/project.zip"]).toBeDefined();
    const companion = new RepositoryCompanion();
    await companion.apply(
      (await companion.prepare(root, "alpha", exported)).id,
      "alpha",
    );
    expect((await inspectRepository(root)).framework).toBe("kaizen-export");
    expect(
      readEditableArchive(await companion.editableArchive(root)).workspace
        .pages,
    ).toHaveLength(2);
    await writeFile("test-results/standalone-project-fixture-path.txt", root);
    const unsupported = await fixture(false);
    await writeFile(
      path.join(unsupported, "package.json"),
      '{"dependencies":{"next":"15"}}',
    );
    expect((await inspectRepository(unsupported)).framework).toBe(
      "unsupported",
    );
    await expect(
      companion.prepare(unsupported, "alpha", exported),
    ).rejects.toThrow(/Automatic integration supports/);
  });
});
