import { test, expect, type Page } from "./browser-fixture";
import { starterStaging } from "./starter-publication-fixture";
import { newDocument } from "../../client/visual-builder/starters";
import { randomUUID } from "node:crypto";

const headers = { "X-Kaizen-Builder": "1" };
async function fixture(page: Page) {
  const response = await page.request.post("/__builder-projects", {
    headers,
    data: { action: "create", name: "Garden studio" },
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.goto(`/builder/?project=${project.id}`);
  return {
    project,
    workspace: async () =>
      (await page.request.get(`/__builder-local?project=${project.id}`)).json(),
  };
}
const start = (page: Page) =>
  page.getByRole("button", { name: "Start with a website", exact: true });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Small business starter", exact: true });
const create = (page: Page) =>
  dialog(page).getByRole("button", {
    name: "Create starter site",
    exact: true,
  });

test("a six-page starter publishes with shared navigation and images to a real staging destination", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const { project, workspace } = await fixture(page);
  await start(page).click();
  await expect(
    dialog(page)
      .getByRole("list", { name: "Starter pages" })
      .getByRole("listitem"),
  ).toHaveCount(6);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await dialog(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await expect
      .poll(() =>
        dialog(page)
          .frameLocator("iframe")
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: `test-results/launch-starter-dialog-${width}.png`,
    });
  }
  expect((await workspace()).pages).toHaveLength(0);
  await create(page).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(async () => (await workspace()).pages.length).toBe(6);
  await expect(start(page)).toHaveCount(0);
  const saved = await workspace();
  expect(saved.pages[0].draft.title).toBe("Home");
  expect(saved.pages.every((item) => item.published === null)).toBe(true);
  expect(
    new Set(saved.pages.map((item) => item.draft.site.headerId)).size,
  ).toBe(1);
  await starterStaging(project.id, async ({ origin, destinationId }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", {
        name: /^Releases(?: \d+ pages with changes to publish)?$/,
      })
      .click();
    await page.getByLabel("Choose destination").selectOption(destinationId);
    await page
      .getByRole("button", {
        name: "Review saved project for publication",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review publication", exact: true }),
    ).toBeVisible();
    const response = page.waitForResponse(
      (response) =>
        response.url().includes("__builder-local") &&
        (response.request().postData() || "").includes(
          '"action":"client-release-start"',
        ),
    );
    await page
      .getByRole("button", { name: "Publish reviewed project", exact: true })
      .click();
    const job = await (await response).json();
    await expect(
      page.locator(`[data-release-id="${job.id}"]`).getByRole("status"),
    ).toHaveText("On staging", { timeout: 60000 });
    const website = await context.newPage();
    const headings = [
      "Make room for something better.",
      "Good work starts with good people.",
      "Practical help for your next step.",
      "Let’s talk about your project.",
      "Find the right fit.",
      "One idea. Your next step.",
    ];
    await website.goto(origin);
    await expect(
      website.getByRole("heading", { name: headings[0], exact: true }),
    ).toBeVisible();
    for (const [index, item] of saved.pages.entries()) {
      await website
        .locator(".kb-menu-desktop")
        .getByRole("link", { name: item.draft.title, exact: true })
        .click();
      await expect(website).toHaveURL(`${origin}/${item.draft.slug}/`);
      await expect(
        website.getByRole("heading", { name: headings[index], exact: true }),
      ).toBeVisible();
      await expect(website.locator(".kb-footer")).toContainText(
        "Garden studio",
      );
    }
    for (const width of [1440, 390]) {
      await website.setViewportSize({ width, height: 1000 });
      await website.goto(origin);
      await expect
        .poll(() =>
          website
            .getByRole("img")
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(
        await website.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await website.screenshot({
        path: `test-results/launch-starter-staging-${width}.png`,
        fullPage: true,
      });
      if (width === 390) {
        await website.locator(".kb-menu-mobile summary").focus();
        await website.keyboard.press("Enter");
        await website
          .locator(".kb-menu-mobile")
          .getByRole("link", { name: "Pricing", exact: true })
          .click();
        await expect(
          website.getByRole("heading", { name: headings[4], exact: true }),
        ).toBeVisible();
      }
    }
    await website.close();
  });
});

test("starter retry creates all pages once after failure or a lost response", async ({
  page,
}) => {
  const { workspace } = await fixture(page);
  let writes = 0;
  await page.route("**/__builder-local?*", async (route) => {
    const input =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : undefined;
    if (input?.action !== "create-starter") return route.continue();
    writes++;
    if (writes === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Starter temporarily unavailable." },
      });
    const response = await route.fetch();
    expect(response.ok(), await response.text()).toBe(true);
    await route.fulfill({
      status: 502,
      json: { error: "Response lost after saving." },
    });
  });
  await start(page).click();
  await create(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Starter temporarily unavailable.",
  );
  expect((await workspace()).pages).toHaveLength(0);
  await create(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect((await workspace()).pages).toHaveLength(6);
  expect(writes).toBe(2);
});

test("a starter refuses to overwrite a page created in another window", async ({
  page,
}) => {
  const { project, workspace } = await fixture(page);
  await start(page).click();
  const response = await page.request.post(
    `/__builder-local?project=${project.id}`,
    {
      headers,
      data: {
        action: "save",
        id: randomUUID(),
        version: 0,
        document: newDocument("Existing work", "existing", false),
      },
    },
  );
  expect(response.ok()).toBe(true);
  const before = await workspace();
  await create(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "already has pages",
  );
  expect(await workspace()).toEqual(before);
  await page
    .getByRole("button", { name: "Close starter", exact: true })
    .click();
  await expect(start(page)).toBeFocused();
});
