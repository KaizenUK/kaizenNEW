import { expect, test, type Page } from "./browser-fixture";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

test("interactive blocks work in preview and publication, including keyboard navigation", async ({
  page,
  context,
  browser,
}) => {
  const document = newDocument(
    "Interactive demonstration",
    `interactive-${crypto.randomUUID().slice(0, 8)}`,
    false,
  );
  document.data.content = [
    starterBlocks.Menu(),
    starterBlocks.Tabs(),
    starterBlocks.Accordion(),
    starterBlocks.Tabs(),
    starterBlocks.Video(),
  ];
  const response = await page.request.post("/__builder-local", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "save", id: crypto.randomUUID(), version: 0, document },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/builder/");
  await page
    .getByRole("button")
    .filter({ hasText: `/${document.slug}/` })
    .click();
  const canvas = page.frameLocator("#preview-frame");
  await canvas
    .locator(`[data-puck-component="${document.data.content[0].props.id}"]`)
    .click();
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Studio North");
  await expect(canvas.locator(".kb-menu-brand")).toHaveText("Studio North");
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Published page preview"]');
  await expect(
    preview.getByRole("tab", { name: "Discover", exact: true }),
  ).toHaveCount(2);
  await preview
    .getByRole("tab", { name: "Design", exact: true })
    .first()
    .click();
  await expect(preview.getByRole("tabpanel").first()).toContainText(
    "Thoughtful layouts",
  );
  await expect(
    preview.getByRole("tab", { name: "Discover", exact: true }).last(),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.locator(".builder-toast")).toContainText(/publish/i);
  const live = await context.newPage();
  await live.setViewportSize({ width: 390, height: 844 });
  await live.goto(`/${document.slug}/`);
  const tabs = live.locator("[data-kb-tabs]").first();
  const discover = tabs.getByRole("tab", { name: "Discover", exact: true });
  await discover.focus();
  await live.keyboard.press("ArrowRight");
  await expect(
    tabs.getByRole("tab", { name: "Design", exact: true }),
  ).toBeFocused();
  await expect(tabs.getByRole("tabpanel")).toContainText("Thoughtful layouts");
  await live.keyboard.press("End");
  await expect(
    tabs.getByRole("tab", { name: "Deliver", exact: true }),
  ).toBeFocused();
  await live.keyboard.press("Home");
  await expect(discover).toBeFocused();
  await live.keyboard.press("ArrowLeft");
  await expect(
    tabs.getByRole("tab", { name: "Deliver", exact: true }),
  ).toBeFocused();
  await live.locator(".kb-menu-mobile summary").click();
  await expect(live.locator(".kb-menu-mobile")).toHaveAttribute("open", "");
  await live.locator(".kb-menu-mobile a").first().focus();
  await live.keyboard.press("Escape");
  await expect(live.locator(".kb-menu-mobile")).not.toHaveAttribute("open");
  await expect(live.locator(".kb-menu-mobile summary")).toBeFocused();
  const question = live.locator(".kb-accordion summary").first();
  await question.focus();
  await live.keyboard.press("Enter");
  await expect(live.locator(".kb-accordion details").first()).toHaveAttribute(
    "open",
    "",
  );
  await live.locator("video").evaluate(async (video) => {
    await video.play();
  });
  await expect
    .poll(() => live.locator("video").evaluate((video) => video.currentTime))
    .toBeGreaterThan(0);
  // Native caption preferences may leave a default track disabled (WebKit).
  // Select captions before verifying that the published VTT loads and has cues.
  await live.locator("video").evaluate((video) => {
    video.textTracks[0].mode = "showing";
  });
  await expect
    .poll(() =>
      live.locator("video track").evaluate((track) => track.readyState),
    )
    .toBe(2);
  expect(
    await live
      .locator("video")
      .evaluate((video) => video.textTracks[0].cues?.length),
  ).toBeGreaterThan(0);
  await expect
    .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await live.screenshot({
    path: "test-results/builder-interactive-mobile.png",
    fullPage: true,
  });
  const fallback = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await fallback.newPage();
  await staticPage.goto(live.url());
  await expect(staticPage.locator(".kb-tab-panel")).toHaveCount(6);
  for (const panel of await staticPage.locator(".kb-tab-panel").all())
    await expect(panel).toBeVisible();
  await fallback.close();
});

