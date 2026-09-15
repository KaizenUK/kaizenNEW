import { test, expect, type Page } from "./browser-fixture";
import { pageTemplates } from "../../client/visual-builder/starters";

const headers = { "X-Kaizen-Builder": "1" };
async function projectFixture(page: Page) {
  const response = await page.request.post("/__builder-projects", {
    headers,
    data: { action: "create", name: "Garden studio" },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const project = await response.json();
  await page.goto(`/builder/?project=${project.id}`);
  return {
    project,
    workspace: async () =>
      (await page.request.get(`/__builder-local?project=${project.id}`)).json(),
  };
}
const browse = (page: Page) =>
  page.getByRole("button", { name: "Browse templates", exact: true });
const gallery = (page: Page) =>
  page.getByRole("dialog", { name: "Page templates", exact: true });
const choice = (page: Page, name: string) =>
  page.getByRole("article", { name: `${name} template`, exact: true });
const back = (page: Page) =>
  page.getByRole("button", { name: "Back to pages", exact: true }).click();

test("bundled illustrations load in template thumbnails and full previews", async ({
  page,
}) => {
  await projectFixture(page);
  await browse(page).click();
  const thumbnail = choice(page, "Home").frameLocator("iframe").locator("img");
  await expect
    .poll(
      () =>
        thumbnail.evaluate((element: HTMLImageElement) => element.naturalWidth),
      { message: "The Home thumbnail illustration must load" },
    )
    .toBeGreaterThan(0);
  await choice(page, "Home")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const preview = page
    .getByRole("dialog", { name: "Preview · Home", exact: true })
    .frameLocator("iframe")
    .locator("img");
  await expect
    .poll(
      () =>
        preview.evaluate((element: HTMLImageElement) => element.naturalWidth),
      { message: "The full Home illustration must load" },
    )
    .toBeGreaterThan(0);
});

test("six templates have real thumbnails and responsive previews, then create separate editable pages", async ({
  page,
}) => {
  const fixture = await projectFixture(page);
  await browse(page).click();
  await expect(gallery(page).getByRole("article")).toHaveCount(6);
  const headings = [
    "Make room for something better.",
    "Good work starts with good people.",
    "Practical help for your next step.",
    "Let’s talk about your project.",
    "Find the right fit.",
    "One idea. Your next step.",
  ];
  for (const [index, template] of pageTemplates.entries()) {
    const card = choice(page, template.name);
    await card.scrollIntoViewIfNeeded();
    await expect(
      card.frameLocator("iframe").locator("html[data-kb-preview]"),
    ).toHaveCount(1);
    await card.getByRole("button", { name: "Preview", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: `Preview · ${template.name}`,
      exact: true,
    });
    const frame = dialog.frameLocator(
      `iframe[title="${template.name} template preview"]`,
    );
    await expect(
      frame.getByRole("heading", { name: headings[index], exact: true }),
    ).toBeVisible();
    for (const width of ["Phone", "Desktop"]) {
      await dialog.getByRole("button", { name: width, exact: true }).click();
      await expect
        .poll(() =>
          frame
            .locator("html")
            .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        )
        .toBe(true);
    }
    expect((await fixture.workspace()).pages).toHaveLength(0);
    await dialog
      .getByRole("button", { name: "All templates", exact: true })
      .click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await gallery(page).evaluate((element) => {
      element.scrollTop = 0;
    });
    const bounds = await gallery(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(
      await gallery(page).evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        choice(page, "Home")
          .frameLocator("iframe")
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: `test-results/launch-templates-gallery-${test.info().project.name}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await choice(page, "Contact")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Preview · Contact",
    exact: true,
  });
  for (const [label, width] of [
    ["Desktop", 1440],
    ["Phone", 390],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await preview.getByRole("button", { name: label, exact: true }).click();
    await preview.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results/launch-templates-preview-${test.info().project.name}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preview
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(page.locator("#preview-frame")).toBeVisible();
  await expect(
    page
      .frameLocator("#preview-frame")
      .getByRole("heading", { name: headings[3], exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Our contact page");
  await back(page);
  const first = (await fixture.workspace()).pages[0];
  expect(first.draft.title).toBe("Our contact page");
  expect(first.draft.slug).toBe("contact");
  expect(first.published).toBeNull();
  await browse(page).click();
  await choice(page, "Contact")
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(page.locator("#preview-frame")).toBeVisible();
  await back(page);
  const after = await fixture.workspace();
  expect(after.pages).toHaveLength(2);
  expect(after.pages.find((item) => item.id === first.id)).toEqual(first);
  expect(after.pages.find((item) => item.id !== first.id).draft.slug).toBe(
    "contact-2",
  );
});

test("a failed template save keeps the choice and retries the same page without overwriting work", async ({
  page,
}) => {
  const fixture = await projectFixture(page);
  const attempts: string[] = [];
  await page.route("**/__builder-local?*", async (route) => {
    const input =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : undefined;
    if (input?.action !== "save") return route.continue();
    attempts.push(input.id);
    if (attempts.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Template save is temporarily unavailable." },
      });
    await route.continue();
  });
  await browse(page).click();
  await choice(page, "About")
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Preview · About",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Template save is temporarily unavailable.",
  );
  expect((await fixture.workspace()).pages).toHaveLength(0);
  await expect(
    dialog.frameLocator("iframe").getByRole("heading", {
      name: "Good work starts with good people.",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(page.locator("#preview-frame")).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toBe(attempts[1]);
  expect((await fixture.workspace()).pages).toHaveLength(1);
});

test("a lost creation response recovers the already saved template once", async ({
  page,
}) => {
  const fixture = await projectFixture(page);
  let writes = 0;
  await page.route("**/__builder-local?*", async (route) => {
    const input =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : undefined;
    if (input?.action !== "save") return route.continue();
    writes++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.fulfill({
      status: 502,
      json: { error: "Response lost after saving." },
    });
  });
  await browse(page).click();
  await choice(page, "Pricing")
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(page.locator("#preview-frame")).toBeVisible();
  expect(writes).toBe(1);
  const workspace = await fixture.workspace();
  expect(workspace.pages).toHaveLength(1);
  expect(workspace.pages[0].draft.title).toBe("Pricing");
});

test("the gallery follows the dark theme, keeps keyboard focus and closes without creating a page", async ({
  page,
}) => {
  const fixture = await projectFixture(page);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await browse(page).focus();
  await page.keyboard.press("Enter");
  await expect(gallery(page)).toHaveAttribute("data-theme", "dark");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await gallery(page).evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect
      .poll(() =>
        choice(page, "Home")
          .frameLocator("iframe")
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: `test-results/launch-templates-dark-${test.info().project.name}-${width}.png`,
    });
  }
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press("Tab");
    expect(
      await gallery(page).evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(gallery(page)).toHaveCount(0);
  await expect(browse(page)).toBeFocused();
  expect((await fixture.workspace()).pages).toHaveLength(0);
});
