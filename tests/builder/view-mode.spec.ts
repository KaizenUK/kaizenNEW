import { test, expect, type Page } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Locator } from "@playwright/test";

const source =
  "<html><head><title>A garden website</title></head><body><main><h1>A garden to enjoy</h1><p>Keep these words</p></main></body></html>";
const account = "22222222-2222-4222-8222-222222222222";
const settings = (page: Page) =>
  page.getByRole("button", { name: "Settings", exact: true }).click();
const pages = (page: Page) =>
  page.getByRole("button", { name: "Pages", exact: true }).click();
const openEditor = (page: Page) =>
  page.getByRole("button", { name: "Edit existing /", exact: true }).click();
const back = (page: Page) =>
  page.getByRole("button", { name: "Back to pages", exact: true }).click();

async function capture(page: Page, name: string, focus?: Locator) {
  await focus?.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/launch-${name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await focus?.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: `test-results/launch-${name}-phone.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test("an owner can use both views on Pages and the real website editor, with the choice remembered", async ({
  page,
}) => {
  const fixture = await siteFixture(page, source, true);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Pages from the website's code",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Managed in code", { exact: true }),
    ).toBeVisible();
    await settings(page);
    await expect(
      page.getByRole("checkbox", { name: "Show developer details" }),
    ).toBeChecked();
    await capture(
      page,
      "view-owner",
      page.getByRole("region", { name: "Your view" }),
    );
    await pages(page);
    await openEditor(page);
    await expect(
      page
        .locator(".builder-site-build code")
        .filter({ hasText: "node build.mjs" }),
    ).toBeVisible();
    await back(page);
    await settings(page);
    await page
      .getByRole("checkbox", { name: "Show developer details" })
      .uncheck();
    await expect(page.getByRole("region", { name: "Your view" })).toContainText(
      "Client view",
    );
    await pages(page);
    await expect(
      page.getByRole("heading", { name: "Website pages", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Managed in code", { exact: true }),
    ).toHaveCount(0);
    await capture(
      page,
      "view-client-pages",
      page.getByRole("region", { name: "Website pages" }),
    );
    await openEditor(page);
    await expect(
      page.getByText(
        "Build the website preview so you can edit on the page. Your website stays unchanged.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.locator(".builder-site-build code")).toHaveCount(0);
    await capture(page, "view-client-build");
    await page.getByRole("button", { name: "Build", exact: true }).click();
    const title = page
      .frameLocator('iframe[title="Website canvas"]')
      .getByRole("heading", { level: 1 });
    await expect(title).toHaveText("A garden to enjoy");
    await title.dblclick();
    await title.fill("A garden edited in client view");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Website pages", exact: true }),
    ).toBeVisible();
    await openEditor(page);
    await expect(title).toHaveText("A garden edited in client view");
    await back(page);
    await settings(page);
    await expect(
      page.getByRole("checkbox", { name: "Show developer details" }),
    ).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "Show developer details" })
      .check();
    await pages(page);
    await expect(
      page.getByRole("heading", {
        name: "Pages from the website's code",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await readFile(path.join(fixture.root, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

for (const canPublish of [false, true]) {
  test(`an editor uses client view with canPublish=${canPublish}, and a failed preview remains actionable`, async ({
    page,
  }) => {
    const fixture = await siteFixture(page, source, true);
    try {
      await page.route("**/__fixture-projects", async (route) => {
        if (route.request().postDataJSON().action !== "list") {
          await route.fallback();
          return;
        }
        const result = await page.request.get("/__builder-projects");
        const projects = await result.json();
        await route.fulfill({
          json: projects
            .filter((item: any) => item.id === fixture.project.id)
            .map((item: any) => ({
              ...item,
              access: { role: "editor", canPublish },
            })),
        });
      });
      // A preference left by an earlier owner session cannot upgrade an editor.
      await page.evaluate(
        ({ account, project }) =>
          localStorage.setItem(
            `kaizen-builder-view:${account}:${project}`,
            "developer",
          ),
        { account, project: fixture.project.id },
      );
      await writeFile(
        path.join(fixture.root, "build.mjs"),
        "console.error('Fixture build needs attention');process.exit(1)",
      );
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Website pages", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".builder-project-identity")).toContainText(
        canPublish ? "Editor · can publish" : "Editor · cannot publish",
      );
      await settings(page);
      await expect(
        page.getByRole("region", { name: "Your view" }),
      ).toContainText("Client view");
      await expect(
        page.getByRole("checkbox", { name: "Show developer details" }),
      ).toHaveCount(0);
      await pages(page);
      await openEditor(page);
      await expect(
        page.getByRole("button", { name: "Build", exact: true }),
      ).toBeEnabled();
      await expect(page.locator(".builder-site-build code")).toHaveCount(0);
      await page.getByRole("button", { name: "Build", exact: true }).click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "The preview could not be built" }),
      ).toContainText("Your edits are kept");
      await expect(
        page.getByRole("button", { name: "Try building again" }),
      ).toBeEnabled();
      await expect(page.getByText("Build log", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("Fixture build needs attention", { exact: false }),
      ).toHaveCount(0);
      if (!canPublish) await capture(page, "view-client-build-error");
      expect(
        await readFile(
          path.join(fixture.root, "src/pages/index.astro"),
          "utf8",
        ),
      ).toBe(source);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
}
