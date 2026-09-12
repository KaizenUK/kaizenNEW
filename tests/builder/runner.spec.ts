import { test, expect } from "./browser-fixture";
import { BUILDER_TEST_PORT } from "./ports";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Unity reviews a local build, reopens its status and previews the result", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-unity-runner-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
      scripts: { build: "node build.mjs" },
    }),
  );
  await writeFile(
    path.join(root, "build.mjs"),
    `import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist/contact',{recursive:true}); await writeFile('dist/index.html','<!doctype html><html><head><title>Local client</title><link rel="icon" href="data:,"></head><body><h1>Built through Unity</h1><a href="/contact/">Contact</a></body></html>'); await writeFile('dist/contact/index.html','<h1>Client contact</h1><a href="/">Home</a>');`,
  );
  const headers = { "X-Kaizen-Builder": "1" };
  const created = await page.request.post("/__builder-projects", {
    headers,
    data: { action: "create", name: "Build controls client" },
  });
  const project = await created.json();
  // pnpm dev commonly uses localhost; the preview binds 127.0.0.1. Verify the
  // initial cross-site navigation can establish its read-only preview cookie.
  await page.goto(
    `http://localhost:${BUILDER_TEST_PORT}/builder/?project=${project.id}`,
  );
  async function inspect() {
    await page
      .getByRole("button", { name: "Export & handoff", exact: true })
      .click();
    await page.getByLabel("Website folder on this computer").fill(root);
    await page
      .getByRole("button", { name: "Check folder", exact: true })
      .click();
  }
  await inspect();
  await page
    .getByRole("button", { name: "Check build command", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Build command" }),
  ).toBeVisible();
  await expect(readFile(path.join(root, "dist/index.html"))).rejects.toThrow();
  await page.getByRole("button", { name: "Run build", exact: true }).click();
  await expect(
    page.locator(".builder-repository-build [role=status]"),
  ).toContainText("Build finished");
  await page.reload();
  await inspect();
  await expect(
    page.locator(".builder-repository-build [role=status]"),
  ).toContainText("Build finished");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/repository-build-${width}.png`,
      fullPage: true,
    });
  }
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open website preview" }).click();
  const preview = await popupPromise;
  await expect(
    preview.getByRole("heading", { name: "Built through Unity" }),
  ).toBeVisible();
  await preview.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(
    preview.getByRole("heading", { name: "Client contact" }),
  ).toBeVisible();
  await preview.close();
  await page
    .getByRole("button", { name: "Stop local preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open website preview" }),
  ).toHaveCount(0);
});
