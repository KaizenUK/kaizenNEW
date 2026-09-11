import { expect, test } from "./browser-fixture";

test("redirect drafts survive reopening, publish both aliases, preserve queries and restore history", async ({
  page,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    source = `/retired-${suffix}/`;
  await page.goto("/builder/");
  await page
    .getByRole("button", { name: "URL redirects", exact: true })
    .click();
  await page.getByRole("button", { name: "Add redirect", exact: true }).click();
  const sources = page.getByRole("textbox", { name: /Old URL \d+/ }),
    index = await sources.count();
  await page
    .getByRole("textbox", { name: `Old URL ${index}`, exact: true })
    .fill(source);
  await page
    .getByRole("combobox", { name: `Destination ${index}`, exact: true })
    .fill("/contact/");
  await page
    .getByRole("button", { name: "Save redirect draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("draft saved");
  expect((await page.request.get(source, { maxRedirects: 0 })).status()).toBe(
    404,
  );
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "URL redirects", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: `Old URL ${index}`, exact: true }),
  ).toHaveValue(source);
  await page
    .getByRole("button", { name: "Review redirect publication", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish redirects", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "published to your local site",
  );
  for (const alias of [source, source.slice(0, -1)]) {
    const response = await page.request.get(
      `${alias}?utm_source=ui8&tag=a%20b`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe(
      "/contact/?utm_source=ui8&tag=a%20b",
    );
  }
  await page
    .getByRole("combobox", { name: `Destination ${index}`, exact: true })
    .fill("/");
  await page
    .getByRole("button", { name: "Save redirect draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("draft saved");
  expect(
    (await page.request.get(source, { maxRedirects: 0 })).headers().location,
  ).toBe("/contact/");
  await page.getByText(/^Redirect history \(/).click();
  await page
    .getByRole("button", { name: "Restore redirect draft", exact: true })
    .nth(1)
    .click();
  await expect(
    page.getByRole("combobox", { name: `Destination ${index}`, exact: true }),
  ).toHaveValue("/contact/");
  await page
    .getByRole("button", { name: "Save redirect draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("draft saved");
  await page.screenshot({
    path: "test-results/builder-redirect-editor.png",
    fullPage: true,
  });
  // Clean only the rule created by this scenario through normal user controls.
  await page
    .getByRole("button", { name: `Remove redirect ${index}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save redirect draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("draft saved");
  await page
    .getByRole("button", { name: "Review redirect publication", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish redirects", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "published to your local site",
  );
  expect((await page.request.get(source, { maxRedirects: 0 })).status()).toBe(
    404,
  );
});
