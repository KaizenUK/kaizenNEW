import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
test.use({ actionTimeout: 10000 });
const source =
  "<html><head><title>Recovery garden</title></head><body><main><h1>\n  A resilient garden\n</h1><p>Keep this paragraph</p></main></body></html>";

test("M1: reviewed builds are reused; outline keyboard editing and saved drafts survive reopening", async ({
  page,
}) => {
  const fixture = await siteFixture(page, source);
  try {
    await fixture.open();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    await expect(frame.getByRole("heading", { level: 1 })).toBeVisible();
    await frame.getByRole("heading", { level: 1 }).dblclick();
    await frame.getByRole("heading", { level: 1 }).fill("A recovered garden");
    await page
      .getByRole("searchbox", { name: "Find page content" })
      .fill("A recovered garden");
    const row = page
      .locator(".builder-site-field")
      .filter({ hasText: "A recovered garden" });
    await row.focus();
    await row.press("Enter");
    const input = page.locator(".builder-site-field-editor textarea");
    await expect(input).toBeFocused();
    await input.fill("A keyboard garden");
    await input.press("Escape");
    await expect(
      page
        .locator(".builder-site-field")
        .filter({ hasText: "A keyboard garden" }),
    ).toBeFocused();
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved on this computer",
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await expect(frame.getByRole("heading", { level: 1 })).toContainText(
      "A keyboard garden",
    );
    await expect(
      page.getByRole("button", { name: "Build", exact: true }),
    ).toHaveCount(0);
    // Same-window messages, wrong nonce, unknown IDs and a foreign frame must never edit a draft.
    await page.evaluate(() =>
      window.postMessage(
        {
          type: "kaizen-source-edit",
          nonce: "forged",
          id: "forged",
          value: "Do not save",
        },
        location.origin,
      ),
    );
    await expect(frame.getByRole("heading", { level: 1 })).toContainText(
      "A keyboard garden",
    );
    expect(
      await readFile(path.join(fixture.root, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("M1: a failed build leaves editable outline content and a useful build log", async ({
  page,
}) => {
  const fixture = await siteFixture(page, source);
  try {
    await writeFile(
      path.join(fixture.root, "build.mjs"),
      "console.error('Fixture build needs attention');process.exit(1)",
    );
    await fixture.open();
    await expect(page.getByRole("alert")).toContainText(
      "Build exited with code 1",
    );
    await page.getByText("Build log", { exact: true }).click();
    await expect(page.locator(".builder-site-build pre")).toContainText(
      "Fixture build needs attention",
    );
    await page.getByRole("searchbox").fill("A resilient garden");
    await page
      .locator(".builder-site-field-editor textarea")
      .fill("Saved without a build");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved on this computer",
    );
    await expect(
      page.getByRole("button", { name: "Try building again" }),
    ).toBeEnabled();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("M1: unsent text recovers after reload and changed source stays downloadable", async ({
  page,
}) => {
  const fixture = await siteFixture(page, source);
  try {
    await fixture.open();
    await expect(
      page.frameLocator("iframe").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    await page.route("**/__builder-local**", async (route) => {
      if (
        route.request().postDataJSON()?.action ===
        "repository-source-draft-save"
      )
        await route.fulfill({
          status: 503,
          json: { error: "Helper connection interrupted" },
        });
      else await route.continue();
    });
    await page.getByRole("searchbox").fill("A resilient garden");
    await page
      .locator(".builder-site-field-editor textarea")
      .fill("Keep my unsent text");
    await expect(page.getByRole("alert")).toContainText(
      "Helper connection interrupted",
    );
    await page.unroute("**/__builder-local**");
    await page.reload();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page.getByRole("searchbox").fill("Keep my unsent text");
    await expect(
      page.locator(".builder-site-field-editor textarea"),
    ).toHaveValue("Keep my unsent text");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved on this computer",
    );
    await writeFile(
      path.join(fixture.root, "src/pages/index.astro"),
      source.replace("A resilient garden", "Changed outside the editor"),
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "earlier edits are kept" }),
    ).toContainText("Keep my unsent text");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download my unapplied edits", exact: true })
      .first()
      .click();
    expect((await download).suggestedFilename()).toContain("source");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
