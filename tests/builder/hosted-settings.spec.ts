import { closeFixturePage } from "./fixture-routes";
import { test, expect, drainRepositoryRoutes } from "./browser-fixture";
import { hostedPreviewFixture } from "./hosted-preview-fixture";
import { openSiteProject } from "./hosted-repository-fixture";
import { helperToken } from "./hosted-helper-fixture";

test.use({ ignoreHTTPSErrors: true });
test("an owner sets up a real hosted folder with a one-time public key, then edits and saves its page", async ({
  page,
  context,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Hosted repository setup" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const fixture = await hostedPreviewFixture(project.id, true, true);
  const { api } = fixture;
  const root = api.folders.root(project.id);
  const panel = page.getByRole("region", {
    name: "Website repository",
    exact: true,
  });
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: fixture.origin,
    });
    await openSiteProject(page, project, root, true, {
      origin: api.helper.origin,
      editorOrigin: fixture.origin,
      direct: true,
      accessToken: helperToken(),
    });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(panel.getByLabel("Repository SSH address")).toHaveValue(
      "git@github.com:fixture/site.git",
    );
    await panel.getByLabel("Website branch").fill("preview");
    await panel
      .getByRole("button", { name: "Save repository settings", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "Repository settings saved",
    );
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(panel.getByLabel("Website branch")).toHaveValue("preview");
    await expect(
      panel.getByRole("link", { name: "Open staging", exact: true }),
    ).toHaveCount(0);
    await panel.getByLabel("Website branch").fill("stage");
    await panel
      .getByRole("button", { name: "Save repository settings", exact: true })
      .click();
    await expect(
      panel.getByRole("link", { name: "Open staging", exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Create deploy key", exact: true })
      .click();
    const publicKeyField = panel.getByRole("textbox", {
      name: "Public deploy key",
      exact: true,
    });
    await expect(publicKeyField).toBeVisible();
    const publicKey = await publicKeyField.inputValue();
    expect(publicKey).toMatch(/^ssh-ed25519 /);
    await panel
      .getByRole("button", { name: "Copy public key", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(publicKey);
    await expect(panel).not.toContainText("PRIVATE KEY");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await panel.screenshot({
        path: `test-results/hosted-repository-settings-key-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await panel
      .getByRole("button", { name: "Check website folder", exact: true })
      .click();
    await expect(panel.getByRole("alert")).toContainText(
      "repository operation failed",
    );
    await api.authorizeKey(publicKey);
    await panel
      .getByRole("button", { name: "I've added this key", exact: true })
      .click();
    await expect(
      panel.getByRole("textbox", { name: "Public deploy key", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Check website folder", exact: true })
      .click();
    await expect(panel.getByText("Connected", { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Replace setup key", exact: true }),
    ).toHaveCount(0);
    await fixture.prepareDependencies();
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    const iframe = page.locator('iframe[title="Website canvas"]');
    await expect(iframe).toBeVisible({ timeout: 45000 });
    const before = await iframe.getAttribute("src");
    const heading = page
      .frameLocator('iframe[title="Website canvas"]')
      .getByRole("heading", { level: 1 });
    await heading.dblclick();
    await heading.fill("Set up and saved through the hosted editor");
    await heading.press("Tab");
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect(iframe).not.toHaveAttribute("src", before!, {
      timeout: 45000,
    });
    await page
      .getByRole("button", { name: "Save to website", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open staging", exact: true }),
    ).toBeVisible();
    expect(
      await api.git(api.remote, ["show", "stage:src/pages/index.astro"]),
    ).toContain("Set up and saved through the hosted editor");
    expect(await api.git(api.remote, ["branch", "--list", "main"])).toBe("");
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      panel.getByRole("textbox", { name: "Public deploy key", exact: true }),
    ).toHaveCount(0);
    await expect(panel.getByText("Connected", { exact: true })).toBeVisible();
  } finally {
    drainRepositoryRoutes.delete(page);
    try {
      await closeFixturePage(page);
      await context.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.close();
    }
  }
});
