import { test, expect } from "./browser-fixture";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

test("edits a native Astro and React site, then builds and previews its original interactions", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-native-browser-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await mkdir(path.join(root, "src/components"));
  await mkdir(path.join(root, "src/content"));
  await writeFile(
    path.join(root, "src/content/index.ts"),
    "export {content} from './text';",
  );
  await writeFile(
    path.join(root, "src/content/text.ts"),
    "import cards from './cards.json'; export const content = {copy:'Imported original copy', cards};",
  );
  await writeFile(
    path.join(root, "src/content/cards.json"),
    '[{"title":"Imported original title"}]',
  );
  await mkdir(path.join(root, "public"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { build: "astro build" },
      dependencies: {
        astro: "7.3.2",
        "@astrojs/react": "6.0.5",
        react: "19.2.4",
        "react-dom": "19.2.4",
      },
      pnpm: { overrides: { sharp: "0.35.4" } },
    }),
  );
  await writeFile(
    path.join(root, "astro.config.mjs"),
    "import {defineConfig} from 'astro/config';import react from '@astrojs/react';export default defineConfig({output:'static', integrations:[react()], trailingSlash:'always'});",
  );
  const original = `---
import Counter from '../components/Counter';
import {content} from '../content';
---
<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Native client</title><link rel="icon" href="data:,"/></head><body><main>
<section id="intro"><h1>Original native page</h1><p>Existing design stays editable.</p><p>Repeated copy</p><p>Repeated copy</p><img src="/original.svg" alt="Original picture"/><a href="/contact/">Contact</a></section>
<section id="interaction"><h2>Interactive section</h2><Counter client:load /><p>{content.copy}</p><p>{content.cards[0].title}</p></section>
</main><style>body{margin:0;background:#10252a;color:#fff;font:18px system-ui}main{max-width:960px;margin:auto;padding:24px}section{padding:30px 0}h1{color:#4fe3bd}img{width:160px;display:block}a{color:#4fe3bd}button{padding:12px}@media(max-width:600px){main{padding:16px}h1{font-size:30px}}</style></body></html>`;
  const counter =
    "import {useState} from 'react';export default function Counter(){const [count,setCount]=useState(0);return <button onClick={()=>setCount(count+1)}>Native count: {count}</button>}";
  await writeFile(path.join(root, "src/pages/index.astro"), original);
  await writeFile(
    path.join(root, "src/pages/contact.astro"),
    '<h1>Contact page</h1><a href="/">Home</a>',
  );
  await writeFile(path.join(root, "src/components/Counter.tsx"), counter);
  await writeFile(
    path.join(root, "public/original.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#4fe3bd"/></svg>',
  );
  await writeFile(path.join(root, "README.md"), "Existing uncommitted work\n");
  await promisify(execFile)(
    "pnpm",
    ["install", "--ignore-scripts", "--prefer-offline"],
    {
      cwd: root,
      shell: process.platform === "win32",
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const created = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Native source fixture" },
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  await page.goto(`/builder/?project=${project.id}`);
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await page.getByLabel("Website folder on this computer").fill(root);
  await page.getByRole("button", { name: "Check folder", exact: true }).click();
  const route = page
    .locator(".builder-repository li")
    .filter({ hasText: "src/pages/index.astro" });
  let failDraftRead = true;
  await page.route("**/__builder-local**", async (request) => {
    if (
      failDraftRead &&
      request.request().postDataJSON()?.action ===
        "repository-source-draft-read"
    ) {
      failDraftRead = false;
      await request.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary draft read failure" }),
      });
    } else await request.continue();
  });
  await route.getByRole("button", { name: "Edit text and links" }).click();
  const editor = page.getByRole("region", {
    name: "Existing page content editor",
  });
  await expect(editor.getByRole("alert")).toContainText(
    "Temporary draft read failure",
  );
  await editor.getByRole("button", { name: "Retry loading edits" }).click();
  await editor
    .getByRole("searchbox", { name: "Find page content" })
    .fill("Original native page");
  const heading = editor.getByRole("textbox");
  await expect(heading).toHaveValue("Original native page");
  await heading.fill("Edited original design 🌱");
  await editor.getByRole("searchbox").fill("Native count:");
  await editor.getByRole("textbox").fill("Edited counter:");
  await editor.getByRole("searchbox").fill("Imported original copy");
  await editor.getByRole("textbox").fill("Edited imported copy 🌿");
  await editor.getByRole("searchbox").fill("Imported original title");
  await editor.getByRole("textbox").fill("Edited JSON title 🌿");
  await editor.getByRole("searchbox").fill("");
  await editor.getByText("Reorder sections", { exact: true }).click();
  await editor
    .getByText("index.astro · main sections", { exact: true })
    .click();
  await editor
    .getByRole("button", {
      name: "Move Original native page down",
      exact: true,
    })
    .click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/native-source-editor-${width}.png`,
      fullPage: true,
    });
  }
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Edits saved on this computer");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await page.getByLabel("Website folder on this computer").fill(root);
  await page.getByRole("button", { name: "Check folder", exact: true }).click();
  await route.getByRole("button", { name: "Edit text and links" }).click();
  await editor.getByRole("searchbox").fill("Original native page");
  await expect(editor.getByRole("textbox")).toHaveValue(
    "Edited original design 🌱",
  );
  const recovered = await page.request.post(
    `/__builder-local?project=${project.id}`,
    {
      headers: { "X-Kaizen-Builder": "1" },
      data: {
        action: "repository-source-draft-read",
        root,
        route: "src/pages/index.astro",
      },
    },
  );
  expect(recovered.ok()).toBe(true);
  expect(Object.keys((await recovered.json()).edits.orders)).toHaveLength(1);
  await editor.getByRole("button", { name: "Review my changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Changes to apply" }),
  ).toBeVisible();
  expect(await readFile(path.join(root, "src/pages/index.astro"), "utf8")).toBe(
    original,
  );
  await page
    .getByRole("button", { name: "Apply changes to the folder" })
    .click();
  await expect(
    page.locator(".builder-repository > [role=status]"),
  ).toContainText("Files applied");
  const cleared = await page.request.post(
    `/__builder-local?project=${project.id}`,
    {
      headers: { "X-Kaizen-Builder": "1" },
      data: {
        action: "repository-source-draft-read",
        root,
        route: "src/pages/index.astro",
      },
    },
  );
  expect((await cleared.json()).edits).toBeNull();
  const result = await readFile(
    path.join(root, "src/pages/index.astro"),
    "utf8",
  );
  expect(result).toContain("<Counter client:load />");
  expect(result).toContain(original.slice(original.indexOf("<style>")));
  expect(result.indexOf('id="interaction"')).toBeLessThan(
    result.indexOf('id="intro"'),
  );
  expect(
    await readFile(path.join(root, "src/components/Counter.tsx"), "utf8"),
  ).toBe(counter.replace("Native count:", "Edited counter:"));
  expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
    "Existing uncommitted work\n",
  );
  await page
    .getByRole("button", { name: "Check build command", exact: true })
    .click();
  await page.getByRole("button", { name: "Run build", exact: true }).click();
  await expect(
    page.locator(".builder-repository-build [role=status]"),
  ).toContainText("Build finished", { timeout: 90_000 });
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open website preview" }).click();
  const preview = await popup;
  preview.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await preview.setViewportSize({ width, height: 1000 });
    await expect(
      preview.getByRole("heading", { name: "Edited original design 🌱" }),
    ).toBeVisible();
    await expect(preview.locator("h1")).toHaveCSS("color", "rgb(79, 227, 189)");
    await expect(preview.locator("img")).toHaveJSProperty("naturalWidth", 160);
    await expect(
      preview.getByText("Edited imported copy 🌿", { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByText("Edited JSON title 🌿", { exact: true }),
    ).toBeVisible();
    expect(
      await preview.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await preview.screenshot({
      path: `test-results/native-source-preview-${width}.png`,
      fullPage: true,
    });
  }
  await preview.getByRole("button", { name: "Edited counter: 0" }).click();
  await expect(
    preview.getByRole("button", { name: "Edited counter: 1" }),
  ).toBeVisible();
  await preview.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(
    preview.getByRole("heading", { name: "Contact page" }),
  ).toBeVisible();
  await preview.close();
  await route.getByRole("button", { name: "Edit text and links" }).click();
  const selecting = context.waitForEvent("page");
  await editor
    .getByRole("button", { name: "Pick text from the preview" })
    .click();
  const selectedPreview = await selecting;
  selectedPreview.on("pageerror", (e) => errors.push(e.message));
  await expect(
    editor.getByRole("status", { name: "Rendered source selection" }),
  ).toContainText("ready");
  for (const width of [1440, 390]) {
    await selectedPreview.setViewportSize({ width, height: 1000 });
    await selectedPreview
      .getByRole("heading", { name: "Edited original design 🌱" })
      .click();
    await expect(editor.getByRole("textbox")).toHaveCount(1);
    await expect(editor.getByRole("textbox")).toHaveValue(
      "Edited original design 🌱",
    );
    if (width === 1440) {
      await editor
        .getByRole("textbox")
        .fill("A change selected from the rendered page");
      await expect(
        editor.getByRole("status", { name: "Source editing draft" }),
      ).toContainText("Edits saved on this computer");
      expect(
        await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
      ).toBe(result);
      await editor.getByRole("textbox").fill("Edited original design 🌱");
      await expect(
        editor.getByRole("status", { name: "Source editing draft" }),
      ).toContainText("No changes yet");
    }
    await selectedPreview
      .getByRole("img", { name: "Original picture" })
      .click();
    await expect(editor.getByRole("textbox")).toHaveCount(2);
    await selectedPreview
      .getByText("Repeated copy", { exact: true })
      .first()
      .click();
    await expect(editor.getByRole("textbox")).toHaveCount(2);
    await expect(editor.getByRole("textbox").first()).toHaveValue(
      "Repeated copy",
    );
    await expect(editor.getByRole("textbox").nth(1)).toHaveValue(
      "Repeated copy",
    );
    await expect(
      editor.getByRole("status", { name: "Rendered source selection" }),
    ).toContainText("Choose the intended field");
    expect(
      await selectedPreview.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await selectedPreview.screenshot({
      path: `test-results/native-source-selection-${width}.png`,
      fullPage: true,
    });
  }
  await selectedPreview
    .getByRole("button", { name: "Selection on", exact: true })
    .click();
  await selectedPreview
    .getByRole("button", { name: "Edited counter: 0" })
    .click();
  await expect(
    selectedPreview.getByRole("button", { name: "Edited counter: 1" }),
  ).toBeVisible();
  await selectedPreview.close();
  await editor.getByRole("button", { name: "Show all fields" }).click();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page
    .getByRole("button", { name: "Stop preview", exact: true })
    .click();
  await route.getByRole("button", { name: "Edit text and links" }).click();
  await editor.getByRole("searchbox").fill("Edited original design");
  await expect(editor.getByRole("textbox")).toHaveValue(
    "Edited original design 🌱",
  );
  await editor.getByRole("textbox").fill("Recover this unsaved source change");
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Edits saved on this computer");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await writeFile(
    path.join(root, "src/pages/index.astro"),
    result + "\n<!-- external edit -->",
  );
  await route.getByRole("button", { name: "Edit text and links" }).click();
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("The website's files changed");
  await editor.getByText("Recover saved changes", { exact: true }).click();
  await expect(
    editor.getByText("Recover this unsaved source change", { exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Review my changes" }),
  ).toBeDisabled();
  await editor.getByRole("button", { name: "Discard saved edits" }).click();
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Saved edits discarded");
  expect(await readFile(path.join(root, "src/pages/index.astro"), "utf8")).toBe(
    result + "\n<!-- external edit -->",
  );
  const other = await context.newPage();
  await other.goto(`/builder/?project=${project.id}`);
  await other
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await other.getByLabel("Website folder on this computer").fill(root);
  await other
    .getByRole("button", { name: "Check folder", exact: true })
    .click();
  await other
    .locator(".builder-repository li")
    .filter({ hasText: "src/pages/index.astro" })
    .getByRole("button", { name: "Edit text and links" })
    .click();
  const otherEditor = other.getByRole("region", {
    name: "Existing page content editor",
  });
  await otherEditor.getByRole("searchbox").fill("Edited original design");
  await expect(otherEditor.getByRole("textbox")).toBeEnabled();
  await editor.getByRole("searchbox").fill("Edited original design");
  await editor.getByRole("textbox").fill("First window owns this saved edit");
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Edits saved on this computer");
  await otherEditor
    .getByRole("textbox")
    .fill("Second window must not overwrite it");
  await expect(otherEditor.getByRole("alert")).toContainText(
    "changed in another window",
  );
  const protectedDraft = await page.request.post(
    `/__builder-local?project=${project.id}`,
    {
      headers: { "X-Kaizen-Builder": "1" },
      data: {
        action: "repository-source-draft-read",
        root,
        route: "src/pages/index.astro",
      },
    },
  );
  expect(Object.values((await protectedDraft.json()).edits.values)).toContain(
    "First window owns this saved edit",
  );
  await other.close();
  expect(errors).toEqual([]);
});
