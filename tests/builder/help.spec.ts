import { test, expect, type Page } from "./browser-fixture";
import { helpTopics } from "../../client/visual-builder/helpContent";
import { newDocument } from "../../client/visual-builder/starters";
import { siteFixture } from "./site-fixture";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { accountFixture } from "./account-fixture";

const views = [
  "pages",
  "projects",
  "site",
  "assets",
  "releases",
  "redirects",
  "previews",
  "backups",
  "repository",
  "settings",
  "account",
  "existing",
] as const;
async function checkView(
  page: Page,
  topic: (typeof views)[number],
  width: number,
) {
  const description = page.locator(".builder-head-description");
  await expect(description).toHaveCount(1);
  await expect(description).toContainText(helpTopics[topic].description);
  // On phones the sidebar precedes the page. Measure a viewport starting at the view's own heading.
  await page
    .locator(".builder-head")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  const paragraphs = await page
    .locator(".builder-main p")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          if (!element.checkVisibility()) return false;
          const rect = element.getBoundingClientRect();
          if (
            !rect.width ||
            !rect.height ||
            rect.top >= innerHeight ||
            rect.bottom <= 0
          )
            return false;
          // Current state, empty results and row data are not explanatory paragraphs.
          if (
            element.closest('[role="status"], [role="alert"], li') ||
            element.matches(".builder-head-info, .builder-empty") ||
            element.parentElement?.matches(".builder-project-card-title")
          )
            return false;
          const text = element.textContent?.trim() || "";
          return !/^(?:\d+ assets?$|\d+ pages found · Recorded|Backup format 1 ·|Developer view$|Client view$)/.test(
            text,
          );
        })
        .map((element) => element.textContent),
    );
  expect(
    paragraphs,
    `${topic} at ${width}px has repeated introductory prose`,
  ).toEqual([await description.textContent()]);
  if (["pages", "settings", "repository"].includes(topic))
    await page.screenshot({
      path: `test-results/l3-view-${topic}-${width}.png`,
    });
  const link = description.getByRole("button", {
    name: `Learn more about ${helpTopics[topic].title}`,
    exact: true,
  });
  await link.click();
  const drawer = page.getByRole("dialog", {
    name: helpTopics[topic].title,
    exact: true,
  });
  await expect(drawer.locator(".builder-help-content p").first()).toBeVisible();
  await expect(drawer.getByText("Loading help…", { exact: true })).toHaveCount(
    0,
  );
  const bounds = await drawer.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  expect(
    await drawer.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  if (["pages", "settings", "repository"].includes(topic))
    await page.screenshot({
      path: `test-results/l3-help-${topic}-${width}.png`,
    });
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(link).toBeFocused();
}

