import { test, expect, drainRepositoryRoutes } from "./browser-fixture";
import { hostedPreviewFixture } from "./hosted-preview-fixture";
import { openSiteProject } from "./hosted-repository-fixture";
import { helperToken } from "./hosted-helper-fixture";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";

test.use({ ignoreHTTPSErrors: true });
test("a publisher saves an existing page to staging and explicitly publishes that revision through Releases", async ({
  page,
  context,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Publish staged website" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const fixture = await hostedPreviewFixture(project.id, true, false, true),
    { api, publication } = fixture;
  const root = api.folders.root(project.id),
    base = await api.git(api.remote, ["rev-parse", "main"]);
  const panel = page.getByRole("region", {
    name: "Publish website changes",
    exact: true,
  });
  try {
    await openSiteProject(page, project, root, true, {
      origin: api.helper.origin,
      accessToken: helperToken(),
      direct: true,
      editorOrigin: fixture.origin,
    });
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
    await heading.fill("Publish this reviewed heading");
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
    const staged = await api.git(api.remote, ["rev-parse", "stage"]);
    expect(staged).not.toBe(base);
    expect(await api.git(api.remote, ["rev-parse", "main"])).toBe(base);
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page.getByRole("button", { name: "Releases", exact: true }).click();
    await expect(panel).toBeVisible();
    await panel
      .getByRole("button", { name: "Review staged website", exact: true })
      .click();
    await expect(panel.getByRole("alert")).toContainText("not serving");
    publication.stageCommit = staged;
    await panel
      .getByRole("button", { name: "Review staged website", exact: true })
      .click();
    await expect(
      panel.getByRole("button", {
        name: "Publish reviewed changes",
        exact: true,
      }),
    ).toBeVisible();
    expect(await api.git(api.remote, ["rev-parse", "main"])).toBe(base);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await panel.screenshot({
        path: `test-results/hosted-publish-review-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o700 });
    await panel
      .getByRole("button", { name: "Publish reviewed changes", exact: true })
      .click();
    await expect(
      panel.getByRole("button", {
        name: "Retry publishing reviewed changes",
        exact: true,
      }),
    ).toBeEnabled();
    expect(await api.git(api.remote, ["rev-parse", "main"])).toBe(base);
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await page.getByRole("button", { name: "Releases", exact: true }).click();
    await expect(
      panel.getByRole("button", {
        name: "Retry publishing reviewed changes",
        exact: true,
      }),
    ).toBeEnabled();
    await panel
      .getByRole("button", { name: "Check publication state", exact: true })
      .click();
    expect(await api.git(api.remote, ["rev-parse", "main"])).toBe(base);
    await rm(hook);
    await panel
      .getByRole("button", {
        name: "Retry publishing reviewed changes",
        exact: true,
      })
      .click();
    await expect(
      panel.getByText(
        "The reviewed revision was sent to the production branch.",
        { exact: false },
      ),
    ).toBeVisible();
    expect(await api.git(api.remote, ["rev-parse", "main"])).toBe(staged);
    expect(
      await api.git(api.remote, ["show", "main:src/pages/index.astro"]),
    ).toContain("Publish this reviewed heading");
    expect(await api.git(root, ["branch", "--show-current"])).toBe("stage");
    await expect(
      panel.getByText(
        "The live website is still reporting a different revision.",
        { exact: false },
      ),
    ).toBeVisible();
    publication.productionCommit = staged;
    await panel
      .getByRole("button", { name: "Check publication state", exact: true })
      .click();
    await expect(
      panel.getByText("The live website reports this revision.", {
        exact: false,
      }),
    ).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await panel.screenshot({
        path: `test-results/hosted-publish-sent-${width}.png`,
      });
    }
  } finally {
    drainRepositoryRoutes.delete(page);
    try {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await context.unrouteAll({ behavior: "wait" });
      }
    } finally {
      await fixture.close();
    }
  }
});
