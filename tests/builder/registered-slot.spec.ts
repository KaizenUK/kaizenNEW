import { test, expect } from "@playwright/test";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";
import { registeredDefaults } from "../../shared/builderRegistry";

test("registered content slots retain nested visual edits through save and reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const document = newDocument(
    "Registered content",
    `registered-${crypto.randomUUID().slice(0, 8)}`,
    false,
  );
  const panel = starterBlocks.Registered();
  const child = starterBlocks.Text();
  child.props.text = "Nested copy before editing";
  panel.props = {
    ...panel.props,
    ...registeredDefaults("content-panel-v1"),
    children: [child],
  };
  document.data.content = [panel];
  const id = crypto.randomUUID();
  const saved = await page.request.post("/__builder-local", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "save", id, version: 0, document },
  });
  expect(saved.ok()).toBeTruthy();
  await page.goto("/builder/");
  await page
    .getByRole("button")
    .filter({ hasText: `/${document.slug}/` })
    .click();
  const frame = page.frameLocator("#preview-frame");
  await expect(
    frame.locator(".kb-content-panel [data-puck-dropzone]"),
  ).toHaveCount(1);
  await frame.getByRole("heading", { name: "Our approach" }).click();
  await page
    .getByRole("textbox", { name: "Panel heading", exact: true })
    .fill("A client-specific approach");
  await frame.getByText("Nested copy before editing", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Nested copy after editing");
  await expect(frame.locator(".kb-content-panel")).toContainText(
    "Nested copy after editing",
  );
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await expect(page.locator(".builder-save-status")).toContainText(
    "All changes saved",
  );
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: `/${document.slug}/` })
    .click();
  await expect(frame.locator(".kb-content-panel")).toContainText(
    "A client-specific approach",
  );
  await expect(frame.locator(".kb-content-panel")).toContainText(
    "Nested copy after editing",
  );
  const workspace = await (await page.request.get("/__builder-local")).json();
  const persisted = workspace.pages.find((item) => item.id === id).draft.data
    .content[0];
  expect(persisted.props.registrationId).toBe("content-panel-v1");
  expect(persisted.props.children[0].props.id).toBe(child.props.id);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Published page preview"]')
      .locator(".kb-content-panel"),
  ).toContainText("Nested copy after editing");
  expect(errors).toEqual([]);
});
