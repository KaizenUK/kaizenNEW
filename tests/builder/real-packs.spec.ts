import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Asset, Workspace } from "../../shared/visualBuilder";

// Opt-in only: licensed packs stay outside the repository and CI fixtures.
const downloads = process.env.BUILDER_UI8_DOWNLOADS;
test.skip(
  !downloads,
  "Set BUILDER_UI8_DOWNLOADS to a folder containing the UI8 packs.",
);

async function upload(page: Page, file: string, pack: string) {
  const toggle = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill(pack);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await (await chooser).setFiles(file);
}

test("real UI8 gradient and animated-icon archives import, classify, deduplicate and publish supported media", async ({
  page,
  context,
}) => {
  test.setTimeout(600_000);
  const files = await readdir(downloads!);
  const find = (prefix: string) => {
    const name = files.find(
      (item) =>
        item.startsWith(prefix) &&
        item.endsWith(".zip") &&
        !item.includes(" ("),
    );
    if (!name) throw new Error(`Missing representative archive: ${prefix}`);
    return path.join(downloads!, name);
  };
  const gradientZip = find("hero-gradients-v2_"),
    iconsZip = find("20-logistics-animated-icons_");
  const workspaceFile = "test-results/builder-browser-workspace/workspace.json";
  const previous = await readFile(workspaceFile, "utf8");
  const api = async (): Promise<Workspace> =>
    (await page.request.get("/__builder-local")).json();
  const originals = (workspace: Workspace, pack: string) =>
    workspace.assets.filter(
      (asset) => asset.pack === pack && !asset.generatedFrom,
    );
  const evidence: Record<string, unknown> = {};
  try {
    await writeFile(
      workspaceFile,
      JSON.stringify({ pages: [], assets: [], saved: [] }),
    );
    await page.goto("/builder/");
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await upload(page, gradientZip, "UI8 Cubic Glass");
    await expect(page.locator(".builder-import-status")).toContainText(
      "20 imported · 0 duplicates skipped · 0 errors",
      { timeout: 180_000 },
    );
    const gradients = originals(await api(), "UI8 Cubic Glass");
    expect(gradients).toHaveLength(20);
    expect(
      gradients.every(
        (asset) =>
          asset.kind === "image" &&
          asset.path.startsWith("Cubic Glass Gradient/"),
      ),
    ).toBe(true);
    expect(
      gradients.some(
        (asset) =>
          asset.path.includes("__MACOSX") || asset.name === ".DS_Store",
      ),
    ).toBe(false);
    await upload(page, gradientZip, "UI8 Cubic Glass");
    await expect(page.locator(".builder-import-status")).toContainText(
      "0 imported · 20 duplicates skipped · 0 errors",
      { timeout: 180_000 },
    );
    expect(originals(await api(), "UI8 Cubic Glass")).toHaveLength(20);
    // The same pack was also extracted in Downloads. Exercise the native folder picker.
    await page
      .getByRole("button", { name: "Import assets", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Pack name", exact: true })
      .fill("UI8 Folder Check");
    const folderChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Folder", exact: true }).click();
    await (
      await folderChooser
    ).setFiles(
      path.join(gradientZip.replace(/\.zip$/i, ""), "Cubic Glass Gradient"),
    );
    await expect(page.locator(".builder-import-status")).toContainText(
      "20 imported · 0 duplicates skipped · 0 errors",
      { timeout: 180_000 },
    );
    expect(originals(await api(), "UI8 Folder Check")).toHaveLength(20);
    await page
      .getByRole("combobox", { name: "Filter by pack", exact: true })
      .selectOption("UI8 Cubic Glass");
    await page
      .getByRole("textbox", { name: "Search assets", exact: true })
      .fill("R10.jpg");
    await expect(page.locator(".builder-assets article")).toHaveCount(1);
    const gradient = gradients.find((asset) => asset.name === "R10.jpg")!;
    await expect(page.locator(".builder-assets img").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Use R10.jpg", exact: true })
      .click();
    await page.getByRole("button", { name: "Page", exact: true }).click();
    const slug = `real-ui8-${crypto.randomUUID().slice(0, 8)}`;
    await page
      .getByRole("textbox", { name: "Page URL", exact: true })
      .fill(slug);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish now", exact: true }).click();
    await expect(page.locator(".builder-toast")).toContainText(/publish/i);
    await page.reload();
    await page
      .getByRole("button")
      .filter({ hasText: `/${slug}/` })
      .click();
    const canvas = page.frameLocator("#preview-frame");
    await expect(canvas.locator(".kb-page img")).toHaveAttribute(
      "src",
      gradient.url,
    );
    const live = await context.newPage();
    await live.setViewportSize({ width: 390, height: 844 });
    await live.goto(`/${slug}/`);
    await expect
      .poll(() =>
        live
          .locator(".kb-page img")
          .evaluate((node: HTMLImageElement) => node.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect
      .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
    await live.screenshot({
      path: "test-results/builder-real-ui8-mobile.png",
      fullPage: true,
    });
    await live.close();
    evidence.gradients = {
      originalFiles: gradients.length,
      duplicatesSkipped: 20,
      extractedFolderFiles: 20,
      publishedAndReopened: true,
      mobileWidth: 390,
      images: gradients.map(({ name, size, image }) => ({ name, size, image })),
    };

    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await upload(page, iconsZip, "UI8 Logistics Icons");
    await expect(page.locator(".builder-import-status")).toContainText(
      "361 imported · 0 duplicates skipped · 0 errors",
      { timeout: 300_000 },
    );
    const icons = originals(await api(), "UI8 Logistics Icons");
    expect(icons).toHaveLength(361);
    const counts = icons.reduce<Record<string, number>>(
      (result, asset) => ({
        ...result,
        [asset.kind]: (result[asset.kind] || 0) + 1,
      }),
      {},
    );
    expect(counts).toEqual({ image: 40, icon: 40, code: 200, other: 81 });
    const source = icons.find((asset) => asset.name.endsWith(".js"))!;
    const download = await page.request.get(source.url);
    expect(download.headers()["content-disposition"]).toContain("attachment");
    const svg = icons.find((asset) => asset.kind === "icon")!;
    const clean = await (await page.request.get(svg.url)).text();
    expect(clean).toMatch(/fill="(?:#D5E04E|rgb\(213, 224, 78\))"/i);
    expect(clean).toContain('stroke-width="5"');
    expect(clean).not.toMatch(
      /<script\b|<animate\b|<foreignObject\b|\sonload\s*=/i,
    );
    await page
      .getByRole("combobox", { name: "Filter by pack", exact: true })
      .selectOption("UI8 Logistics Icons");
    await expect(
      page.getByRole("navigation", { name: "Asset pages", exact: true }),
    ).toContainText("of 361");
    await page
      .getByRole("textbox", { name: "Search assets", exact: true })
      .fill("clipboard");
    await expect(page.locator(".builder-assets")).toContainText(
      "Developer review required",
    );
    await expect(page.locator(".builder-assets")).toContainText(
      "Stored · download only",
    );
    await page.screenshot({
      path: "test-results/builder-real-ui8-library.png",
    });
    evidence.icons = {
      originalFiles: icons.length,
      classifications: counts,
      sourceServedAsDownload: true,
      svgSanitised: true,
    };
    await writeFile(
      "test-results/builder-real-ui8-evidence.json",
      JSON.stringify(evidence, null, 2),
    );
  } finally {
    await writeFile(workspaceFile, previous);
  }
});
