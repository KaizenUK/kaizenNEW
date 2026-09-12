import { test, expect } from "./browser-fixture";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { openSiteProject } from "./hosted-repository-fixture";
import {
  hostedHelperFixture,
  helperToken,
  helperOwner,
} from "./hosted-helper-fixture";

test("a hosted project inspects, saves and applies original source through the real hosted service", async ({
  page,
}) => {
  const response = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Hosted service fixture" },
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  const helper = await hostedHelperFixture([project.id]);
  const root = helper.folders.root(project.id);
  try {
    await openSiteProject(page, project, root, true, {
      origin: helper.helper.origin,
      accessToken: helperToken(),
    });
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Find page content" })
      .fill("Hosted original");
    await page
      .locator(".builder-site-field")
      .filter({ hasText: "Hosted original" })
      .click();
    const input = page.locator(".builder-site-field-editor textarea");
    await input.fill("Saved through the hosted service");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved",
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390)
        await page
          .getByRole("navigation", { name: "Editor panels" })
          .getByRole("button", { name: "Selected", exact: true })
          .click();
      await expect(input).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/hosted-helper-service-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Saved through the hosted service",
    );
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect
      .poll(() => readFile(path.join(root, "src/pages/index.astro"), "utf8"))
      .toContain("Saved through the hosted service");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await helper.git(helper.remote, ["show", "stage:src/pages/index.astro"]),
    ).toContain("Hosted original");
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Find page content" })
      .fill("Saved through the hosted service");
    await expect(
      page
        .locator(".builder-site-field")
        .filter({ hasText: "Saved through the hosted service" }),
    ).toBeVisible();
    await page
      .locator(".builder-site-field")
      .filter({ hasText: "Saved through the hosted service" })
      .click();
    await expect(
      page.locator(".builder-site-field-editor textarea"),
    ).toBeEnabled();
    helper.members.get(project.id)!.delete(helperOwner);
    await page
      .locator(".builder-site-field-editor textarea")
      .fill("Keep my local recovery");
    await expect(
      page.getByRole("alert").filter({ hasText: "Project access ended" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review my changes", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Download my unapplied edits" }),
    ).toBeVisible();
  } finally {
    try {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await page.context().unrouteAll({ behavior: "wait" });
      }
    } finally {
      await helper.close();
    }
  }
});
