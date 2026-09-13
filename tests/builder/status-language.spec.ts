import { test, expect } from "./browser-fixture";
import { newDocument } from "../../client/visual-builder/starters";
import type { ClientPublicationJob } from "../../shared/builderClientPublication";

test("saved pages keep their badge on a phone and the editor waits for acknowledgement before saying Saved", async ({
  page,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Status language" },
    })
  ).json();
  const saved = await (
    await page.request.post(`/__builder-local?project=${project.id}`, {
      headers: { "X-Kaizen-Builder": "1" },
      data: {
        action: "save",
        id: crypto.randomUUID(),
        version: 0,
        document: newDocument("Status example", "status-example", false),
      },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  const row = page.getByRole("button").filter({ hasText: "/status-example/" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(row.locator(".builder-pill")).toHaveText("Saved");
    await expect(row.locator(".builder-pill")).toBeVisible();
    await expect(row.locator(".builder-page-row-title")).toBeVisible();
    expect(
      await row
        .locator(".builder-page-row-title")
        .evaluate(
          (element) =>
            element.clientWidth > 0 &&
            element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await row.screenshot({
      path: `test-results/l3-status-page-saved-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await row.click();
  await page.getByRole("button", { name: "Page", exact: true }).click();
  let release = () => {},
    received = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__builder-local?*", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.action === "save"
    ) {
      received = true;
      await gate;
    }
    await route.fallback();
  });
  try {
    await page
      .getByLabel("Page title", { exact: true })
      .fill("A changed status example");
    await expect.poll(() => received).toBe(true);
    await expect(page.locator(".builder-save-status")).toHaveText("Draft");
    await expect(page.locator(".builder-canvas-footnote")).toContainText(
      "Draft",
    );
    expect(
      (
        await (
          await page.request.get(`/__builder-local?project=${project.id}`)
        ).json()
      ).pages.find((p) => p.id === saved.id).draft.title,
    ).toBe("Status example");
    await page.screenshot({
      path: "test-results/l3-status-editor-draft-1440.png",
    });
    release();
    await expect(page.locator(".builder-save-status")).toHaveText("Saved");
    await expect(page.locator(".builder-canvas-footnote")).toContainText(
      "Saved",
    );
    await page.screenshot({
      path: "test-results/l3-status-editor-saved-1440.png",
    });
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await expect(row).toContainText("A changed status example");
    await expect(row.locator(".builder-pill")).toHaveText("Saved");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("release cards distinguish staging, production, earlier and offline versions at both widths", async ({
  page,
}) => {
  await page.goto("/builder/");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const projectId = crypto.randomUUID();
  const rows: ClientPublicationJob[] = [
    "staging",
    "production",
    "earlier",
    "offline",
  ].map((kind, index) => ({
    id: crypto.randomUUID(),
    action: kind === "offline" ? "unpublish" : "publish",
    phase: "live",
    active: kind !== "earlier",
    artifactId: `fixture-${index}`,
    previousReleaseId: null,
    log: "Fixture deployment completed.",
    createdAt: "2026-09-14T10:00:00Z",
    updatedAt: "2026-09-14T10:00:00Z",
    destination: {
      projectId,
      destinationId: crypto.randomUUID(),
      environment: kind === "staging" ? "staging" : "production",
      label: `${kind} example`,
      origin: `https://${kind}.example.test`,
    },
  }));
  await page.evaluate(async (rows) => {
    const file = "/tests/builder/release-harness.tsx";
    const { mountClientReleaseStatuses } = await import(file);
    await mountClientReleaseStatuses(rows);
  }, rows);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [index, label] of [
      "On staging",
      "Live",
      "Earlier release",
      "Offline",
    ].entries()) {
      const row = page.locator(`[data-release-id="${rows[index].id}"]`);
      await expect(row.getByRole("status")).toHaveText(label);
      await row.screenshot({
        path: `test-results/l3-status-release-${index}-${width}.png`,
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("Saved includes new pages and newer saved changes while Live includes only the current baseline", async ({
  page,
}) => {
  await page.goto("/builder/");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const baseline = "2026-09-14T10:00:00.000Z";
  const pages = ["new", "changed", "live"].map((kind) => {
    const draft = newDocument(`${kind} example`, `${kind}-status`, false);
    return {
      id: crypto.randomUUID(),
      version: 1,
      revisions: [],
      draft,
      published: kind === "new" ? null : draft,
      publishedAt: kind === "new" ? undefined : baseline,
      updatedAt: kind === "changed" ? "2026-09-14T10:00:00.001Z" : baseline,
    };
  });
  await page.evaluate(async (pages) => {
    const file = "/tests/builder/release-harness.tsx";
    const { mountStatusPages } = await import(file);
    await mountStatusPages(pages);
  }, pages);
  const filter = page.getByRole("group", { name: "Filter pages" });
  await filter.getByRole("button", { name: "Saved 2", exact: true }).click();
  await expect(page.locator(".builder-page-row")).toHaveCount(2);
  await expect(page.locator(".builder-page-row-title")).toHaveText([
    "changed example",
    "new example",
  ]);
  await filter.getByRole("button", { name: "Live 1", exact: true }).click();
  await expect(page.locator(".builder-page-row-title")).toHaveText([
    "live example",
  ]);
  await expect(page.locator(".builder-page-row .builder-pill")).toHaveText(
    "Live",
  );
});
