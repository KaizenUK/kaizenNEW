import { test, expect } from "./browser-fixture";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("Unity restores an independent native repository and its unapplied source draft into another project", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const parent = await mkdtemp(
    path.join(tmpdir(), "kaizen-native-backup-browser-"),
  );
  const root = path.join(parent, "original"),
    target = path.join(parent, "restored");
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await mkdir(path.join(root, "src/components"));
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
    "import {defineConfig} from 'astro/config';import react from '@astrojs/react';export default defineConfig({output:'static',integrations:[react()]});",
  );
  const original = `---\nimport Counter from '../components/Counter';\n---\n<html lang="en"><head><title>Native restoration</title><meta name="viewport" content="width=device-width"/><link rel="icon" href="data:,"/></head><body><main><h1>Native backup headline</h1><img src="/logo.svg" alt="Restored logo"/><Counter client:load /></main><style>body{font:18px system-ui;background:#10252a;color:white;margin:0}main{padding:24px;max-width:800px;margin:auto}h1{color:#4fe3bd}img{width:160px;display:block}button{padding:12px}</style></body></html>`;
  await writeFile(path.join(root, "src/pages/index.astro"), original);
  await writeFile(
    path.join(root, "src/components/Counter.tsx"),
    "import {useState} from 'react';export default function Counter(){const[n,setN]=useState(0);return <button onClick={()=>setN(n+1)}>Restored count: {n}</button>}",
  );
  await writeFile(
    path.join(root, "public/logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#4fe3bd"/></svg>',
  );
  await writeFile(
    path.join(root, ".env"),
    "PRIVATE_EXAMPLE=fake-browser-test-secret\n",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function create(name: string) {
    const response = await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  }
  const alpha = await create("Native original"),
    beta = await create("Native restored");
  await page.goto(`/builder/?project=${alpha.id}`);
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await page.getByLabel("Website folder on this computer").fill(root);
  await page.getByRole("button", { name: "Check folder", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text and links", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Existing page content editor",
  });
  await editor.getByRole("searchbox").fill("Native backup headline");
  await editor.getByRole("textbox").fill("Recovered pending headline 🌿");
  await expect(
    editor.getByRole("status", { name: "Source editing draft" }),
  ).toContainText("Edits saved on this computer");
  await editor.getByRole("button", { name: "Close editor" }).click();
  const backup = page.getByRole("region", { name: "Native repository backup" });
  await backup
    .getByRole("button", {
      name: "Prepare folder backup",
      exact: true,
    })
    .click();
  await expect(backup).toContainText("1 unapplied edits");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await backup.screenshot({
      path: `test-results/native-backup-review-${width}.png`,
    });
  }
  const download = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Download folder backup" }).click();
  const file = path.join(parent, "native-backup.zip");
  await (await download).saveAs(file);
  await page.reload();
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await expect(page.getByLabel("Website folder on this computer")).toHaveValue(
    root,
  );
  await page.goto(`/builder/?project=${beta.id}`);
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await expect(page.getByLabel("Website folder on this computer")).toHaveValue(
    "",
  );
  await backup.getByLabel("Backup ZIP file").setInputFiles(file);
  await backup.getByLabel("New folder to restore into").fill(target);
  await backup.getByRole("button", { name: "Check backup file" }).click();
  await expect(backup).toContainText("1 unapplied edits");
  await backup.getByRole("button", { name: "Restore into new folder" }).click();
  await expect(backup.getByRole("status")).toContainText("Restored");
  await expect(page.getByLabel("Website folder on this computer")).toHaveValue(
    target,
  );
  await page.getByRole("button", { name: "Check folder", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit text and links", exact: true })
    .click();
  await editor.getByRole("searchbox").fill("Native backup headline");
  await expect(editor.getByRole("textbox")).toHaveValue(
    "Recovered pending headline 🌿",
  );
  await editor.getByRole("button", { name: "Review my changes" }).click();
  await page
    .getByRole("button", { name: "Apply changes to the folder" })
    .click();
  await expect(
    page.locator(".builder-repository > [role=status]"),
  ).toContainText("Files applied");
  expect(await readFile(path.join(root, "src/pages/index.astro"), "utf8")).toBe(
    original,
  );
  expect(
    await readFile(path.join(target, "src/pages/index.astro"), "utf8"),
  ).toContain("Recovered pending headline 🌿");
  await promisify(execFile)(
    "pnpm",
    ["install", "--ignore-scripts", "--prefer-offline"],
    {
      cwd: target,
      shell: process.platform === "win32",
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  await page
    .getByRole("button", { name: "Check build command", exact: true })
    .click();
  await page.getByRole("button", { name: "Run build", exact: true }).click();
  await expect(
    page.locator(".builder-repository-build [role=status]"),
  ).toContainText("Build finished", { timeout: 90000 });
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open website preview" }).click();
  const preview = await opened;
  preview.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await preview.setViewportSize({ width, height: 1000 });
    await expect(
      preview.getByRole("heading", { name: "Recovered pending headline 🌿" }),
    ).toBeVisible();
    await expect(
      preview.getByRole("img", { name: "Restored logo" }),
    ).toHaveJSProperty("naturalWidth", 160);
    expect(
      await preview.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await preview.screenshot({
      path: `test-results/native-restored-preview-${width}.png`,
      fullPage: true,
    });
  }
  await preview.getByRole("button", { name: "Restored count: 0" }).click();
  await expect(
    preview.getByRole("button", { name: "Restored count: 1" }),
  ).toBeVisible();
  await preview.close();
  await page
    .getByRole("button", { name: "Stop local preview", exact: true })
    .click();
  expect(errors).toEqual([]);
});