async function createPage(page: Page) {
  await page.goto("/builder/");
  await page
    .getByRole("button", { name: "Browse templates", exact: true })
    .click();
  await page
    .getByRole("article", { name: "Home template", exact: true })
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await expect(page.locator("#preview-frame")).toBeVisible();
  return page.frameLocator("#preview-frame");
}
async function selectHero(page: Page) {
  await page
    .frameLocator("#preview-frame")
    .getByRole("heading", {
      name: "Make room for something better.",
      exact: true,
    })
    .click();
  await page
    .getByRole("navigation", { name: "Selected component path" })
    .getByRole("button", { name: "Hero", exact: true })
    .click();
}

test("responsive styles survive autosave, reopening, preview and local publication", async ({
  page,
  context,
}) => {
  const frame = await createPage(page);
  await selectHero(page);
  await page
    .getByRole("spinbutton", { name: "desktop padding left", exact: true })
    .fill("100");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-left", "100px");
  await page
    .getByRole("textbox", { name: "desktop Column proportions", exact: true })
    .fill("2 1");
  await page
    .getByRole("button", { name: "Tablet preview", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "tablet All padding", exact: true })
    .fill("32");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-left", "32px");
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "mobile All padding", exact: true })
    .fill("20");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-left", "20px");
  await page
    .getByRole("spinbutton", { name: "mobile margin left", exact: true })
    .fill("12");
  await page
    .getByRole("spinbutton", { name: "mobile margin right", exact: true })
    .fill("12");
  await page
    .getByRole("spinbutton", { name: "mobile padding bottom", exact: true })
    .fill("57");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "57px");
  await page
    .getByRole("button", { name: "Reset mobile padding bottom", exact: true })
    .click();
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "20px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "57px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "20px");
  await page.keyboard.press("Control+z");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "57px");
  await page.keyboard.press("Control+Shift+z");
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-bottom", "20px");
  await expect(page.locator(".builder-save-status")).toContainText("Saved", {
    timeout: 20_000,
  });
  const slug = (
    await page.locator(".builder-canvas-toolbar .builder-hint").innerText()
  ).trim();
  await page.reload();
  await page.getByRole("button").filter({ hasText: slug }).click();
  await selectHero(page);
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-left", "20px");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Published page preview"]')
      .locator(".kb-hero"),
  ).toHaveCSS("padding-bottom", "20px");
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.locator(".builder-toast")).toContainText(/publish/i);
  const live = await context.newPage();
  await live.setViewportSize({ width: 390, height: 844 });
  await live.goto(slug);
  await expect(live.locator(".kb-hero")).toHaveCSS("padding-left", "20px");
  await expect(live.locator(".kb-hero")).toHaveCSS("padding-bottom", "20px");
  await expect(live.locator(".kb-hero")).toHaveCSS(
    "grid-template-columns",
    "326px",
  );
  await expect
    .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await live.screenshot({
    path: "test-results/builder-mobile-published.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Revisions", exact: true }).click();
  await page
    .locator(".builder-revision")
    .filter({ hasText: "Created Home from a template" })
    .getByRole("button", { name: "Restore as draft" })
    .click();
  await expect(frame.locator(".kb-hero")).toHaveCSS("padding-left", "48px");
  await expect(page.locator(".builder-save-status")).toContainText("Saved");
  await live.setViewportSize({ width: 1280, height: 900 });
  await live.reload();
  await expect(live.locator(".kb-hero")).toHaveCSS("padding-left", "100px");
});

