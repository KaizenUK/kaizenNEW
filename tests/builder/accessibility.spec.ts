import { writeFile, readFile, rm } from "node:fs/promises";
import type { Locator } from "@playwright/test";
import { siteFixture } from "./site-fixture";
import { accountFixture, accountOwner } from "./account-fixture";
import { helpTopics } from "../../client/visual-builder/helpContent";
import {
  templateDocument,
  newDocument,
  block,
} from "../../client/visual-builder/starters";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "./browser-fixture";

async function audit(page: Page, name: string) {
  // Audit settled colours, rather than sampling a focus/selection transition.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const result = await new AxeBuilder({ page }).analyze();
  // axe finishes in a temporary tab. Firefox does not return focus when it closes.
  await page.bringToFront();
  const output = test.info().outputPath(`${name}-axe.json`);
  await writeFile(output, JSON.stringify(result, null, 2));
  await test
    .info()
    .attach(`${name}-axe`, { path: output, contentType: "application/json" });
  const serious = result.violations.filter((item) =>
    ["serious", "critical"].includes(item.impact || ""),
  );
  expect
    .soft(
      serious.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          reason: node.failureSummary,
        })),
      })),
      name,
    )
    .toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`Pages, editor and dialogs have no serious accessibility violations in ${theme} mode`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.addInitScript(
      (value) => localStorage.setItem("kaizen-builder-theme", value),
      theme,
    );
    const response = await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Accessible garden" },
    });
    expect(response.ok()).toBe(true);
    const project = await response.json();
    await page.goto(`/builder/?project=${project.id}`);
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
    await audit(page, "empty-pages");
    await page
      .getByRole("button", { name: "Browse templates", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Page templates", exact: true }),
    ).toBeVisible();
    await audit(page, "templates");
    await page
      .getByRole("article", { name: "Home template", exact: true })
      .getByRole("button", { name: "Preview", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Preview · Home", exact: true }),
    ).toBeVisible();
    await audit(page, "template-preview");
    await page
      .getByRole("button", { name: "Use template", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Back to pages", exact: true }),
    ).toBeVisible();
    await expect(
      page.frameLocator("#preview-frame").getByRole("heading", {
        name: "Make room for something better.",
        exact: true,
      }),
    ).toBeVisible();
    await audit(page, "editor");
    await page
      .frameLocator("#preview-frame")
      .getByRole("heading", {
        name: "Make room for something better.",
        exact: true,
      })
      .click();
    await audit(page, "selected-block");
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await audit(page, "editor-assets");
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await audit(page, "editor-layers");
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await audit(page, "page-settings");
    await page.getByRole("button", { name: "Styles", exact: true }).click();
    await audit(page, "page-styles");
    await page.getByRole("button", { name: "Revisions", exact: true }).click();
    await audit(page, "page-revisions");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Page preview", exact: true }),
    ).toBeVisible();
    await audit(page, "page-preview");
    await page
      .getByRole("button", { name: "Return to editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await expect(page.locator(".builder-page-row")).toHaveCount(1);
    await audit(page, "saved-pages");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await audit(page, `pages-${width}`);
      if (width === 390)
        await page
          .locator("#builder-main")
          .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: `test-results/launch-accessibility-${test.info().project.name}-${theme}-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assets", exact: true }),
    ).toBeVisible();
    await audit(page, "assets");
    // The existing-site publication review belongs to the legacy capability.
    // This is the dedicated test workspace, never a personal checkout.
    const document = templateDocument("home", {
      siteName: "Keyboard garden",
      slug: `keyboard-${crypto.randomUUID().slice(0, 8)}`,
    });
    const saved = await page.request.post("/__builder-local?project=kaizen", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "save", id: crypto.randomUUID(), version: 0, document },
    });
    expect(saved.ok()).toBe(true);
    await page.goto("/builder/?project=kaizen");
    await page
      .locator(".builder-page-row")
      .filter({ hasText: `/${document.slug}/` })
      .click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page, "publish-review");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `test-results/launch-accessibility-publish-${test.info().project.name}-${theme}-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Preview first", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Page preview", exact: true }),
    ).toBeVisible();
    await audit(page, "publish-preview");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `test-results/launch-accessibility-preview-${test.info().project.name}-${theme}-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Return to editor", exact: true })
      .click();
  });
}

async function tabTo(page: Page, target: Locator, key = "Tab") {
  for (let index = 0; index < 180; index++) {
    if (
      await target.evaluate(
        (element) =>
          element === element.ownerDocument.activeElement &&
          element.ownerDocument.hasFocus(),
      )
    )
      return;
    await page.keyboard.press(key);
  }
  await expect
    .poll(
      () =>
        target.evaluate(
          (element) =>
            element === element.ownerDocument.activeElement &&
            element.ownerDocument.hasFocus(),
        ),
      { message: "The control must receive real keyboard focus by Tab" },
    )
    .toBe(true);
}
async function activate(page: Page, target: Locator, key = "Tab") {
  await tabTo(page, target, key);
  await page.keyboard.press("Enter");
}
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function checkFocusLoop(page: Page, dialog: Locator) {
  const controls = dialog
    .locator("button:not([disabled]),input:not([disabled]),a[href]")
    .filter({ visible: true });
  // Checking each edge makes both directions explicit, without relying on a fixed count.
  await tabTo(page, controls.last());
  await page.keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(controls.last()).toBeFocused();
}

test("keyboard users can navigate Pages, edit a canvas block and return from dialogs", async ({
  page,
}) => {
  test.setTimeout(180000);
  const document = newDocument(
    "Keyboard garden",
    `key-${crypto.randomUUID().slice(0, 8)}`,
    false,
  );
  document.data.content = [
    block("Text", { text: "A garden for everyone", tag: "h1" }),
    block("Text", {
      text: "Second garden section",
      tag: "p",
      style: { desktop: { padding: 24 } },
    }),
    block("Text", {
      text: "Third garden section",
      tag: "p",
      style: { desktop: { padding: 24 } },
    }),
  ];
  const saved = await page.request.post("/__builder-local?project=kaizen", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "save", id: crypto.randomUUID(), version: 0, document },
  });
  expect(saved.ok()).toBe(true);
  await page.goto("/builder/?project=kaizen");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to page content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#builder-main")).toBeFocused();
  await activate(page, button(page, "Browse templates"));
  await checkFocusLoop(page, page.getByRole("dialog"));
  await page.keyboard.press("Escape");
  await expect(button(page, "Browse templates")).toBeFocused();
  const row = page
    .locator(".builder-page-row")
    .filter({ hasText: `/${document.slug}/` });
  await activate(page, row);
  const canvas = page.frameLocator("#preview-frame");
  const ids = document.data.content.map((item) => item.props.id);
  const textBlock = canvas.locator(`[data-puck-component="${ids[0]}"]`);
  await expect(textBlock).toHaveAccessibleName("Text block");
  const instructionsId = await textBlock.getAttribute("aria-describedby");
  await expect(canvas.locator(`[id="${instructionsId}"]`)).toContainText(
    "Press Enter to select",
  );
  await activate(page, textBlock);
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toBeVisible();
  const text = page.getByRole("textbox", { name: "Text", exact: true });
  await tabTo(page, text);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("A keyboard-friendly garden");
  await expect(canvas.getByRole("heading", { level: 1 })).toHaveText(
    "A keyboard-friendly garden",
  );
  await tabTo(page, textBlock, "Shift+Tab");
  await page.screenshot({
    path: `test-results/launch-accessibility-keyboard-${test.info().project.name}.png`,
  });
  await page.keyboard.press("Space");
  await expect(canvas.locator("[data-dnd-dragging]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(canvas.locator("[data-dnd-dragging]")).toHaveCount(0);
  await expect(canvas.getByRole("heading", { level: 1 })).toHaveText(
    "A keyboard-friendly garden",
  );
  await tabTo(page, textBlock, "Shift+Tab");
  await page.keyboard.press("Space");
  const dragged = canvas.locator("[data-dnd-dragging]");
  await expect(dragged).toHaveCount(1);
  const lastBlock = canvas.locator(`[data-puck-component="${ids[2]}"]`);
  let reached = false;
  for (let step = 0; step < 40; step++) {
    const bounds = (await dragged.boundingBox())!;
    const target = (await lastBlock.boundingBox())!;
    if (bounds.y + bounds.height * 0.5 > target.y + target.height * 0.7) {
      reached = true;
      break;
    }
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(
        async () => {
          const next = (await dragged.boundingBox())!;
          return next.y > bounds.y + 1;
        },
        { message: "An arrow key visibly moves the dragged block" },
      )
      .toBe(true);
  }
  expect(reached, "The keyboard drag reaches the final block").toBe(true);
  await page.keyboard.press("Space");
  await expect(canvas.locator("[data-dnd-dragging]")).toHaveCount(0);
  await expect
    .poll(() =>
      canvas
        .locator("[data-puck-component]")
        .evaluateAll((elements) =>
          elements.map((element) =>
            element.getAttribute("data-puck-component"),
          ),
        ),
    )
    .toEqual([ids[1], ids[2], ids[0]]);
  await activate(page, button(page, "Page"));
  await tabTo(page, page.getByLabel("Page title", { exact: true }));
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Keyboard garden revised");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".builder-save-status")).toHaveText("Saved");
  await activate(page, button(page, "Publish"), "Shift+Tab");
  await expect(button(page, "Cancel")).toBeFocused();
  await checkFocusLoop(page, page.getByRole("dialog"));
  await page.keyboard.press("Escape");
  await expect(button(page, "Publish")).toBeFocused();
  await page.keyboard.press("Enter");
  await activate(page, button(page, "Preview first"));
  await expect(button(page, "Return to editor")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button(page, "Preview")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(button(page, "Preview")).toBeFocused();
  await activate(page, button(page, "Back to pages"), "Shift+Tab");
  await expect(row).toContainText("Keyboard garden revised");
});

test("keyboard users edit an existing page and apply its reviewed changes", async ({
  page,
}) => {
  test.setTimeout(180000);
  const original =
    '<!doctype html><html lang="en"><head><title>Keyboard garden</title><style>body{font:18px system-ui;color:#163a32;background:white}main{padding:40px}</style></head><body><main><h1>Original garden heading</h1><p>Everyone is welcome.</p></main></body></html>';
  const fixture = await siteFixture(page, original);
  try {
    await page.reload();
    await activate(page, button(page, "Edit existing /"));
    await activate(page, button(page, "Build"));
    await expect(
      page
        .frameLocator('iframe[title="Website canvas"]')
        .getByRole("heading", { name: "Original garden heading", exact: true }),
    ).toBeVisible();
    await audit(page, "source-editor");
    const field = page
      .locator(".builder-site-field")
      .filter({ hasText: "Original garden heading" });
    const fieldId = await field.getAttribute("data-source-field");
    const stableField = page.locator(`[data-source-field="${fieldId}"]`);
    await activate(page, stableField, "Shift+Tab");
    const editor = page.locator(".builder-site-field-editor textarea");
    await expect(editor).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("A garden reached by keyboard");
    await page.keyboard.press("Escape");
    await expect(stableField).toBeFocused();
    await activate(page, button(page, "Review my changes"), "Shift+Tab");
    await expect(page.getByRole("dialog")).toContainText(
      "A garden reached by keyboard",
    );
    await audit(page, "source-review");
    await checkFocusLoop(page, page.getByRole("dialog"));
    await page.keyboard.press("Escape");
    await expect(button(page, "Review my changes")).toBeFocused();
    await page.keyboard.press("Enter");
    await activate(page, button(page, "Apply changes to the folder"));
    await expect
      .poll(() => readFile(`${fixture.root}/src/pages/index.astro`, "utf8"))
      .toBe(
        original.replace(
          "Original garden heading",
          "A garden reached by keyboard",
        ),
      );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.frameLocator('iframe[title="Website canvas"]').getByRole("heading", {
        name: "A garden reached by keyboard",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`workspace settings, account and help controls are accessible in ${theme} mode`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.addInitScript(
      (value) => localStorage.setItem("kaizen-builder-theme", value),
      theme,
    );
    const created = await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Accessible workspace" },
    });
    expect(created.ok()).toBe(true);
    const project = await created.json();
    for (const topic of [
      "site",
      "releases",
      "redirects",
      "previews",
      "backups",
      "repository",
      "settings",
      "projects",
    ] as const) {
      await page.goto(`/builder/?project=${project.id}`);
      await page
        .getByRole("complementary", { name: "Builder navigation" })
        .getByRole("button", {
          name: topic === "projects" ? "All projects" : helpTopics[topic].title,
          exact: true,
        })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        helpTopics[topic].title,
      );
      await audit(page, topic);
    }
    const fixture = await accountFixture(page);
    try {
      await expect(
        page.getByRole("textbox", { name: "Your name", exact: true }),
      ).toBeVisible();
      await audit(page, "account");
      await fixture.switchAccount(accountOwner);
      await button(page, "Settings").click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Settings",
      );
      await audit(page, "owner-settings");
      const help = button(page, "Learn more about Settings");
      await activate(page, help);
      const dialog = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await expect(dialog.locator(".builder-help-content")).toContainText(
        "Set the public website address",
      );
      await audit(page, "help");
      await checkFocusLoop(page, dialog);
      await page.keyboard.press("Escape");
      await expect(help).toBeFocused();
    } finally {
      await fixture.dispose();
    }
  });
}
