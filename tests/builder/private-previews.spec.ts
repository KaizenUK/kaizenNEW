import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

test("saved private previews reopen immutably, use mobile layout, suppress form delivery and revoke", async ({
  page,
  context,
}) => {
  const id = crypto.randomUUID(),
    document = newDocument(
      "Private preview demonstration",
      `private-${id.slice(0, 8)}`,
      false,
    );
  const text = starterBlocks.Text();
  text.props.text = "The saved private version";
  text.props.style = { desktop: { padding: 40 }, mobile: { padding: 12 } };
  document.data.content = [text, starterBlocks.ContactForm()];
  const saved = await page.request.post("/__builder-local", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "save", id, version: 0, document },
  });
  expect(saved.ok()).toBeTruthy();
  const initial = await saved.json();
  await page.goto("/builder/");
  await page
    .getByRole("button")
    .filter({ hasText: `/${document.slug}/` })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Preview expires after" })
    .selectOption("1");
  await page
    .getByRole("button", { name: "Save private preview link", exact: true })
    .click();
  const link = page.getByRole("textbox", {
    name: "Private preview link",
    exact: true,
  });
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  expect(new URL(url).searchParams.get("preview")).toMatch(/^[0-9a-f-]{36}$/);
  const previewId = new URL(url).searchParams.get("preview")!;
  for (const filename of [`previews/${previewId}.json`, "workspace.json"])
    for (const requestPath of [
      `/test-results/builder-browser-workspace/${filename}`,
      `/test-results/builder-browser-workspace/${filename}?raw`,
      `/test-results/builder-browser-workspace/${filename}::$DATA?raw`,
      `/@fs/${path.resolve("test-results/builder-browser-workspace", filename).replaceAll("\\", "/")}?raw`,
    ]) {
      const raw = await page.request.get(requestPath);
      expect([403, 404]).toContain(raw.status());
      expect(await raw.text()).not.toContain("The saved private version");
    }
  const viewer = await context.newPage();
  let deliveries = 0;
  await viewer.route("**/__builder-contact", (route) => {
    deliveries++;
    return route.abort();
  });
  await viewer.goto(url);
  const frame = viewer.frameLocator(
    'iframe[title="Saved private page preview"]',
  );
  await expect(
    frame.getByText("The saved private version", { exact: true }),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect(
    frame.getByText("The saved private version", { exact: true }).locator(".."),
  ).toHaveCSS("padding-left", "12px");
  await frame.getByLabel("First name (required)").fill("Preview tester");
  await frame
    .getByLabel("Email (required)", { exact: true })
    .fill("preview@example.invalid");
  await frame
    .getByLabel("Message (required)", { exact: true })
    .fill("Preview validation, not a real enquiry.");
  await frame.locator('input[name="consent_to_gdpr"]').check();
  await frame
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(frame.getByRole("status")).toContainText("no message was sent");
  expect(deliveries).toBe(0);
  const changed = structuredClone(document);
  changed.data.content[0].props.text = "A later draft";
  expect(
    (
      await page.request.post("/__builder-local", {
        headers: { "X-Kaizen-Builder": "1" },
        data: {
          action: "save",
          id,
          version: initial.version,
          document: changed,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await viewer.reload();
  await expect(
    frame.getByText("The saved private version", { exact: true }),
  ).toBeVisible();
  const workspace = await (await page.request.get("/__builder-local")).json();
  expect(
    workspace.pages.find((item: any) => item.id === id).published,
  ).toBeNull();
  await viewer.screenshot({
    path: "test-results/builder-private-preview-browser.png",
    fullPage: true,
  });
  await viewer.setViewportSize({ width: 390, height: 844 });
  await viewer.getByRole("button", { name: "Mobile", exact: true }).click();
  expect(
    await viewer.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await viewer.screenshot({
    path: "test-results/builder-private-preview-mobile.png",
    fullPage: true,
  });
  const manager = await context.newPage();
  await manager.goto("/builder/");
  await manager
    .getByRole("button", { name: "Private previews", exact: true })
    .click();
  const entry = manager
    .locator("li")
    .filter({ has: manager.locator(`a[href="${url}"]`) });
  await expect(entry).toContainText("Private preview demonstration");
  await entry
    .getByRole("button", { name: "Revoke preview", exact: true })
    .click();
  await expect(entry).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke link", exact: true }).click();
  await expect(
    page.getByText("Preview revoked.", { exact: true }),
  ).toBeVisible();
  await expect(viewer.getByRole("alert")).toContainText("revoked", {
    timeout: 15000,
  });
  await expect(viewer.locator("iframe")).toHaveCount(0);
  await viewer.reload();
  await expect(viewer.getByRole("alert")).toContainText("revoked");
  expect(
    (
      await page.request.post("/__builder-local", {
        data: {
          action: "preview-read",
          id: new URL(url).searchParams.get("preview"),
        },
      })
    ).status(),
  ).toBe(405);
  await viewer.close();
  await manager.close();
});
