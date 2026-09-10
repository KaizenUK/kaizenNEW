import { expect, test, type Page } from "@playwright/test";

test("three pages share styles and components while overrides, detach and live isolation remain reliable", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID().slice(0, 6);
  const header = `Header ${suffix}`,
    footer = `Footer ${suffix}`,
    section = `Section ${suffix}`;
  await page.goto("/builder/");
  if (
    !(await (await page.request.get("/__builder-local")).json()).assets.some(
      (asset) => asset.kind === "font",
    )
  ) {
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("button", { name: "Try the sample asset pack", exact: true })
      .click();
    await expect(page.locator(".builder-import-status")).toContainText(
      /imported|skipped/i,
      { timeout: 45_000 },
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Site design", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Token spacing section", exact: true })
    .fill("64");
  const assets = (await (await page.request.get("/__builder-local")).json())
    .assets;
  const font = assets.find((asset) => asset.kind === "font");
  expect(font).toBeTruthy();
  if (font)
    await page
      .getByRole("combobox", { name: "Uploaded site font", exact: true })
      .selectOption(font.url);
  async function createComponent(name: string, kind: string) {
    await page
      .getByRole("textbox", { name: "Shared component name", exact: true })
      .fill(name);
    await page
      .getByRole("combobox", { name: "Shared component kind", exact: true })
      .selectOption(kind);
    await page
      .getByRole("button", { name: "Create shared component", exact: true })
      .click();
    await expect(page.locator("#preview-frame")).toBeVisible();
  }
  await createComponent(header, "header");
  await page
    .frameLocator("#preview-frame")
    .locator("[data-puck-component]")
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Brand name", exact: true })
    .fill("Studio North");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await createComponent(footer, "footer");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await createComponent(section, "section");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  const initial = await (await page.request.get("/__builder-local")).json();
  const definition = initial.site.draft.components.find(
    (item) => item.name === section,
  );
  const headingId = definition.blocks[0].props.children[0].props.id;
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  const slugs: string[] = [];
  for (let index = 0; index < 3; index++) {
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    const frame = page.frameLocator("#preview-frame");
    const source = page.getByRole("button", { name: section, exact: true });
    await source.scrollIntoViewIfNeeded();
    const from = await source.boundingBox();
    const to = await frame
      .locator("[data-puck-dropzone]")
      .first()
      .boundingBox();
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    await page.mouse.move(from!.x + 12, from!.y + 12);
    await page.mouse.down();
    await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 3 });
    await page.mouse.move(
      to!.x + to!.width / 2,
      to!.y + Math.min(50, to!.height / 2),
      { steps: 12 },
    );
    await page.mouse.up();
    await expect(frame.locator(".kb-calltoaction")).toHaveCount(1);
    await frame.locator("[data-puck-component]").first().click();
    if (index === 1) {
      await page
        .getByText("Text · Your next chapter starts here.", { exact: true })
        .click();
      await page
        .locator(`[data-instance-node="${headingId}"]`)
        .getByRole("textbox", { name: "Text", exact: true })
        .fill("Only on this page");
    }
    await page.getByRole("button", { name: "Page", exact: true }).click();
    const slug = `shared-site-${suffix}-${index}`;
    slugs.push(slug);
    await page
      .getByRole("textbox", { name: "Page title", exact: true })
      .fill(`Studio ${index + 1} ${suffix}`);
    await page
      .getByRole("textbox", { name: "Page URL", exact: true })
      .fill(slug);
    await page
      .getByRole("checkbox", { name: "Use site styles", exact: true })
      .check();
    await page
      .getByRole("combobox", { name: "Shared header", exact: true })
      .selectOption({ label: header });
    await page
      .getByRole("combobox", { name: "Shared footer", exact: true })
      .selectOption({ label: footer });
    await expect(frame.locator(".kb-menu-brand")).toHaveText("Studio North");
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await page
      .getByRole("combobox", { name: "desktop All padding token", exact: true })
      .selectOption("section");
    if (index === 0)
      await page
        .getByRole("combobox", {
          name: "desktop All margin token",
          exact: true,
        })
        .selectOption("small");
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    await page
      .getByRole("spinbutton", { name: "mobile All padding", exact: true })
      .fill("20");
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
  }
  async function publishDesign() {
    await page
      .getByRole("button", { name: "Review site publication", exact: true })
      .click();
    for (const slug of slugs)
      await expect(page.locator(".builder-site-review")).toContainText(slug);
    await page
      .getByRole("button", { name: /^Publish site design and \d+ pages$/ })
      .click();
    await expect(page.locator(".builder-site-message")).toContainText(
      "published locally",
    );
  }
  await page.getByRole("button", { name: "Site design", exact: true }).click();
  await publishDesign();
  const live = await context.newPage();
  await live.setViewportSize({ width: 390, height: 844 });
  await live.goto(`/${slugs[0]}/`);
  await expect(live.locator(".kb-menu-brand")).toHaveText("Studio North");
  await expect(live.locator(".kb-menu")).toHaveCSS("width", "390px");
  if (font) {
    await expect(live.locator(".kb-page")).toHaveCSS(
      "font-family",
      "BuilderFont, system-ui, sans-serif",
    );
    await expect
      .poll(() =>
        live.evaluate(async () => {
          await document.fonts.ready;
          return document.fonts.check("18px BuilderFont");
        }),
      )
      .toBe(true);
  }
  await expect(
    live.getByRole("heading", {
      name: "Your next chapter starts here.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Edit ${section}`, exact: true })
    .click();
  await page
    .frameLocator("#preview-frame")
    .getByRole("heading", {
      name: "Your next chapter starts here.",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("A shared new chapter");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Token spacing section", exact: true })
    .fill("80");
  await page
    .getByRole("button", { name: "Save site draft", exact: true })
    .click();
  await expect(page.locator(".builder-site-message")).toContainText(
    "saved as a draft",
  );
  await live.reload();
  await expect(
    live.getByRole("heading", {
      name: "Your next chapter starts here.",
      exact: true,
    }),
  ).toBeVisible();
  await publishDesign();
  for (let index = 0; index < 3; index++) {
    await live.goto(`/${slugs[index]}/`);
    await expect(
      live.getByRole("heading", {
        name: index === 1 ? "Only on this page" : "A shared new chapter",
        exact: true,
      }),
    ).toBeVisible();
    await expect(live.locator(".kb-page > .kb-container").nth(1)).toHaveCSS(
      "padding-left",
      "20px",
    );
    if (index === 0)
      await expect(live.locator(".kb-page > .kb-container").nth(1)).toHaveCSS(
        "width",
        "366px",
      );
    await expect
      .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
      .toBe(390);
    await live.setViewportSize({ width: 1280, height: 900 });
    await expect(live.locator(".kb-page > .kb-container").nth(1)).toHaveCSS(
      "padding-left",
      "80px",
    );
    await live.setViewportSize({ width: 390, height: 844 });
  }
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: `/${slugs[2]}/` })
    .click();
  await page
    .frameLocator("#preview-frame")
    .locator("[data-puck-component]")
    .first()
    .click();
  await page
    .getByRole("button", { name: "Detach shared component", exact: true })
    .click();
  await expect(page.locator(".builder-toast")).toContainText("detached");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.frameLocator("#preview-frame").locator("[data-puck-component]"),
  ).toHaveCount(1);
  await page
    .frameLocator("#preview-frame")
    .locator("[data-puck-component]")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Detach shared component", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page.getByRole("button", { name: "Site design", exact: true }).click();
  await page
    .getByRole("button", { name: `Edit ${section}`, exact: true })
    .click();
  await page
    .frameLocator("#preview-frame")
    .getByRole("heading", { name: "A shared new chapter", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Another shared chapter");
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await publishDesign();
  await live.reload();
  await expect(
    live.getByRole("heading", { name: "A shared new chapter", exact: true }),
  ).toBeVisible();
  await live.screenshot({
    path: "test-results/builder-shared-site-mobile.png",
    fullPage: true,
  });
});
