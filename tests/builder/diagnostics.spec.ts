import { test, expect } from "./browser-fixture";
import { readFile } from "node:fs/promises";

test("private beta settings copy a safe problem report and offer a matching download", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/builder/");
  await expect(page.getByText("Private beta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const api = await import("/client/visual-builder/diagnostics.ts" as string);
    api.setDiagnosticPage({
      screen: "website-editor",
      route: "/about/?token=fixture-private-token",
    });
    api.recordBuilderError(
      new Error("Build failed with fixture-private-token"),
      "helper",
    );
  });
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await expect(page.getByText(/Report copied/)).toBeVisible();
  const reportText = await page.evaluate(() => navigator.clipboard.readText());
  const report = JSON.parse(reportText);
  expect(report.projectId).toBe("kaizen");
  expect(report.page.screen).toBe("website-editor");
  expect(report.page.routeHash).toMatch(/^[0-9a-f]{64}$/);
  expect(report.lastError.category).toBe("build");
  expect(reportText).not.toContain("fixture-private-token");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download report", exact: true })
    .click();
  expect(await readFile((await (await download).path())!, "utf8")).toBe(
    reportText,
  );
  await page.screenshot({
    path: "test-results/launch-beta-settings-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Settings", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page.screenshot({
    path: "test-results/launch-beta-settings-phone.png",
  });
});

test("a failed workspace can still produce a report when clipboard access is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
      configurable: true,
    }),
  );
  await page.route("**/__builder-local?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Network failed: fixture-private-key" }),
    }),
  );
  await page.goto("/builder/");
  await expect(
    page
      .getByText("Network failed: fixture-private-key", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/Project details are unavailable/)).toBeVisible();
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await expect(page.getByText(/Download it instead/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download report", exact: true })
    .click();
  const text = await readFile((await (await download).path())!, "utf8");
  expect(JSON.parse(text).lastError.category).toBe("network");
  expect(text).not.toContain("fixture-private-key");
});
