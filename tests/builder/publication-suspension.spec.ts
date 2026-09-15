import { expect, test } from "./browser-fixture";

test("explains a paused website and leaves only taking it offline available", async ({
  page,
}) => {
  await page.goto("/builder/");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const destination = {
    projectId: crypto.randomUUID(),
    destinationId: crypto.randomUUID(),
    environment: "production",
    label: "Client website",
    origin: "https://client.example.test",
  };
  const rows = [
    {
      id: crypto.randomUUID(),
      destination,
      action: "publish",
      phase: "live",
      active: true,
      artifactId: "current",
      previousReleaseId: null,
      log: "Fixture deployment completed.",
      createdAt: "2026-09-14T10:00:00Z",
      updatedAt: "2026-09-14T10:00:00Z",
    },
    {
      id: crypto.randomUUID(),
      destination,
      action: "publish",
      phase: "live",
      active: false,
      availability: "retained",
      artifactId: "earlier",
      previousReleaseId: null,
      log: "Fixture deployment completed.",
      createdAt: "2026-09-13T10:00:00Z",
      updatedAt: "2026-09-13T10:00:00Z",
    },
  ];
  await page.evaluate(async (rows) => {
    const file = "/tests/builder/release-harness.tsx";
    const { mountClientReleaseStatuses } = await import(file);
    await mountClientReleaseStatuses(rows, {
      state: "suspended",
      since: "2026-09-15T09:00:00Z",
    });
  }, rows);
  const notice = page.getByRole("alert").filter({
    hasText: "Publishing is paused for this website",
  });
  await expect(notice).toContainText("drafts and files are kept");
  await page
    .getByRole("combobox", { name: "Choose destination" })
    .selectOption(destination.destinationId);
  await expect(
    page.getByRole("button", { name: "Review saved project for publication" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review restoring this release" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Take website offline…" }),
  ).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await notice.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/builder-publication-paused-${width}.png`,
    });
  }
});
