import { test, expect, type Page } from "./browser-fixture";
import { accountFixture, accountOwner, accountPerson } from "./account-fixture";
import { siteFixture } from "./site-fixture";
import { firstRunKey } from "../../client/visual-builder/firstRun";
import { newDocument } from "../../client/visual-builder/starters";

const card = (page: Page) =>
  page.getByRole("region", { name: "Start here", exact: true });
const pages = (page: Page) =>
  page.getByRole("button", { name: "Pages", exact: true }).click();
const back = (page: Page) =>
  page.getByRole("button", { name: "Back to pages", exact: true }).click();
const headers = { "X-Kaizen-Builder": "1" };
async function createProject(page: Page, name: string) {
  const response = await page.request.post("/__builder-projects", {
    headers,
    data: { action: "create", name },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test("a new project links each first-run step to real saved work and remembers progress", async ({
  page,
}) => {
  const project = await createProject(page, "First garden website");
  await page.goto(`/builder/?project=${project.id}`);
  await expect(card(page).getByRole("status")).toHaveText("1 of 5 complete");
  await expect(
    card(page).getByRole("button", { name: "Preview it", exact: true }),
  ).toBeDisabled();
  await card(page)
    .getByRole("button", { name: "Name your site", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".builder-project-rename input")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await pages(page);
  await card(page)
    .getByRole("button", { name: "Choose a site design", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Site design", exact: true }),
  ).toBeVisible();
  await pages(page);
  await expect(card(page).locator('[data-step="design"]')).toHaveAttribute(
    "data-complete",
    "false",
  );
  await card(page)
    .getByRole("button", { name: "Choose a site design", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save site draft", exact: true })
    .click();
  await expect(
    page.getByText("Site design saved as a draft.", { exact: true }),
  ).toBeVisible();
  await pages(page);
  await expect(card(page).getByRole("status")).toHaveText("2 of 5 complete");
  await card(page)
    .getByRole("button", { name: "Add a page", exact: true })
    .click();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Garden home");
  await back(page);
  await expect(card(page).getByRole("status")).toHaveText("3 of 5 complete");
  await card(page)
    .getByRole("button", { name: "Preview it", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Page preview", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="Published page preview"]')
      .locator("html[data-kb-preview]"),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await back(page);
  await expect(card(page).getByRole("status")).toHaveText("4 of 5 complete");
  await page.reload();
  await expect(card(page).getByRole("status")).toHaveText("4 of 5 complete");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await card(page).scrollIntoViewIfNeeded();
    const bounds = await card(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/launch-first-run-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await card(page)
    .getByRole("button", { name: "Publish", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Releases", exact: true }),
  ).toBeVisible();
  await pages(page);
  await expect(card(page).locator('[data-step="publish"]')).toHaveAttribute(
    "data-complete",
    "false",
  );
  await page
    .locator(".builder-page-row")
    .filter({ hasText: "Garden home" })
    .click();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page
    .getByLabel("Page title", { exact: true })
    .fill("Changed garden home");
  await back(page);
  await expect(card(page).locator('[data-step="preview"]')).toHaveAttribute(
    "data-complete",
    "false",
  );
  await card(page).getByRole("button", { name: "Dismiss start here" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show start here", exact: true }),
  ).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  const other = await createProject(page, "Other garden website");
  await page.goto(`/builder/?project=${other.id}`);
  await expect(card(page).getByRole("status")).toHaveText("1 of 5 complete");
  await page.goto(`/builder/?project=${project.id}`);
  await page
    .getByRole("button", { name: "Show start here", exact: true })
    .click();
  await expect(card(page).getByRole("status")).toHaveText("3 of 5 complete");
});

test("first-run dismissal follows the signed-in account and project", async ({
  page,
}) => {
  const fixture = await accountFixture(page);
  try {
    // Start from the Pages URL. Changing identity remounts the legal gate and
    // workspace, so the Account fixture's deep link must not choose the screen.
    await page.goto(`/builder/?project=${fixture.project.id}`);
    await expect(card(page)).toBeVisible();
    await card(page)
      .getByRole("button", { name: "Dismiss start here" })
      .click();
    await fixture.switchAccount(accountOwner);
    await expect(card(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show start here", exact: true }),
    ).toHaveCount(0);
    await fixture.switchAccount(accountPerson);
    await expect(
      page.getByRole("button", { name: "Show start here", exact: true }),
    ).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("kaizen-builder-first-run:"),
      ),
    );
    expect(keys.sort()).toEqual(
      [
        firstRunKey(accountOwner, fixture.project.id),
        firstRunKey(accountPerson, fixture.project.id),
      ].sort(),
    );
  } finally {
    await fixture.dispose();
  }
});

test("existing websites and populated projects keep their normal Pages screen", async ({
  page,
}) => {
  await siteFixture(page, "<!doctype html><h1>Existing garden website</h1>");
  await expect(
    page.getByRole("button", { name: "Edit existing /", exact: true }),
  ).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  const project = await createProject(page, "Established garden website");
  const response = await page.request.post(
    `/__builder-local?project=${project.id}`,
    {
      headers,
      data: {
        action: "save",
        id: crypto.randomUUID(),
        version: 0,
        document: newDocument("Already here", "home", true),
      },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.locator(".builder-page-row").filter({ hasText: "Already here" }),
  ).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("blocked preference storage keeps the checklist usable with an honest notice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem,
      set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("kaizen-builder-first-run:"))
        throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("kaizen-builder-first-run:"))
        throw new DOMException("Blocked", "SecurityError");
      return set.call(this, key, value);
    };
  });
  const project = await createProject(page, "Private browser garden");
  await page.goto(`/builder/?project=${project.id}`);
  await expect(card(page)).toBeVisible();
  await expect(
    page.getByText(
      "This browser could not remember your checklist. It will last for this visit only.",
      { exact: true },
    ),
  ).toBeVisible();
  await card(page).getByRole("button", { name: "Dismiss start here" }).click();
  await expect(
    page.getByRole("button", { name: "Show start here", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show start here", exact: true })
    .click();
  await expect(card(page)).toBeVisible();
});
