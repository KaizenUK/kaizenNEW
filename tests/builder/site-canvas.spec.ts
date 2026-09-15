import { test, expect } from "./browser-fixture";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openSiteProject } from "./hosted-repository-fixture";
test.use({ actionTimeout: 10000 });

test("M1/M2: website Pages → on-page editing → review → apply → rebuilt canvas", async ({
  page,
}) => {
  test.setTimeout(180000);
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-site-canvas-"));
  try {
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    const original =
      '<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Garden studio</title><style>body{font:18px system-ui;margin:0;color:#163a32;background:#f2f8f0}main{padding:60px}section{padding:30px}h1{font-size:42px}a{display:block;color:#2546aa}</style></head><body><main><section><h1>Original garden heading</h1><p>Make room for growing.</p><a href="/first/">Learn more</a><a href="/second/">Learn more</a></section><section><h2>Visit our garden</h2><p>Open every weekend.</p></section></main></body></html>';
    await writeFile(path.join(root, "src/pages/index.astro"), original);
    await writeFile(
      path.join(root, "README.md"),
      "Keep unrelated work exactly.\n",
    );
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
      "import{mkdir,readFile,writeFile}from'node:fs/promises';await mkdir('dist');await writeFile('dist/index.html',await readFile('src/pages/index.astro'));",
    );
    const created = await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Garden canvas fixture" },
    });
    expect(created.ok()).toBe(true);
    const project = await created.json();
    await openSiteProject(page, project, root);
    await page.reload();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Build a preview to edit on the page",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    const heading = frame.getByRole("heading", {
      name: "Original garden heading",
    });
    await expect(heading).toBeVisible();
    await heading.dblclick();
    await expect(heading).toHaveAttribute("contenteditable", "plaintext-only");
    await heading.fill("A garden for everyone");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
      "Original garden heading",
    );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
      "A garden for everyone",
    );
    await frame.getByRole("link", { name: "Learn more" }).nth(1).click();
    await expect(
      page.getByLabel(/src\/pages\/index.astro .*href line/),
    ).toHaveValue("/second/");
    await page
      .getByLabel(/src\/pages\/index.astro .*href line/)
      .fill("/new-address/");
    await expect(
      frame.getByRole("link", { name: "Learn more" }).nth(1),
    ).toHaveAttribute("href", /\/new-address\/$/);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `test-results/site-canvas-before-${test.info().project.name}-${width}.png`,
      });
      if (width === 390) {
        await page
          .getByRole("button", { name: "Mobile preview", exact: true })
          .click();
        await page
          .getByRole("navigation", { name: "Editor panels" })
          .getByRole("button", { name: "Page", exact: true })
          .click();
      }
      await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
        "A garden for everyone",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/site-canvas-${test.info().project.name}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const previousFrame = await page
      .locator('iframe[title="Website canvas"]')
      .getAttribute("src");
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "src/pages/index.astro",
    );
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect
      .poll(() => readFile(path.join(root, "src/pages/index.astro"), "utf8"))
      .toBe(
        original
          .replace("Original garden heading", "A garden for everyone")
          .replace("/second/", "/new-address/"),
      );
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await expect(
      page.locator('iframe[title="Website canvas"]'),
    ).not.toHaveAttribute("src", previousFrame!);
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText(
      "A garden for everyone",
    );
    expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
      "Keep unrelated work exactly.\n",
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("M0: the supported local builder embeds a cookie-free real helper snapshot", async ({
  browserName,
}) => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const result = await promisify(execFile)(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "docs/handover/experiments/source-frame-host-check.mjs",
    ],
    {
      cwd: process.cwd(),
      timeout: 45000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, FRAME_BROWSER: browserName },
    },
  );
  expect(result.stdout).toContain("bidirectional nonce handshake; no cookies");
});
