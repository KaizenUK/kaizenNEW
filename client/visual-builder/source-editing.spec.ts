import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  inspectSource,
  editSource,
  sourceImport,
} from "../../scripts/builder-source-editing";
import { RepositoryCompanion } from "../../scripts/builder-repository";

describe("original source editing", () => {
  it("edits imported data literals, follows barrel exports and detects external data changes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "kaizen-source-data-"));
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await mkdir(path.join(root, "src/content"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          astro: "6.4.8",
          "@astrojs/react": "5.0.0",
          react: "19.2.4",
        },
      }),
    );
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "---\nimport {headline, content} from '../content';\n---\n<h1>{headline}</h1><p>{content.copy}</p>",
    );
    await writeFile(
      path.join(root, "src/content/index.ts"),
      "export {headline} from './text.js'; export {default as content} from './copy.json';",
    );
    const code =
      "export const headline = 'Original headline'; export const computed = () => headline.toUpperCase();";
    const json = '{"copy":"Original 🌱 copy","privateToken":"unchanged"}';
    await writeFile(path.join(root, "src/content/text.ts"), code);
    await writeFile(path.join(root, "src/content/copy.json"), json);
    const companion = new RepositoryCompanion();
    const inspection = await companion.inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    expect(inspection.files).toHaveLength(4);
    expect(inspection.fields.map((field) => field.value)).toEqual([
      "Original headline",
      "Original 🌱 copy",
    ]);
    const edits = {
      inspection,
      values: Object.fromEntries(
        inspection.fields.map((field) => [
          field.id,
          'Revised "content" ${literal}',
        ]),
      ),
      orders: {},
    };
    const plan = await companion.prepareSource("alpha", edits);
    expect((await companion.apply(plan.id, "alpha")).changed).toBe(2);
    expect(
      JSON.parse(
        await readFile(path.join(root, "src/content/copy.json"), "utf8"),
      ),
    ).toEqual({
      copy: 'Revised "content" ${literal}',
      privateToken: "unchanged",
    });
    expect(
      await readFile(path.join(root, "src/content/text.ts"), "utf8"),
    ).toContain("export const computed = () => headline.toUpperCase();");
    const reopened = await companion.inspectSourcePage(root, inspection.route);
    await writeFile(path.join(root, "src/content/copy.json"), json);
    await expect(
      companion.prepareSource("alpha", { ...edits, inspection: reopened }),
    ).rejects.toThrow("Source changed");
    await expect(
      inspectSource("src/content/copy.json", '{"copy":"bad",}'),
    ).rejects.toThrow("JSON syntax");
  });
  it("edits Unicode Astro text, attributes and data without changing styles, scripts or hydration", async () => {
    const source = `---\r\nimport Counter from '../components/Counter';\r\nconst cards = [{title: 'Original title', copy: 'Original copy'}];\r\n---\r\n<main><h1>  Hello 🌱 &amp; welcome  </h1><img src='/before.png' alt='Use <tools>' /><Counter client:load /><p>{cards[0].copy}</p></main>\r\n<style>h1 { color: red }</style>\r\n<script>document.addEventListener('click', () => {});</script>`;
    const model = await inspectSource("src/pages/index.astro", source);
    expect(model.fields.map((f) => f.value)).toEqual(
      expect.arrayContaining([
        "Hello 🌱 & welcome",
        "Use <tools>",
        "Original copy",
      ]),
    );
    const values = Object.fromEntries(
      model.fields
        .filter((f) =>
          ["Hello 🌱 & welcome", "Use <tools>", "Original copy"].includes(
            f.value,
          ),
        )
        .map((f) => [
          f.id,
          f.value === "Original copy"
            ? 'Quote " and ${literal}'
            : '<strong>New 🌳</strong> {literal} & "quote"',
        ]),
    );
    const edited = await editSource(model.file, source, values, {});
    expect(edited).toContain("<Counter client:load />");
    expect(edited).toContain(
      "<style>h1 { color: red }</style>\r\n<script>document.addEventListener('click', () => {});</script>",
    );
    expect(edited).toContain("<p>{cards[0].copy}</p>");
    expect(edited).toContain(
      '  &lt;strong&gt;New 🌳&lt;/strong&gt; &#123;literal&#125; &amp; "quote"  ',
    );
    const reopened = await inspectSource(model.file, edited);
    expect(reopened.fields.map((f) => f.value)).toEqual(
      expect.arrayContaining([
        '<strong>New 🌳</strong> {literal} & "quote"',
        'Quote " and ${literal}',
      ]),
    );
    expect(await editSource(model.file, source, {}, {})).toBe(source);
  });

  it("preserves React handlers and expressions while changing literal content", async () => {
    const source = `import {useState} from 'react';\nconst data = [{title: 'First 🚀', href: '/old/'}];\nexport default function Counter(){const [count,setCount]=useState(0);return <section><h2>  Original 🌱 &amp; title  </h2><a href="/old/" title="Use &lt;tools&gt;">Visit</a><button onClick={()=>setCount(count+1)}>Count: {count}</button><style>{'h2 {color:red}'}</style></section>}`;
    const model = await inspectSource("client/Counter.tsx", source);
    const title = model.fields.find((f) => f.value === "Original 🌱 & title")!;
    expect(title).toBeDefined();
    const edited = await editSource(
      model.file,
      source,
      { [title.id]: "Next <title> {literal}" },
      {},
    );
    expect(edited).toBe(
      source.replace(
        "Original 🌱 &amp; title",
        "Next &lt;title&gt; &#123;literal&#125;",
      ),
    );
    expect(
      (await inspectSource(model.file, edited)).fields.some(
        (f) => f.value === "Next <title> {literal}",
      ),
    ).toBe(true);
    const link = model.fields.find((f) => f.kind === "link")!;
    await expect(
      editSource(model.file, source, { [link.id]: "javascript:alert(1)" }, {}),
    ).rejects.toThrow("URL");
    await expect(
      inspectSource(model.file, "export default function( {"),
    ).rejects.toThrow("syntax");
  });

  it("reorders complete original Astro sections and applies their text edits", async () => {
    const source = `---\nimport Widget from '../components/Widget';\n---\n<main>\n<section><h2>Alpha</h2><p>A body</p></section>\n<!-- keep comment -->\n<Widget client:visible label="Beta" />\n<section><h2>Gamma</h2><p>C body</p></section>\n</main>`;
    const model = await inspectSource("src/pages/index.astro", source);
    const main = model.groups.find((g) => g.label === "main sections")!;
    const alpha = model.fields.find((f) => f.value === "Alpha")!;
    const edited = await editSource(
      model.file,
      source,
      { [alpha.id]: "Revised alpha" },
      { [main.id]: main.items.map((i) => i.id).reverse() },
    );
    expect(edited.indexOf("Gamma")).toBeLessThan(
      edited.indexOf('<Widget client:visible label="Beta" />'),
    );
    expect(edited.indexOf("Beta")).toBeLessThan(
      edited.indexOf("Revised alpha"),
    );
    expect(edited.match(/keep comment/g)).toHaveLength(1);
    expect(edited).toContain("<h2>Revised alpha</h2><p>A body</p>");
    await expect(
      editSource(
        model.file,
        source,
        {},
        { [main.id]: main.items.map(() => main.items[0].id) },
      ),
    ).rejects.toThrow("exactly once");
    const nested = model.groups.find((g) => g.label === "section sections")!;
    await expect(
      editSource(
        model.file,
        source,
        {},
        {
          [main.id]: main.items.map((i) => i.id).reverse(),
          [nested.id]: nested.items.map((i) => i.id).reverse(),
        },
      ),
    ).rejects.toThrow("nested level");
    await expect(
      editSource(
        model.file,
        source,
        {},
        {
          [nested.id]: nested.items.map((i) => i.id).reverse(),
          [main.id]: main.items.map((i) => i.id).reverse(),
        },
      ),
    ).rejects.toThrow("nested level");
  });

  it("reviews, applies and reopens a native page with shared source and recovery copies", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "kaizen-native-source-"));
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await mkdir(path.join(root, "src/components"));
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
    const original = `---\nimport Counter from '../components/Counter';\n---\n<h1>Original page</h1><Counter client:load />`;
    const component = `export default function Counter(){return <button onClick={()=>alert('unchanged')}>Original button</button>}`;
    await writeFile(path.join(root, "src/pages/index.astro"), original);
    await writeFile(path.join(root, "src/components/Counter.tsx"), component);
    await writeFile(path.join(root, "README.md"), "Uncommitted user edits");
    const companion = new RepositoryCompanion();
    const inspection = await companion.inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    expect(inspection.files).toHaveLength(2);
    const field = inspection.fields.find((f) => f.value === "Original button")!;
    const edits = {
      inspection,
      values: { [field.id]: "New button" },
      orders: {},
    };
    const plan = await companion.prepareSource("alpha", edits);
    expect(await readFile(path.join(root, field.file), "utf8")).toBe(component);
    await expect(companion.apply(plan.id, "beta")).rejects.toThrow(
      "another project",
    );
    expect((await companion.apply(plan.id, "alpha")).changed).toBe(1);
    expect(
      await readFile(
        path.join(root, `.kaizen/recovery/${plan.id}/${field.file}`),
        "utf8",
      ),
    ).toBe(component);
    expect(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
    ).toBe(original);
    expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
      "Uncommitted user edits",
    );
    const reopened = await companion.inspectSourcePage(root, inspection.route);
    expect(reopened.fields.some((f) => f.value === "New button")).toBe(true);
    await expect(companion.prepareSource("alpha", edits)).rejects.toThrow(
      "Source changed",
    );
    const second = await companion.prepareSource("alpha", {
      inspection: reopened,
      values: {
        [reopened.fields.find((f) => f.value === "New button")!.id]:
          "Second edit",
      },
      orders: {},
    });
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      original + "\n<!-- developer changed dependency -->",
    );
    await expect(companion.apply(second.id, "alpha")).rejects.toThrow(
      "Changed since review",
    );
    expect(await readFile(path.join(root, field.file), "utf8")).toBe(
      component.replace("Original button", "New button"),
    );
    const latest = await companion.inspectSourcePage(root, inspection.route);
    const ownershipPlan = await companion.prepareSource("alpha", {
      inspection: latest,
      values: {
        [latest.fields.find((f) => f.value === "New button")!.id]:
          "Ownership race",
      },
      orders: {},
    });
    await writeFile(
      path.join(root, ".kaizen/ownership.json"),
      JSON.stringify({ format: "kaizen-ownership", version: 1, files: {} }),
    );
    await expect(companion.apply(ownershipPlan.id, "alpha")).rejects.toThrow(
      "Changed since review: .kaizen/ownership.json",
    );
    expect(await readFile(path.join(root, field.file), "utf8")).toBe(
      component.replace("Original button", "New button"),
    );
  });

  it("keeps import discovery inside application source", () => {
    expect(
      sourceImport("src/pages/index.astro", "../components/Hero.astro"),
    ).toBe("src/components/Hero.astro");
    expect(sourceImport("src/pages/index.astro", "@/Hero")).toBe("client/Hero");
    expect(
      sourceImport("src/pages/index.astro", "../../../private.env"),
    ).toBeUndefined();
    expect(sourceImport("src/pages/index.astro", "node:fs")).toBeUndefined();
  });
});
