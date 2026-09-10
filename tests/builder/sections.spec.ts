import { expect, test } from "@playwright/test";
import { sectionPresets } from "../../client/visual-builder/sectionPresets";

test("section designs preview on mobile, insert as editable content and survive undo, redo and reopen", async ({
  page,
}) => {
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await page.getByRole("button", { name: "Browse section designs" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Section designs",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mobile", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Section design preview"]');
  for (const preset of sectionPresets) {
    await dialog
      .getByRole("navigation", { name: "Section designs" })
      .getByRole("button")
      .filter({ hasText: preset.name })
      .click();
    await expect(
      dialog.getByRole("button", { name: `Add ${preset.name}`, exact: true }),
    ).toBeVisible();
    await expect(preview.locator(".kb-page > .kb-block")).toHaveCount(1);
    await expect
      .poll(() => preview.locator("body").evaluate((body) => body.scrollWidth))
      .toBe(390);
  }
  await dialog
    .getByRole("navigation", { name: "Section designs" })
    .getByRole("button")
    .filter({ hasText: "Editorial hero" })
    .click();
  await expect(preview.getByRole("heading", { level: 1 })).toContainText(
    "Good things",
  );
  await page.screenshot({
    path: "test-results/builder-section-designs-mobile.png",
  });
  await dialog
    .getByRole("button", { name: "Add Editorial hero", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const canvas = page.frameLocator("#preview-frame");
  await expect(canvas.getByRole("heading", { level: 1 })).toContainText(
    "Good things",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(canvas.getByRole("heading", { level: 1 })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(canvas.getByRole("heading", { level: 1 })).toContainText(
    "Good things",
  );
  await page.getByRole("button", { name: "Page", exact: true }).click();
  const slug = `section-design-${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole("textbox", { name: "Page URL", exact: true }).fill(slug);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".builder-save-status")).toContainText(/saved/i);
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await expect(canvas.getByRole("heading", { level: 1 })).toContainText(
    "Good things",
  );
});
