import { test, expect, type Page } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { rm } from "node:fs/promises";

const back = (page: Page) =>
  page.getByRole("button", { name: "Back to pages", exact: true });
async function newProject(page: Page) {
  const result = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Feature loading fixture" },
  });
  expect(result.ok()).toBe(true);
  const project = await result.json();
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.getByRole("button", { name: "Blank page", exact: true }),
  ).toBeEnabled();
  return project;
}
async function screenshots(page: Page, state: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: `test-results/launch-feature-${state}-${test.info().project.name}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test("the page editor downloads on demand, allows Back during loading, and saves after opening", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/PageEditor.tsx*", async (route) => {
    await pending;
    await route.continue();
  });
  try {
    const project = await newProject(page);
    expect(
      requests.filter((url) =>
        /\/(PageEditor|SitePageEditor|AssetLibrary)\.tsx$/.test(url),
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Opening the page editor…",
    );
    await screenshots(page, "loading");
    await back(page).click();
    const row = page
      .locator(".builder-page-row")
      .filter({ hasText: "Untitled page" });
    await expect(row).toBeVisible();
    release();
    await row.click();
    await expect(
      page.frameLocator("#preview-frame").locator("body"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page
      .getByLabel("Page title", { exact: true })
      .fill("Saved after loading");
    await back(page).click();
    await expect(page.locator(".builder-page-row")).toContainText(
      "Saved after loading",
    );
    const saved = await (
      await page.request.get(`/__builder-local?project=${project.id}`)
    ).json();
    expect(saved.pages).toHaveLength(1);
    expect(saved.pages[0].draft.title).toBe("Saved after loading");
    await page.reload();
    await page.locator(".builder-page-row").click();
    await expect(
      page.frameLocator("#preview-frame").locator("body"),
    ).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("a failed editor download preserves the saved page and offers a working reload", async ({
  page,
}) => {
  const project = await newProject(page);
  await page.route("**/PageEditor.tsx*", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not open the page editor",
  );
  await screenshots(page, "unavailable");
  const before = await (
    await page.request.get(`/__builder-local?project=${project.id}`)
  ).json();
  await back(page).click();
  await expect(page.locator(".builder-page-row")).toContainText(
    "Untitled page",
  );
  const after = await (
    await page.request.get(`/__builder-local?project=${project.id}`)
  ).json();
  expect(after).toEqual(before);
  await page.unroute("**/PageEditor.tsx*");
  await page.locator(".builder-page-row").click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not open the page editor",
  );
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.locator(".builder-page-row")).toContainText(
    "Untitled page",
  );
  await page.locator(".builder-page-row").click();
  await expect(
    page.frameLocator("#preview-frame").locator("body"),
  ).toBeVisible();
});

test("the website editor downloads only when an existing page opens and can be left during loading", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  const fixture = await siteFixture(
    page,
    "<!doctype html><html><head><title>Garden</title></head><body><h1>Garden fixture</h1></body></html>",
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/SitePageEditor.tsx*", async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.reload();
    const open = page.getByRole("button", {
      name: "Edit existing /",
      exact: true,
    });
    await expect(open).toBeVisible();
    expect(
      requests.filter((url) => /\/SitePageEditor\.tsx$/.test(url)),
    ).toEqual([]);
    await open.click();
    await expect(page.getByRole("status")).toHaveText(
      "Opening the website editor…",
    );
    await back(page).click();
    await expect(open).toBeVisible();
    release();
    await open.click();
    await expect(
      page.getByRole("button", { name: "Build", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await expect(
      page
        .frameLocator('iframe[title="Website canvas"]')
        .getByRole("heading", { name: "Garden fixture" }),
    ).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await rm(fixture.root, { recursive: true, force: true });
  }
});