for (const width of [1440, 390])
  test(`all workspace views explain once and open their own guide at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const project = await (
      await page.request.post("/__builder-projects", {
        headers: { "X-Kaizen-Builder": "1" },
        data: { action: "create", name: "Guide views" },
      })
    ).json();
    for (const view of views) {
      if (view === "existing") await page.goto("/builder/?project=kaizen");
      else
        await page.goto(
          `/builder/?project=${project.id}${view === "account" ? "&view=account" : ""}`,
        );
      if (view !== "account")
        await page
          .getByRole("complementary", { name: "Builder navigation" })
          .getByRole("button", {
            name: view === "projects" ? "All projects" : helpTopics[view].title,
            exact: true,
          })
          .click();
      await checkView(page, view, width);
    }
  });

test("help retries after an outage, follows guide topics, traps keyboard focus and keeps unsaved settings", async ({
  page,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Help example" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const field = page.getByLabel("Website URL", { exact: true });
  await field.fill("https://not-yet-saved.example.test");
  let failed = false;
  await page.route("**/docs/visual-builder.md*", async (route) => {
    if (!failed && !route.request().url().includes("import")) {
      failed = true;
      await route.fulfill({
        status: 503,
        body: "Help temporarily unavailable",
      });
    } else await route.continue();
  });
  const link = page
    .locator(".builder-head-description")
    .getByRole("button", { name: "Learn more about Settings" });
  await link.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(drawer.getByRole("alert")).toContainText(
    "your work is still here",
  );
  await drawer.getByRole("button", { name: "Try loading help again" }).click();
  await expect(drawer.locator(".builder-help-content")).toContainText(
    "Set the public website address",
  );
  await expect(drawer.getByRole("alert")).toHaveCount(0);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await expect(field).toHaveValue("https://not-yet-saved.example.test");
  const workspace = await (
    await page.request.get(`/__builder-local?project=${project.id}`)
  ).json();
  expect(workspace.settings?.value.siteUrl || "").toBe("");
  await page.goto(`/builder/?project=${project.id}`);
  await page
    .getByRole("button", { name: "Learn more about Pages", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "editing website pages", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Website page editor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Website page editor", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Back to Pages", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Pages", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close help", exact: true }).click();
});

test("hosted Account retains unsubmitted details when help opens at desktop and phone widths", async ({
  page,
}) => {
  const fixture = await accountFixture(page);
  try {
    const name = page.getByRole("textbox", { name: "Your name", exact: true });
    await name.fill("Name not submitted");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page
        .getByRole("button", { name: "Learn more about Account", exact: true })
        .click();
      await expect(
        page.getByRole("dialog").locator(".builder-help-content"),
      ).toContainText("Your name and verified email");
      await page.keyboard.press("Escape");
      await expect(name).toHaveValue("Name not submitted");
    }
    expect(fixture.state.updates).toEqual([]);
  } finally {
    await fixture.dispose();
  }
});

test("the page editor opens contextual help at desktop and phone widths", async ({
  page,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Editor help" },
    })
  ).json();
  await page.request.post(`/__builder-local?project=${project.id}`, {
    headers: { "X-Kaizen-Builder": "1" },
    data: {
      action: "save",
      id: crypto.randomUUID(),
      version: 0,
      document: newDocument("Help page", "help-page", false),
    },
  });
  await page.goto(`/builder/?project=${project.id}`);
  await page.getByRole("button").filter({ hasText: "/help-page/" }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await expect(page.locator(".builder-editor-description")).toContainText(
      helpTopics.editor.description,
    );
    await page
      .getByRole("button", {
        name: "Learn more about Page editor",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog").locator(".builder-help-content"),
    ).toContainText("Edits autosave.");
    await page.screenshot({ path: `test-results/l3-help-editor-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(page.locator(".builder-header-page")).toContainText(
      "Help page",
    );
  }
});

test("existing website help preserves edited words and the original source", async ({
  page,
}) => {
  const source =
    "<html><head><title>Guide garden</title></head><body><main><h1>Original garden words</h1></main></body></html>";
  const fixture = await siteFixture(page, source);
  try {
    await fixture.open();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    const heading = frame.getByRole("heading", {
      name: "Original garden words",
    });
    await heading.dblclick();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Changed garden words");
    await page
      .getByRole("button", {
        name: "Learn more about Website page editor",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog").locator(".builder-help-content"),
    ).toContainText("Review my changes");
    await page.screenshot({ path: "test-results/l3-help-source-1440.png" });
    await page.keyboard.press("Escape");
    await expect(
      frame.getByRole("heading", { name: "Changed garden words" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", {
        name: "Learn more about Website page editor",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog").locator(".builder-help-content"),
    ).toContainText("Review my changes");
    await page.screenshot({ path: "test-results/l3-help-source-390.png" });
    await page.keyboard.press("Escape");
    expect(
      await readFile(path.join(fixture.root, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
  } finally {
    await page.goto("about:blank");
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("help follows the chosen dark theme and still closes from the keyboard", async ({
  page,
}) => {
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page
    .getByRole("button", { name: "Learn more about Pages", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Pages", exact: true });
  await expect(drawer).toHaveAttribute("data-theme", "dark");
  await expect(drawer.locator(".builder-help-content")).toContainText(
    "Open a page from the list",
  );
  await page.screenshot({ path: "test-results/l3-help-dark-1440.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/l3-help-dark-390.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Learn more about Pages", exact: true }),
  ).toBeFocused();
});