test("image crop, focal point and hover styles render in the page preview", async ({
  page,
}) => {
  const frame = await createPage(page);
  await frame
    .getByRole("img", { name: "Abstract green hills and a yellow sun" })
    .click();
  await page.getByText("Image crop & focal point", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "desktop Image ratio", exact: true })
    .selectOption("1 / 1");
  await page
    .getByRole("combobox", { name: "desktop Image fit", exact: true })
    .selectOption("contain");
  await page
    .getByRole("slider", { name: "desktop focalX", exact: true })
    .fill("75");
  await page
    .getByRole("slider", { name: "desktop focalY", exact: true })
    .fill("25");
  await expect(frame.locator(".kb-image img")).toHaveCSS(
    "object-position",
    "75% 25%",
  );
  await expect(frame.locator(".kb-image img")).toHaveCSS(
    "aspect-ratio",
    "1 / 1",
  );
  await expect(frame.locator(".kb-image img")).toHaveCSS(
    "object-fit",
    "contain",
  );
  await page.getByText("Hover & focus", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "desktop Hover background", exact: true })
    .fill("#112233");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const image = page
    .frameLocator('iframe[title="Published page preview"]')
    .locator(".kb-image");
  await image.hover();
  await expect(image).toHaveCSS("background-color", "rgb(17, 34, 51)");
});

test("sample ZIP assets drag into nested content and support copy, paste and undo", async ({
  page,
}) => {
  const frame = await createPage(page);
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const importer = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  const packName = `Nested drag ${crypto.randomUUID().slice(0, 8)}`;
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill(packName);
  await page
    .getByRole("button", { name: "Try the sample asset pack", exact: true })
    .click();
  await expect(page.locator(".builder-import-status"))
    .toContainText(/imported|skipped/i, { timeout: 45_000 })
    .catch(async (error) => {
      throw new Error(
        `${error.message}\nImport detail: ${await page.locator(".builder-error").allTextContents()}`,
      );
    });
  await page
    .getByRole("combobox", { name: "Filter by pack", exact: true })
    .selectOption(packName);
  await page
    .getByRole("textbox", { name: "Search assets", exact: true })
    .fill("spark.svg");
  const source = page.locator(
    '.builder-assets [data-testid^="drawer-item:AssetIcon_"]',
  );
  // The search filter is applied in a deferred render; wait for it to settle on one icon.
  await expect(source).toHaveCount(1);
  await source.scrollIntoViewIfNeeded();
  const heading = frame.getByRole("heading", {
    name: "Make room for something better.",
    exact: true,
  });
  await heading.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  const finish = await heading.boundingBox();
  expect(start).toBeTruthy();
  expect(finish).toBeTruthy();
  await page.mouse.move(
    start!.x + start!.width / 2,
    start!.y + start!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    start!.x + start!.width / 2 + 10,
    start!.y + start!.height / 2 + 10,
    { steps: 3 },
  );
  await page.mouse.move(finish!.x + 15, finish!.y + finish!.height + 6, {
    steps: 12,
  });
  // Puck debounces entry into a nested drop zone. Release over its visible
  // insertion target, after the browser has rendered the drag feedback.
  await expect(
    frame
      .locator(
        ".kb-hero .kb-container [data-puck-line-placeholder], .kb-hero .kb-container [data-dnd-placeholder]",
      )
      .first(),
  ).toBeVisible();
  await page.mouse.up();
  const nestedIcons = frame.locator(".kb-hero .kb-container .kb-icon");
  await expect(nestedIcons).toHaveCount(1);
  await nestedIcons.locator("img").click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(nestedIcons).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(nestedIcons).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(nestedIcons).toHaveCount(2);
  await nestedIcons.first().click();
  await page.keyboard.press("Control+d");
  await expect(nestedIcons).toHaveCount(3);
  await expect
    .poll(() =>
      nestedIcons
        .locator("img")
        .evaluateAll((images: HTMLImageElement[]) =>
          images.every(
            (image) =>
              image.complete &&
              image.naturalWidth > 0 &&
              image.getBoundingClientRect().height > 0,
          ),
        ),
    )
    .toBe(true);
  const lastId = await nestedIcons.last().getAttribute("data-block-id");
  await nestedIcons.last().scrollIntoViewIfNeeded();
  await nestedIcons.first().scrollIntoViewIfNeeded();
  await expect(nestedIcons.first()).toBeInViewport({ ratio: 1 });
  await expect(nestedIcons.last()).toBeInViewport({ ratio: 1 });
  const from = await nestedIcons.last().boundingBox();
  const to = await nestedIcons.first().boundingBox();
  const x = from!.x + from!.width / 2,
    y = from!.y + from!.height / 2;
  const targetX = to!.x + to!.width / 2,
    targetY = to!.y + to!.height / 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y + 8, { steps: 3 });
  await expect(frame.locator("[data-dnd-dragging]").first()).toBeVisible();
  await page.mouse.move(targetX, targetY, { steps: 16 });
  // The sortable placeholder can stay in its original slot until release.
  // Wait for the actual dragged image to reach the pointer instead.
  await expect
    .poll(async () => {
      const box = await frame
        .locator("[data-dnd-dragging] .kb-icon")
        .first()
        .boundingBox();
      return box ? Math.abs(box.y + box.height / 2 - targetY) : Infinity;
    })
    .toBeLessThan(4);
  await page.mouse.up();
  // Count the committed blocks after the temporary drag clone disappears.
  await expect(nestedIcons).toHaveCount(3);
  await expect(nestedIcons.first()).toHaveAttribute("data-block-id", lastId!);
});

