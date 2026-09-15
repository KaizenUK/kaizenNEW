// Run with pnpm test:builder:runner and independently installed Astro/export fixture paths.
import { chromium, expect } from "@playwright/test";
import { RepositoryRunner } from "../../scripts/builder-runner";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const runner = new RepositoryRunner();
// Retain this isolated test profile in the OS temp directory. Windows can hold
// Chromium profile files after exit; automatic profile removal can hang teardown.
const browser = await chromium.launchPersistentContext(
  await mkdtemp(path.join(tmpdir(), "kaizen-runner-browser-")),
  process.platform === "win32"
    ? { channel: "msedge", headless: true }
    : { headless: true },
);
try {
  if (process.argv.length < 3)
    throw new Error("Pass independent fixture repository paths.");
  for (const [index, root] of process.argv.slice(2).entries()) {
    const projectId = `fixture-${index}`;
    const plan = await runner.prepare(root, projectId);
    console.log(`Running reviewed ${plan.command} in ${root}`);
    let job = await runner.start(plan.id, projectId);
    while (job.status === "building") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      job = runner.status(job.id, projectId);
    }
    expect(job.status, `${job.error}\n${job.log}`).toBe("succeeded");
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(job.previewUrl!);
    const origin = new URL(page.url()).origin;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect((await page.goto(`${origin}/about/`))?.ok()).toBe(true);
      await expect(
        page.getByText("Independent client about", { exact: true }),
      ).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://client.example/about/",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390) {
        await page.locator(".kb-menu-mobile summary").focus();
        await page.keyboard.press("Enter");
      }
      await page.screenshot({
        path: `test-results/runner-client-${index}-${width}.png`,
        fullPage: true,
      });
      await page
        .locator(width === 390 ? ".kb-menu-mobile" : ".kb-menu-desktop")
        .getByRole("link", { name: "Contact", exact: true })
        .click();
      await expect(
        page.getByText("Independent client contact", { exact: true }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
    await page.close();
    await runner.cancel(job.id, projectId);
    console.log(`Verified actual build and private HTTP preview: ${root}`);
  }
} finally {
  console.log("Closing local runner");
  await runner.close();
  console.log("Closing verification browser");
  await browser.close();
  console.log("Local runner verification complete.");
}
