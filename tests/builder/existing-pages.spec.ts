import { expect, test } from "./browser-fixture";

test("the dashboard distinguishes existing site layouts, CMS content and redirects from editable builder pages", async ({
  page,
}) => {
  await page.goto("/builder/");
  await page
    .getByRole("button", { name: "Existing site pages", exact: true })
    .click();
  const inventory = page.locator(".builder-existing-pages");
  await expect(page.locator(".builder-head-description")).toContainText(
    "Find pages from the original website",
  );
  await page
    .getByRole("button", {
      name: "Learn more about Existing site pages",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "CMS-managed content remains with its CMS",
  );
  await page.getByRole("button", { name: "Close help", exact: true }).click();
  await inventory
    .getByRole("searchbox", { name: "Find an existing page" })
    .fill("/about/");
  await expect(inventory.locator("li")).toHaveCount(1);
  await expect(inventory.locator("li")).toContainText("Site page");
  await expect(
    inventory.getByRole("link", { name: "Open existing /about/", exact: true }),
  ).toHaveAttribute("href", "/about/");
  await expect(
    inventory.getByRole("button", {
      name: "Edit existing /about/",
      exact: true,
    }),
  ).toHaveCount(1);
  await inventory
    .getByRole("searchbox", { name: "Find an existing page" })
    .fill("/blog/");
  await expect(inventory.locator("li")).toHaveCount(1);
  await expect(inventory.locator("li")).toContainText("CMS content");
  await expect(
    page.getByRole("link", { name: "Open site CMS ↗", exact: true }),
  ).toHaveAttribute("href", /^https:\/\/kaizenweb\.co\.uk\/studio/);
  await inventory
    .getByRole("searchbox", { name: "Find an existing page" })
    .fill("/insights/");
  await expect(inventory).toContainText("No pages match");
  await inventory
    .getByRole("checkbox", { name: "Include site redirects" })
    .check();
  await expect(inventory.locator("li")).toHaveCount(1);
  await expect(inventory.locator("li")).toContainText("Site redirect");
  await expect(inventory.locator("li")).toContainText("/insights/ → /blog/");
  await inventory
    .getByRole("searchbox", { name: "Find an existing page" })
    .fill("");
  await inventory.scrollIntoViewIfNeeded();
  await inventory.screenshot({
    path: "test-results/builder-existing-pages.png",
  });
  await inventory
    .getByRole("searchbox", { name: "Find an existing page" })
    .fill("/about/");
  await inventory
    .getByRole("button", { name: "Edit existing /about/", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Existing page content editor",
  });
  await expect(editor).toContainText("src/pages/about.astro");
  await editor
    .getByRole("searchbox", { name: "Find page content" })
    .fill("One person. The whole way.");
  await expect(editor.getByRole("textbox")).toHaveValue(
    "One person. The whole way.",
  );
  // Inspection only: the test must never apply a proposal to Kaizen's own source.
  await expect(
    editor.getByRole("button", { name: "Review my changes" }),
  ).toBeDisabled();
});
