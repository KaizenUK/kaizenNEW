import { expect, test } from "@playwright/test";
import { newDocument } from "../../client/visual-builder/starters";

test("release controls show observed states and require an explicit rollback/unpublish review", async ({
  page,
}) => {
  await page.goto("/builder/");
  await expect(page.getByRole("heading", { name: /Your pages/ })).toBeVisible();
  const document = newDocument(
    "Published campaign",
    "published-campaign",
    false,
  );
  const current = {
    id: crypto.randomUUID(),
    action: "page",
    status: "live",
    live: true,
    createdAt: "2026-09-10T12:00:00Z",
    updatedAt: "2026-09-10T12:00:00Z",
    artifactId: "current-artifact",
    previousReleaseId: null,
    rollbackOf: null,
    error: null,
  };
  const earlier = {
    ...current,
    id: crypto.randomUUID(),
    live: false,
    createdAt: "2026-09-09T12:00:00Z",
    artifactId: "earlier-artifact",
  };
  const draft = {
    id: crypto.randomUUID(),
    version: 3,
    draft: document,
    published: document,
    updatedAt: "2026-09-10T12:00:00Z",
    revisions: [],
  };
  // Mount the shipped panel with a controlled service boundary. No hosted authentication/deployment is claimed.
  await page.evaluate(
    async ({ rows, draft }) => {
      const modulePath = "/tests/builder/release-harness.tsx";
      const { mountReleasePanel } = await import(modulePath);
      mountReleasePanel(rows, draft);
    },
    { rows: [current, earlier], draft },
  );
  await expect(
    page.getByRole("heading", { name: "Releases", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Live now", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Review rollback", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Review release action" }),
  ).toContainText("entire public site");
  expect(
    await page.evaluate(() => (window as any).__releaseTest.calls.length),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Queue rollback", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).__releaseTest.calls[0]),
  ).toMatchObject({ action: "rollback", targetId: earlier.id });
  await page
    .getByRole("button", { name: "Review unpublish", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Review release action" }),
  ).toContainText("/published-campaign/");
  await page
    .getByRole("button", { name: "Queue unpublish", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).__releaseTest.calls[1]),
  ).toMatchObject({ action: "unpublish", id: draft.id, version: 3 });
  await page.evaluate(() => {
    const state = (window as any).__releaseTest;
    state.rows.unshift({
      ...state.rows[0],
      id: crypto.randomUUID(),
      live: false,
      status: "verifying",
    });
  });
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(
    page.getByText("Checking the live site", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review rollback" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review unpublish" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    const state = (window as any).__releaseTest;
    state.rows[0].status = "recovery_required";
    state.rows[0].error =
      "The serving release could not be reconciled. Inspect the worker transaction.";
  });
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(
    page.getByText("Recovery needs attention", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/builder-release-status-browser.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/builder-release-status-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as any).__releaseTest.error = true;
  });
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
});
