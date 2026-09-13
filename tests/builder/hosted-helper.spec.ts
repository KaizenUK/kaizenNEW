import { test, expect } from "./browser-fixture";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { openSiteProject } from "./hosted-repository-fixture";
import {
  hostedHelperFixture,
  helperToken,
  helperOwner,
} from "./hosted-helper-fixture";
import {
  hostedBuildScript,
  buildMode,
  buildCount,
} from "./hosted-build-fixture";

test("the hosted editor follows queued builds, keeps drafts, shows failures and cancels running builds", async ({
  page,
}) => {
  const created = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Hosted build queue fixture" },
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  const helper = await hostedHelperFixture([project.id], hostedBuildScript);
  const root = helper.folders.root(project.id);
  const send = (input: Record<string, unknown>) =>
    helper.send({ projectId: project.id, ...input });
  try {
    await openSiteProject(page, project, root, true, {
      origin: helper.helper.origin,
      accessToken: helperToken(),
    });
    expect((await send({ action: "repository-connect" })).status).toBe(200);
    await buildMode(helper, project.id, "hold");
    const plan = (await send({ action: "repository-build-review" })).body;
    const first = (
      await send({ action: "repository-build-start", planId: plan.id })
    ).body;
    await expect
      .poll(
        async () =>
          (await send({ action: "repository-build-status", jobId: first.id }))
            .body.log,
      )
      .toContain("Fixture build started");
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
    await input.fill("Keep these edits while building");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Waiting to build the preview…" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Position 2" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Waiting to build the preview…" }),
    ).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390)
        await page
          .getByRole("navigation", { name: "Editor panels" })
          .getByRole("button", { name: "Page", exact: true })
          .click();
      await expect(
        page.getByRole("button", { name: "Cancel build", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/hosted-build-queue-${width}.png`,
      });
    }
    await page
      .getByRole("button", { name: "Cancel build", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Build cancelled. Your edits are kept.",
      }),
    ).toBeVisible();
    expect(await buildCount(helper, project.id)).toBe(1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Build cancelled. Your edits are kept.",
      }),
    ).toBeVisible();
    await send({ action: "repository-build-stop", jobId: first.id });
    await expect
      .poll(
        async () =>
          (await send({ action: "repository-build-status", jobId: first.id }))
            .body.status,
      )
      .toBe("cancelled");
    await buildMode(helper, project.id, "fail");
    await page
      .getByRole("button", { name: "Build again", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Build exited with code 19" }),
    ).toBeVisible();
    await page
      .locator(".builder-site-build")
      .getByText("Build log", { exact: true })
      .click();
    await expect(page.locator(".builder-site-build pre")).toContainText(
      "Deliberate fixture build failure",
    );
    await buildMode(helper, project.id, "hold");
    await page
      .getByRole("button", { name: "Try building again", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Building the preview…" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel build", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Build cancelled. Your edits are kept.",
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("searchbox", { name: "Find page content" })
      .fill("Keep these edits while building");
    await page
      .locator(".builder-site-field")
      .filter({ hasText: "Keep these edits while building" })
      .click();
    await expect(input).toHaveValue("Keep these edits while building");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await expect(
      page.getByRole("button", { name: "Review my changes", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Export & handoff", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Check folder", exact: true })
      .click();
    const controls = page.locator(".builder-repository-build");
    await controls
      .getByRole("button", { name: "Check build command", exact: true })
      .click();
    await controls
      .getByRole("button", { name: "Run build", exact: true })
      .click();
    await expect(controls.getByRole("status")).toContainText("Building");
    await controls
      .getByRole("button", { name: "Cancel build", exact: true })
      .click();
    await expect(controls.getByRole("status")).toContainText(
      "Build cancelled.",
    );
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
      "Saved",
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
      page.getByRole("alert").filter({
        has: page.getByRole("button", { name: "Retry saving edits" }),
      }),
    ).toContainText("Project access ended");
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
