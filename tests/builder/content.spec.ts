import { expect, test, type Page } from "./browser-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { contentFixture } from "./content-fixture";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

async function dragToBlank(page: Page, name: string) {
  const source = page.getByRole("button", { name, exact: true });
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox(),
    to = await page
      .frameLocator("#preview-frame")
      .locator("[data-puck-dropzone]")
      .first()
      .boundingBox();
  await page.mouse.move(from!.x + 10, from!.y + 10);
  await page.mouse.down();
  await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 3 });
  await page.mouse.move(
    to!.x + to!.width / 2,
    to!.y + Math.min(50, to!.height / 2),
    { steps: 12 },
  );
  await page.mouse.up();
}
test("Sanity listings and field bindings stay editable while deployments refresh published content", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const suffix = crypto.randomUUID().slice(0, 8),
    slug = `journal-${suffix}`;
  const sourceFile = "test-results/builder-cms-source.json";
  await context.route(
    "https://cdn.sanity.io/images/builder-fixture/**",
    async (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: await readFile("public/builder-samples/landscape.svg"),
      }),
  );
  try {
    await page.goto("/builder/");
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await dragToBlank(page, "Post listing");
    const canvas = page.frameLocator("#preview-frame");
    await expect(canvas.locator(".kb-content-card")).toHaveCount(3);
    await canvas.locator("[data-puck-component]").first().click();
    await page
      .getByRole("textbox", { name: "Listing heading", exact: true })
      .fill("From the journal");
    await page
      .getByRole("combobox", { name: "Post category", exact: true })
      .selectOption("design");
    await page
      .getByRole("combobox", { name: "Post order", exact: true })
      .selectOption({ label: "Title A–Z" });
    await page
      .getByRole("spinbutton", { name: "Number of posts", exact: true })
      .fill("2");
    await page
      .getByRole("spinbutton", { name: "desktop Columns", exact: true })
      .fill("2");
    await expect(canvas.locator(".kb-content-card")).toHaveCount(2);
    await expect(canvas.locator(".kb-content-card h3").first()).toHaveText(
      "A thoughtful first impression",
    );
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Card style", exact: true })
      .selectOption({ label: "Editorial list" });
    await expect(canvas.locator(".kb-content-card").first()).toHaveCSS(
      "display",
      "block",
    );
    await page
      .getByRole("combobox", { name: "Card style", exact: true })
      .selectOption({ label: "Cards" });
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Page title", exact: true })
      .fill(`Journal ${suffix}`);
    await page
      .getByRole("textbox", { name: "Page URL", exact: true })
      .fill(slug);
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button")
      .filter({ hasText: `/${slug}/` })
      .click();
    await expect(canvas.locator(".kb-content-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const preview = page.frameLocator('iframe[title="Published page preview"]');
    await expect(preview.locator(".kb-content-card")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Return to editor", exact: true })
      .click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish now", exact: true }).click();
    await expect(page.locator(".builder-toast")).toContainText(/publish/i);
    const live = await context.newPage();
    await live.setViewportSize({ width: 390, height: 844 });
    await live.goto(`/${slug}/`);
    await expect(live.locator(".kb-content-card")).toHaveCount(2);
    await expect(live.locator(".kb-content-card h3").first()).toHaveText(
      "A thoughtful first impression",
    );
    await expect(live.locator(".kb-content-card h3 a").first()).toHaveAttribute(
      "href",
      "/blog/thoughtful-first-impression/",
    );
    await expect
      .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
    await live.screenshot({
      path: "test-results/builder-content-mobile.png",
      fullPage: true,
    });
    await canvas.locator("[data-puck-component]").first().click();
    await page
      .getByRole("textbox", { name: "Listing heading", exact: true })
      .fill("A draft heading — keep private");
    const changed = structuredClone(contentFixture);
    changed.posts[0].title = "A fresh published title";
    await writeFile(sourceFile, JSON.stringify(changed));
    await page
      .getByRole("button", { name: "Refresh Sanity content", exact: true })
      .click();
    await expect(canvas.locator(".kb-content-card h3").first()).toHaveText(
      "A fresh published title",
    );
    // Simulate another deployment trigger without publishing this page's draft layout.
    const trigger = newDocument(
      "CMS deployment trigger",
      `cms-trigger-${suffix}`,
      false,
    );
    const saved = await (
      await page.request.post("/__builder-local", {
        headers: { "X-Kaizen-Builder": "1" },
        data: {
          action: "save",
          id: crypto.randomUUID(),
          version: 0,
          document: trigger,
        },
      })
    ).json();
    expect(
      (
        await page.request.post("/__builder-local", {
          headers: { "X-Kaizen-Builder": "1" },
          data: { action: "publish", id: saved.id, version: saved.version },
        })
      ).ok(),
    ).toBeTruthy();
    await live.reload();
    await expect(live.locator(".kb-content-card h3").first()).toHaveText(
      "A fresh published title",
    );
    await expect(
      live.getByRole("heading", { name: "From the journal", exact: true }),
    ).toBeVisible();
    await expect(live.getByText("A draft heading — keep private")).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    const fields = newDocument("Linked fields", `cms-fields-${suffix}`, false);
    fields.data.content = [
      starterBlocks.Text(),
      starterBlocks.Image(),
      starterBlocks.Button(),
    ];
    await page.request.post("/__builder-local", {
      headers: { "X-Kaizen-Builder": "1" },
      data: {
        action: "save",
        id: crypto.randomUUID(),
        version: 0,
        document: fields,
      },
    });
    await page.reload();
    await page
      .getByRole("button")
      .filter({ hasText: `/${fields.slug}/` })
      .click();
    for (let i = 0; i < 3; i++) {
      await canvas
        .locator(`[data-puck-component="${fields.data.content[i].props.id}"]`)
        .click();
      await page
        .getByRole("button", { name: "Connect to Sanity", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Linked post", exact: true })
        .selectOption("design-one");
    }
    await expect(canvas.locator(".kb-text")).toHaveText(
      "A fresh published title",
    );
    await expect(canvas.locator(".kb-image img")).toHaveAttribute(
      "src",
      /cdn.sanity.io/,
    );
    await expect(canvas.locator(".kb-button a")).toHaveAttribute(
      "href",
      "/blog/thoughtful-first-impression/",
    );
    await canvas
      .locator(`[data-puck-component="${fields.data.content[0].props.id}"]`)
      .click();
    await page
      .getByRole("combobox", { name: "Content field", exact: true })
      .selectOption("excerpt");
    await expect(canvas.locator(".kb-text")).toHaveText(
      contentFixture.posts[0].excerpt,
    );
    await page
      .getByRole("button", { name: "Use manual content", exact: true })
      .click();
    await expect(canvas.locator(".kb-text")).toHaveText(
      String(fields.data.content[0].props.text),
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(canvas.locator(".kb-text")).toHaveText(
      contentFixture.posts[0].excerpt,
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button")
      .filter({ hasText: `/${fields.slug}/` })
      .click();
    await expect(canvas.locator(".kb-text")).toHaveText(
      contentFixture.posts[0].excerpt,
    );
  } finally {
    await writeFile(sourceFile, JSON.stringify(contentFixture));
  }
});
