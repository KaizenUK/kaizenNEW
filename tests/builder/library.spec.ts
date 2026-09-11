import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";
import type { Asset, Workspace } from "../../shared/visualBuilder";

test("import, bulk organise and replace an asset across drafts while the public page keeps its original", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const suffix = crypto.randomUUID().slice(0, 8),
    pack = `Library ${suffix}`,
    destination = `Campaign ${suffix}`,
    slug = `asset-demo-${suffix}`;
  const api = async (data?: unknown): Promise<any> => {
    const response = data
      ? await page.request.post("/__builder-local", {
          headers: { "X-Kaizen-Builder": "1" },
          data,
        })
      : await page.request.get("/__builder-local");
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const importer = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill(pack);
  await page
    .getByRole("button", { name: "Try the sample asset pack", exact: true })
    .click();
  await expect(page.locator(".builder-import-status")).toContainText(
    "0 errors",
  );
  await page
    .getByRole("combobox", { name: "Filter by pack", exact: true })
    .selectOption(pack);
  const imported: Asset[] = (await api()).assets.filter(
    (asset: Asset) => asset.pack === pack,
  );
  expect(imported.length).toBeGreaterThan(5);
  await page
    .getByRole("button", { name: "Select this page", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Bulk tags", exact: true })
    .fill("launch, hero");
  await page
    .getByRole("button", { name: "Apply to selected assets", exact: true })
    .click();
  await expect(page.locator(".builder-toast")).toContainText("assets updated");
  await page
    .getByRole("button", { name: "Select this page", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Bulk asset action", exact: true })
    .selectOption("pack");
  await page
    .getByRole("textbox", { name: "Move assets to pack", exact: true })
    .fill(destination);
  await page
    .getByRole("button", { name: "Apply to selected assets", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Filter by pack", exact: true })
    .selectOption(destination);
  await page
    .getByRole("button", { name: "Select this page", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Bulk asset action", exact: true })
    .selectOption("favourite");
  await page
    .getByRole("button", { name: "Apply to selected assets", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Favourite kaizen-logo.png",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  const source: Asset = (await api()).assets.find(
    (asset: Asset) =>
      asset.pack === destination && asset.name === "kaizen-logo.png",
  );
  expect(source).toMatchObject({
    originalPack: pack,
    tags: ["launch", "hero"],
    favourite: true,
  });
  await page
    .getByRole("button", { name: "Use kaizen-logo.png", exact: true })
    .click();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill(`Asset demonstration ${suffix}`);
  await page.getByRole("textbox", { name: "Page URL", exact: true }).fill(slug);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.locator(".builder-toast")).toContainText(/publish/i);
  const second = newDocument(
    `Second use ${suffix}`,
    `asset-second-${suffix}`,
    false,
  );
  const image = starterBlocks.Image();
  image.props.src = source.url;
  second.data.content = [image];
  await api({
    action: "save",
    id: crypto.randomUUID(),
    version: 0,
    document: second,
  });
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Filter by pack", exact: true })
    .selectOption(destination);
  await page
    .getByRole("button", { name: "Details for kaizen-logo.png", exact: true })
    .click();
  await expect(page.locator(".builder-asset-usage")).toContainText(
    `Second use ${suffix}`,
  );
  await expect(page.locator(".builder-asset-usage")).toContainText(
    "Published snapshot",
  );
  await expect(page.locator(".builder-asset-detail")).toContainText(
    `Original pack: ${pack}`,
  );
  await expect(
    page
      .locator(".builder-asset-detail")
      .getByRole("button", { name: "licences/LICENCE.txt", exact: true }),
  ).toBeVisible();
  // Upload a fresh, immutable image through the real file validation/upload UI.
  const sample = unzipSync(
    await readFile("public/builder-samples/sample-pack.zip"),
  );
  await page.getByLabel("Replacement file", { exact: true }).setInputFiles({
    name: `replacement-${suffix}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(sample["images/kaizen-logo.png"]),
  });
  await expect(
    page.locator(".builder-asset-replacement [role=status]"),
  ).toContainText("Replacement uploaded");
  await page
    .getByRole("button", { name: "Review replacement", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Second use ${suffix}`);
  await expect(dialog).toContainText(`Asset demonstration ${suffix}`);
  await page.screenshot({
    path: "test-results/builder-library-replacement-review.png",
  });
  await dialog
    .getByRole("button", { name: "Replace in drafts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Blank page", exact: true }),
  ).toBeVisible();
  const workspace: Workspace = await api();
  const replacement = workspace.assets.find(
    (asset) => asset.name === `replacement-${suffix}.png`,
  )!;
  expect(replacement.url).not.toBe(source.url);
  const updated = workspace.pages.find((item) => item.draft.slug === slug)!;
  expect(updated.draft.data.content[0].props.src).toBe(replacement.url);
  expect(updated.published!.data.content[0].props.src).toBe(source.url);
  expect(
    workspace.pages.find((item) => item.draft.slug === second.slug)!.draft.data
      .content[0].props.src,
  ).toBe(replacement.url);
  expect(
    updated.revisions.some(
      (item) => item.document.data.content[0]?.props.src === source.url,
    ),
  ).toBe(true);
  const live = await context.newPage();
  await live.goto(`/${slug}/`);
  await expect(live.locator(".kb-page img")).toHaveAttribute("src", source.url);
  await page
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await expect(
    page.frameLocator("#preview-frame").locator(".kb-page img"),
  ).toHaveAttribute("src", replacement.url);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.locator(".builder-toast")).toContainText(/publish/i);
  await live.reload();
  await expect(live.locator(".kb-page img")).toHaveAttribute(
    "src",
    replacement.url,
  );
  expect((await page.request.get(source.url)).ok()).toBeTruthy();
});

test("a 1,000-item library renders one page at a time and supports search and bulk metadata", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pack = `Scale ${crypto.randomUUID().slice(0, 8)}`;
  const file = "test-results/builder-browser-workspace/workspace.json";
  const document = newDocument(
    pack,
    `scale-${crypto.randomUUID().slice(0, 8)}`,
    false,
  );
  expect(
    (
      await page.request.post("/__builder-local", {
        headers: { "X-Kaizen-Builder": "1" },
        data: { action: "save", id: crypto.randomUUID(), version: 0, document },
      })
    ).ok(),
  ).toBeTruthy();
  const workspace: Workspace = JSON.parse(await readFile(file, "utf8"));
  // Metadata-only scale fixture uses a shipped sample URL; this does not claim a 1,000-file upload test.
  const fixtures: Asset[] = Array.from({ length: 1000 }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `Scale image ${String(index).padStart(4, "0")}.svg`,
    path: `images/${index}.svg`,
    pack,
    kind: "icon",
    mime: "image/svg+xml",
    size: 128,
    url: "/builder-samples/landscape.svg",
    hash: "a".repeat(64),
    tags: [],
    favourite: false,
    createdAt: "2026-09-10T00:00:00.000Z",
  }));
  await writeFile(
    file,
    JSON.stringify({
      ...workspace,
      assets: [...workspace.assets, ...fixtures],
    }),
  );
  try {
    await page.goto("/builder/");
    await page
      .getByRole("button")
      .filter({ hasText: `/${document.slug}/` })
      .click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Filter by pack", exact: true })
      .selectOption(pack);
    await page
      .getByRole("combobox", { name: "Sort assets", exact: true })
      .selectOption("name");
    await expect(page.locator(".builder-asset")).toHaveCount(48);
    await expect(
      page.getByRole("navigation", { name: "Asset pages" }),
    ).toContainText("1–48 of 1000");
    await page
      .getByRole("button", { name: "Next assets", exact: true })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Asset pages" }),
    ).toContainText("49–96 of 1000");
    await page
      .getByRole("textbox", { name: "Search assets", exact: true })
      .fill("0999");
    await expect(page.locator(".builder-asset")).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: "Details for Scale image 0999.svg",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Search assets", exact: true })
      .fill("");
    await expect(page.locator(".builder-asset")).toHaveCount(48);
    await page
      .getByRole("button", { name: "Select this page", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Select all 1000 matches", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Bulk tags", exact: true })
      .fill("scale-tested");
    await page
      .getByRole("button", { name: "Apply to selected assets", exact: true })
      .click();
    await expect(page.locator(".builder-toast")).toContainText(
      "1000 assets updated",
    );
    const current: Workspace = await (
      await page.request.get("/__builder-local")
    ).json();
    expect(
      current.assets.filter(
        (asset) => asset.pack === pack && asset.tags.includes("scale-tested"),
      ),
    ).toHaveLength(1000);
    await page.screenshot({
      path: "test-results/builder-library-1000-assets.png",
    });
  } finally {
    await page.close();
    const current: Workspace = JSON.parse(await readFile(file, "utf8"));
    await writeFile(
      file,
      JSON.stringify({
        ...current,
        assets: current.assets.filter((asset) => asset.pack !== pack),
      }),
    );
  }
});
