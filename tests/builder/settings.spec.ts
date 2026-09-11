import { test, expect } from "./browser-fixture";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

test("client settings persist independently and copied projects disconnect services", async ({
  page,
}) => {
  const headers = { "X-Kaizen-Builder": "1" };
  const create = async (name: string) => {
    const response = await page.request.post("/__builder-projects", {
      headers,
      data: { action: "create", name },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const alpha = await create("Settings Alpha"),
    beta = await create("Settings Beta");
  const document = newDocument("Enquiries", "contact", false);
  document.data.content = [starterBlocks.ContactForm()];
  expect(
    (
      await page.request.post(`/__builder-local?project=${alpha.id}`, {
        headers,
        data: { action: "save", version: 0, id: crypto.randomUUID(), document },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/builder/?project=${alpha.id}`);
  await page
    .getByRole("button", { name: "Client settings", exact: true })
    .click();
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://alpha.example");
  await page
    .getByLabel("Public form receiver", { exact: true })
    .fill("https://forms.alpha.example/enquiries");
  await page
    .getByRole("button", { name: "Save client settings", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Client settings saved");
  await page.screenshot({
    path: "test-results/client-settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/client-settings-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page
    .getByRole("button", { name: "Client settings", exact: true })
    .click();
  await expect(page.getByLabel("Website URL", { exact: true })).toHaveValue(
    "https://alpha.example",
  );
  const copied = await page.request.post("/__builder-projects", {
    headers,
    data: { action: "duplicate", id: alpha.id, name: "Settings copy" },
  });
  expect(copied.ok()).toBeTruthy();
  const copy = await (
    await page.request.get(
      `/__builder-local?project=${(await copied.json()).id}`,
    )
  ).json();
  expect(copy.settings.value.siteUrl).toBe("");
  expect(copy.settings.value.formEndpoint).toBe("");
  expect(
    (
      await (
        await page.request.get(`/__builder-local?project=${beta.id}`)
      ).json()
    ).settings,
  ).toBeUndefined();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "/contact/" }).click();
  const canvas = page.frameLocator("#preview-frame");
  await expect(canvas.locator("form[data-kb-contact]")).toHaveCount(1);
  // Client editor previews cannot post into the preserved Kaizen form receiver.
  await expect(canvas.locator("form[data-kb-contact]")).not.toHaveAttribute(
    "data-endpoint",
    /__builder-contact/,
  );
});
