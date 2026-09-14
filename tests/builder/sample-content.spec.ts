import { test, expect } from "./browser-fixture";

test("starter illustrations import with their licence and keep it through reimport", async ({
  page,
}) => {
  const headers = { "X-Kaizen-Builder": "1" };
  const project = await (
    await page.request.post("/__builder-projects", {
      headers,
      data: { action: "create", name: "Starter sample fixture" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const importer = page.getByRole("button", {
    name: "Import assets",
    exact: true,
  });
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await page
    .getByRole("textbox", { name: "Pack name", exact: true })
    .fill("Starter illustrations");
  const samples = page.getByRole("button", {
    name: "Import starter illustrations",
    exact: true,
  });
  await samples.click();
  await expect(page.locator(".builder-import-status")).toContainText(
    "0 errors",
  );
  const workspace = async () =>
    (await page.request.get(`/__builder-local?project=${project.id}`)).json();
  const first = await workspace();
  expect(first.assets).toHaveLength(3);
  expect(
    first.assets.every((asset) => asset.pack === "Starter illustrations"),
  ).toBe(true);
  const licence = first.assets.find((asset) => asset.kind === "licence");
  expect(licence.path).toBe("licences/LICENCE-Kaizen-illustrations.txt");
  const response = await page.request.get(licence.url);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain(
    "You may use them in your Kaizen pages.",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/launch-samples-${width}.png`,
      fullPage: true,
    });
  }
  if ((await importer.getAttribute("aria-expanded")) === "false")
    await importer.click();
  await samples.click();
  await expect(page.locator(".builder-import-status")).toContainText(
    "0 errors",
  );
  expect((await workspace()).assets).toEqual(first.assets);
});