test("rich text supports inline formatting and links in preview", async ({
  page,
}) => {
  const markupErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /nested <form>|descendant of <form>/.test(message.text())
    )
      markupErrors.push(message.text());
  });
  const frame = await createPage(page);
  const source = page.getByRole("button", { name: "Rich text", exact: true });
  const heading = frame.getByRole("heading", {
    name: "Make room for something better.",
    exact: true,
  });
  await source.scrollIntoViewIfNeeded();
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeInViewport({ ratio: 1 });
  const from = await source.boundingBox();
  const to = await heading.boundingBox();
  await page.mouse.move(from!.x + 10, from!.y + 10);
  await page.mouse.down();
  await page.mouse.move(from!.x + 20, from!.y + 15, { steps: 3 });
  await page.mouse.move(to!.x + 10, to!.y + to!.height + 8, { steps: 12 });
  await expect(
    frame
      .locator(
        ".kb-hero .kb-container [data-puck-line-placeholder], .kb-hero .kb-container [data-dnd-placeholder]",
      )
      .first(),
  ).toBeVisible();
  await page.mouse.up();
  await expect(frame.locator(".kb-richtext")).toHaveCount(1);
  await frame.locator(".kb-richtext").click();
  const editor = frame.locator('.kb-richtext [contenteditable="true"]');
  await editor.fill("Our next chapter");
  await editor.press("Control+a");
  await editor.press("Control+b");
  await expect(frame.locator(".kb-richtext strong")).toHaveText(
    "Our next chapter",
  );
  const sidebarEditor = page.locator('.builder-right [contenteditable="true"]');
  await sidebarEditor.click();
  await sidebarEditor.press("Control+End");
  await sidebarEditor.press("Control+Shift+ArrowLeft");
  await page
    .getByRole("button", { name: "Add or edit link", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Link address", exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(page.locator('.builder-rich-link [role="alert"]')).toContainText(
    "Use a website URL",
  );
  await page
    .getByRole("textbox", { name: "Link address", exact: true })
    .fill("/contact/");
  await page
    .getByRole("textbox", { name: "Link address", exact: true })
    .press("Enter");
  await expect(frame.locator(".kb-richtext a")).toHaveAttribute(
    "href",
    "/contact/",
  );
  await expect(frame.locator(".kb-richtext a")).toHaveText("chapter");
  await expect(page.locator(".builder-save-status")).toContainText("Saved");
  const slug = (
    await page.locator(".builder-canvas-toolbar .builder-hint").innerText()
  ).trim();
  await page.reload();
  await page.getByRole("button").filter({ hasText: slug }).click();
  await expect(frame.locator(".kb-richtext a")).toHaveText("chapter");
  await page.screenshot({ path: "test-results/builder-rich-text-editor.png" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Published page preview"]')
      .locator(".kb-richtext strong"),
  ).toHaveText(["Our next ", "chapter"]);
  await expect(
    page
      .frameLocator('iframe[title="Published page preview"]')
      .locator(".kb-richtext a"),
  ).toHaveAttribute("href", "/contact/");
  expect(markupErrors).toEqual([]);
});
