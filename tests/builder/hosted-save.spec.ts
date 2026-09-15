import { closeFixturePage, fixtureRoute } from "./fixture-routes";
import { test, expect, drainRepositoryRoutes } from "./browser-fixture";
import { hostedPreviewFixture } from "./hosted-preview-fixture";
import { openSiteProject } from "./hosted-repository-fixture";
import { helperToken } from "./hosted-helper-fixture";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  HostedReceiptStore,
  receiptError,
} from "../../scripts/builder-hosted-receipts";

test.use({ ignoreHTTPSErrors: true });
for (const view of ["developer", "client"] as const) {
  test(`${view} hosted save isolates the applied source, explains staged work and push rejection, and restores a retry after reopening`, async ({
    page,
    context,
  }) => {
    const project = await (
      await page.request.post("/__builder-projects", {
        headers: { "X-Kaizen-Builder": "1" },
        data: { action: "create", name: "Save to staging" },
      })
    ).json();
    // Finish development dependency discovery before loading the TLS editor.
    await page.goto(`/builder/?project=${project.id}`);
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
    const fixture = await hostedPreviewFixture(project.id, true);
    const { api } = fixture;
    const root = api.folders.root(project.id);
    const remoteHead = () =>
      api.git(api.remote, ["rev-parse", "refs/heads/stage"]);
    const base = await remoteHead();
    const savePanel = page.getByRole("region", {
      name: "Save to website",
      exact: true,
    });
    try {
      await openSiteProject(page, project, root, true, {
        origin: api.helper.origin,
        accessToken: helperToken(),
        direct: true,
        editorOrigin: fixture.origin,
      });
      await page.evaluate(
        ({ project, view }) =>
          localStorage.setItem(
            `kaizen-builder-view:22222222-2222-4222-8222-222222222222:${project}`,
            view,
          ),
        { project: project.id, view },
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Edit existing /", exact: true })
        .click();
      await page.getByRole("button", { name: "Build", exact: true }).click();
      const iframe = page.locator('iframe[title="Website canvas"]');
      await expect(iframe).toBeVisible({ timeout: 45000 });
      const originalFrame = await iframe.getAttribute("src");
      const heading = page
        .frameLocator('iframe[title="Website canvas"]')
        .getByRole("heading", { level: 1 });
      await heading.dblclick();
      await heading.fill("Saved from the hosted browser");
      await heading.press("Tab");
      await page
        .getByRole("button", { name: "Review my changes", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Apply changes to the folder",
          exact: true,
        })
        .click();
      await expect(iframe).not.toHaveAttribute("src", originalFrame!, {
        timeout: 45000,
      });
      await expect(heading).toHaveText("Saved from the hosted browser");
      await expect(
        savePanel.getByRole("button", { name: "Save to website", exact: true }),
      ).toBeEnabled();
      const accountLink = savePanel.getByRole("link", {
        name: "Account details",
        exact: true,
      });
      await expect(accountLink).toHaveAttribute("target", "_blank");
      const accountUrl = new URL(
        (await accountLink.getAttribute("href"))!,
        page.url(),
      );
      expect(accountUrl.searchParams.get("view")).toBe("account");
      expect(accountUrl.searchParams.get("project")).toBe(project.id);
      expect(await remoteHead()).toBe(base);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        if (width === 390) {
          await page
            .getByRole("button", { name: "Mobile preview", exact: true })
            .click();
          await page
            .getByRole("navigation", { name: "Editor panels" })
            .getByRole("button", { name: "Page", exact: true })
            .click();
        }
        await expect(
          savePanel.getByRole("button", {
            name: "Save to website",
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/hosted-save-ready-${view}-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("button", { name: "Desktop preview", exact: true })
        .click();
      await writeFile(path.join(root, "README.md"), "Unrelated staged work\n");
      await api.git(root, ["add", "README.md"]);
      if (view === "developer") {
        await savePanel
          .getByLabel("Change summary")
          .fill("Update the homepage heading");
      } else {
        await expect(savePanel.getByLabel("Change summary")).toHaveCount(0);
        await expect(
          savePanel.getByText("Save details", { exact: true }),
        ).toHaveCount(0);
      }
      await savePanel
        .getByRole("button", { name: "Save to website", exact: true })
        .click();
      await expect(savePanel.getByRole("alert")).toContainText(
        view === "developer" ? "already staged" : "Other changes",
      );
      expect(await remoteHead()).toBe(base);
      expect(await api.git(root, ["diff", "--cached", "--name-only"])).toBe(
        "README.md",
      );
      await api.git(root, ["reset", "--", "README.md"]);
      const hook = path.join(api.remote, "hooks/pre-receive");
      await writeFile(
        hook,
        "#!/bin/sh\necho private-rejection-detail >&2\nexit 1\n",
        { mode: 0o700 },
      );
      await savePanel
        .getByRole("button", { name: "Save to website", exact: true })
        .click();
      await expect(
        savePanel.getByRole("button", {
          name: "Retry saving to website",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(savePanel.getByRole("alert")).toContainText(
        view === "developer" ? "push was rejected" : "could not be confirmed",
      );
      await expect(savePanel).not.toContainText("private-rejection-detail");
      const commit = await api.git(root, ["rev-parse", "HEAD"]);
      expect(commit).not.toBe(base);
      expect(await remoteHead()).toBe(base);
      // Exercise the disconnect a real proxy can report while the helper stops.
      // Recovery must work after reconnecting, regardless of which read was in flight.
      await fixtureRoute(
        page,
        "**/editor-api/builder-repository",
        (route) =>
          route.fulfill({
            status: 503,
            json: {
              error: "The hosted helper is restarting. Reconnect shortly.",
            },
          }),
        { times: 1 },
      );
      await page
        .getByRole("button", { name: "Back to pages", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Connect helper", exact: true }),
      ).toBeVisible();
      await fixture.restart();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Pages", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Edit existing /", exact: true })
        .click();
      await expect(
        savePanel.getByRole("button", {
          name: "Retry saving to website",
          exact: true,
        }),
      ).toBeEnabled();
      await savePanel
        .getByRole("button", { name: "Check saved state", exact: true })
        .click();
      await expect(
        savePanel.getByRole("button", {
          name: "Retry saving to website",
          exact: true,
        }),
      ).toBeEnabled();
      expect(await remoteHead()).toBe(base);
      await rm(hook);
      await savePanel
        .getByRole("button", { name: "Retry saving to website", exact: true })
        .click();
      await expect(
        savePanel.getByRole("link", { name: "Open staging", exact: true }),
      ).toHaveAttribute("href", fixture.origin);
      await expect(savePanel.getByLabel("Staging deployment")).toContainText(
        view === "developer" ? "waiting" : "queued",
      );
      expect(await remoteHead()).toBe(commit);
      expect(
        await api.git(api.remote, [
          "show",
          "-s",
          "--format=%an <%ae>",
          "stage",
        ]),
      ).toBe("Fixture owner <owner@example.invalid>");
      expect(
        await api.git(api.remote, ["show", "stage:src/pages/index.astro"]),
      ).toContain("Saved from the hosted browser");
      expect(await api.git(api.remote, ["show", "stage:README.md"])).toBe(
        "Unrelated repository content",
      );
      expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
        "Unrelated staged work\n",
      );
      expect(await api.git(api.remote, ["rev-list", "--count", "stage"])).toBe(
        "2",
      );
      expect(await api.git(api.remote, ["branch", "--list", "main"])).toBe("");
      const gitState = await api.send({
        action: "repository-git-status",
        projectId: project.id,
      });
      expect(gitState.status).toBe(200);
      if (view === "developer") {
        await expect(page.locator(".builder-site-footer")).toContainText(
          `${gitState.body.files.length} files changed since the last commit`,
        );
      } else {
        await expect(page.locator(".builder-site-footer")).not.toContainText(
          /src\/|[Bb]ranch|[Cc]ommit|repository|[Pp]ush|files changed/,
        );
      }
      fixture.publication.stageCommit = commit;
      fixture.deployment.status = "completed";
      fixture.deployment.conclusion = "success";
      await expect(savePanel.getByLabel("Staging deployment")).toContainText(
        view === "developer" ? "workflow succeeded" : "On staging",
        { timeout: 25000 },
      );
      if (view === "developer") {
        await expect(
          savePanel.getByRole("link", {
            name: "Deployment details",
            exact: true,
          }),
        ).toHaveAttribute(
          "href",
          "https://github.com/fixture/site/actions/runs/123",
        );
      } else {
        await expect(
          savePanel.getByRole("link", {
            name: "Deployment details",
            exact: true,
          }),
        ).toHaveCount(0);
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        if (width === 390) {
          await page
            .getByRole("button", { name: "Mobile preview", exact: true })
            .click();
          await page
            .getByRole("navigation", { name: "Editor panels" })
            .getByRole("button", { name: "Page", exact: true })
            .click();
        }
        await expect(
          savePanel.getByRole("link", { name: "Open staging", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/hosted-save-${view}-${width}.png`,
        });
      }
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
}

test("an interrupted commit survives helper restart and shows an operator check without another save action", async ({
  page,
  context,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Interrupted save recovery" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const fixture = await hostedPreviewFixture(project.id, true),
    { api } = fixture;
  const root = api.folders.root(project.id);
  const originalWrite = HostedReceiptStore.prototype.write;
  let releaseInspection: () => void = () => {};
  const inspectionReady = new Promise<void>((resolve) => {
    releaseInspection = resolve;
  });
  let releaseDraft: () => void = () => {};
  const draftReady = new Promise<void>((resolve) => {
    releaseDraft = resolve;
  });
  let holdInspection = true;
  let holdDraft = true;
  try {
    const inspection = (
      await api.send({
        action: "repository-source-inspect",
        projectId: project.id,
        route: "src/pages/index.astro",
      })
    ).body;
    const heading = inspection.fields.find(
      (field: { value: string }) => field.value === "Hosted original",
    );
    const plan = await api.send({
      action: "repository-source-prepare",
      projectId: project.id,
      edits: {
        inspection,
        values: { [heading.id]: "Preserve this interrupted save" },
        orders: {},
      },
    });
    expect(plan.status).toBe(200);
    expect(
      (
        await api.send({
          action: "repository-apply",
          projectId: project.id,
          planId: plan.body.id,
        })
      ).status,
    ).toBe(200);
    const base = await api.git(api.remote, ["rev-parse", "stage"]);
    const open = async () => {
      await openSiteProject(page, project, root, true, {
        origin: api.helper.origin,
        accessToken: helperToken(),
        direct: true,
        editorOrigin: fixture.origin,
      });
      await fixtureRoute(
        page,
        "**/editor-api/builder-repository",
        async (route) => {
          if (
            holdInspection &&
            route.request().postDataJSON()?.action ===
              "repository-source-inspect"
          )
            await inspectionReady;
          if (
            holdDraft &&
            route.request().postDataJSON()?.action ===
              "repository-source-draft-read"
          )
            await draftReady;
          await route.fallback();
        },
      );
      await page
        .getByRole("button", { name: "Edit existing /", exact: true })
        .click();
    };
    await open();
    const panel = page.getByRole("region", {
      name: "Save to website",
      exact: true,
    });
    // Save status can arrive before source inspection and draft/build checks.
    // The action must not briefly enable and disappear beneath an early click.
    await expect(
      panel.getByRole("button", { name: "Save to website", exact: true }),
    ).toBeDisabled();
    holdInspection = false;
    releaseInspection();
    await expect(
      page.getByRole("button", { name: "Build", exact: true }),
    ).toBeEnabled();
    await expect(
      panel.getByRole("button", { name: "Save to website", exact: true }),
    ).toBeDisabled();
    holdDraft = false;
    releaseDraft();
    await expect(
      panel.getByRole("button", { name: "Save to website", exact: true }),
    ).toBeEnabled();
    HostedReceiptStore.prototype.write = async function (id, data) {
      if (
        id === project.id &&
        Array.isArray(data) &&
        data.some((entry) => entry.status.phase === "committed")
      )
        throw receiptError();
      return originalWrite.call(this, id, data);
    };
    await panel
      .getByRole("button", { name: "Save to website", exact: true })
      .click();
    await expect(panel.getByRole("alert")).toContainText("operator check");
    HostedReceiptStore.prototype.write = originalWrite;
    const commit = await api.git(root, ["rev-parse", "HEAD"]);
    expect(commit).not.toBe(base);
    await fixture.restart();
    await open();
    await expect(panel.getByRole("status")).toContainText(
      "interrupted website save needs an operator check",
    );
    await expect(
      panel.getByRole("button", { name: "Save to website", exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", {
        name: "Retry saving to website",
        exact: true,
      }),
    ).toHaveCount(0);
    await panel
      .getByRole("button", { name: "Check saved state", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText(
      "no save has been repeated",
    );
    await expect(
      panel.getByRole("button", { name: "Check saved state", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Build", exact: true }),
    ).toBeEnabled();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390)
        await page
          .getByRole("navigation", { name: "Editor panels" })
          .getByRole("button", { name: "Page", exact: true })
          .click();
      await expect(
        panel.getByRole("button", { name: "Check saved state", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/hosted-save-recovery-${width}.png`,
      });
    }
    expect(await api.git(root, ["rev-parse", "HEAD"])).toBe(commit);
    expect(await api.git(root, ["rev-list", "--count", "HEAD"])).toBe("2");
    expect(await api.git(api.remote, ["rev-parse", "stage"])).toBe(base);
    expect(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
    ).toContain("Preserve this interrupted save");
  } finally {
    releaseInspection();
    releaseDraft();
    HostedReceiptStore.prototype.write = originalWrite;
    drainRepositoryRoutes.delete(page);
    try {
      await closeFixturePage(page);
      await context.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.close();
    }
  }
});
