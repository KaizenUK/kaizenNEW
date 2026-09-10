import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a visually built contact form validates, survives a lost acknowledgement and saves once", async ({
  page,
  context,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8),
    slug = `contact-demo-${suffix}`;
  await page.goto("/builder/");
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  const canvas = page.frameLocator("#preview-frame");
  const source = page.getByRole("button", {
    name: "Contact form",
    exact: true,
  });
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox(),
    to = await canvas.locator("[data-puck-dropzone]").first().boundingBox();
  await page.mouse.move(from!.x + 12, from!.y + 12);
  await page.mouse.down();
  await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 3 });
  await page.mouse.move(
    to!.x + to!.width / 2,
    to!.y + Math.min(50, to!.height / 2),
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(canvas.locator(".kb-contactform")).toHaveCount(1);
  await canvas.locator("[data-puck-component]").first().click();
  await page
    .getByRole("textbox", { name: "Heading", exact: true })
    .fill("Tell us about your idea");
  await page
    .getByRole("textbox", { name: "Success message", exact: true })
    .fill("Thanks — your idea is safely with us.");
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill(`Contact demonstration ${suffix}`);
  await page.getByRole("textbox", { name: "Page URL", exact: true }).fill(slug);
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: `/${slug}/` })
    .click();
  await expect(
    canvas.getByRole("heading", { name: "Tell us about your idea" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Published page preview"]');
  await preview
    .getByLabel("First name (required)", { exact: true })
    .fill("Preview");
  await preview
    .getByLabel("Email (required)", { exact: true })
    .fill("preview@example.org");
  await preview
    .getByLabel("Message (required)", { exact: true })
    .fill("This must not be submitted");
  await preview.getByRole("checkbox").check();
  await preview.getByRole("button", { name: "Send message" }).click();
  await expect(preview.getByRole("status")).toContainText(
    "no message was sent",
  );
  await page
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator(".builder-toast")).toContainText(/publish/i);
  const live = await context.newPage();
  await live.setViewportSize({ width: 390, height: 844 });
  await live.goto(`/${slug}/`);
  const form = live.getByRole("form", { name: "Contact us", exact: true });
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(
    form.getByLabel("First name (required)", { exact: true }),
  ).toBeFocused();
  await form
    .getByLabel("First name (required)", { exact: true })
    .fill("Browser");
  await form
    .getByLabel("Email (required)", { exact: true })
    .fill(`builder-${suffix}@example.org`);
  await form
    .getByLabel("Message (required)", { exact: true })
    .fill("Please discuss my new site.");
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("checkbox")).toBeFocused();
  await form.getByRole("checkbox").check();
  await expect
    .poll(() => live.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await live.screenshot({
    path: "test-results/builder-contact-mobile.png",
    fullPage: true,
  });
  const submitted: string[] = [];
  await live.route("**/__builder-contact", async (route) => {
    submitted.push(route.request().postDataJSON().request_id);
    if (submitted.length === 1) {
      // Receiver commits, then the acknowledgement is lost. A retry must not send a second enquiry.
      expect((await route.fetch()).ok()).toBeTruthy();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"lost acknowledgement"}',
      });
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("status")).toContainText("couldn’t confirm");
  await expect(
    form.getByLabel("Message (required)", { exact: true }),
  ).toHaveValue("Please discuss my new site.");
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "Thanks — your idea is safely with us.",
  );
  expect(submitted).toHaveLength(2);
  expect(submitted[0]).toBe(submitted[1]);
  const stored = JSON.parse(
    await readFile(
      "test-results/builder-browser-workspace/contact-submissions.json",
      "utf8",
    ),
  );
  const matching = stored.filter((item) => item.id === submitted[0]);
  expect(matching).toHaveLength(1);
  expect(matching[0].record).toMatchObject({
    email: `builder-${suffix}@example.org`,
    consent_to_gdpr: true,
    marketing_consent: false,
    source_page: `/${slug}/`,
  });
  expect(
    stored.some((item) => item.record.message === "This must not be submitted"),
  ).toBe(false);
});
