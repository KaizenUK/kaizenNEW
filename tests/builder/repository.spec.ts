import { test, expect } from "./browser-fixture";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";

test("Unity repository handoff reviews changes and reopens for another visual edit", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.text().startsWith("REPOSITORY_WINDOW_ERROR "))
      browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.addEventListener("error", (event) => {
      console.error(
        "REPOSITORY_WINDOW_ERROR " +
          JSON.stringify({
            message: event.message,
            url: location.href,
            ready: document.readyState,
            visibility: document.visibilityState,
          }),
      );
    });
  });
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-browser-repository-"));
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  const packageSource = JSON.stringify({
    type: "module",
    dependencies: {
      astro: "7.3.2",
      "@astrojs/react": "6.0.5",
      react: "19.2.4",
      "react-dom": "19.2.4",
      htmlparser2: "12.0.0",
    },
  });
  await writeFile(path.join(root, "package.json"), packageSource);
  await writeFile(
    path.join(root, "src/pages/existing.astro"),
    "<p>Uncommitted existing route</p>",
  );
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "Repository browser fixture" },
    })
  ).json();
  const document = newDocument("Client About", "about", false);
  const text = starterBlocks.Text();
  text.props.text = "Editable before handoff";
  document.data.content = [text];
  expect(
    (
      await page.request.post(`/__builder-local?project=${project.id}`, {
        headers: { "X-Kaizen-Builder": "1" },
        data: { action: "save", id: crypto.randomUUID(), version: 0, document },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/builder/?project=${project.id}`);
  await page
    .getByRole("button", { name: "Export & handoff", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Website folder on this computer" })
    .fill(root);
  await page.getByRole("button", { name: "Check folder", exact: true }).click();
  await expect(page.locator(".builder-repository")).toContainText(
    "code-managed",
  );
  await page
    .getByRole("button", {
      name: "Add builder pages to this folder",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Changes to apply" }),
  ).toBeVisible();
  await expect(
    readFile(path.join(root, "src/pages/about.astro")),
  ).rejects.toThrow();
  await page.screenshot({
    path: "test-results/repository-unity-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Apply changes to the folder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Files applied");
  expect(
    await readFile(path.join(root, "src/pages/existing.astro"), "utf8"),
  ).toBe("<p>Uncommitted existing route</p>");
  expect(await readFile(path.join(root, "package.json"), "utf8")).toBe(
    packageSource,
  );
  await page
    .getByRole("button", {
      name: "Open folder as a new project",
      exact: true,
    })
    .click();
  await expect(page).not.toHaveURL(new RegExp(`project=${project.id}`));
  await page.getByRole("button").filter({ hasText: "/about/" }).click();
  const canvas = page.frameLocator("#preview-frame");
  await canvas.locator(`[data-puck-component="${text.props.id}"]`).click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Visual edit after reopening the repository");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".builder-save-status")).toContainText(
    "Saved",
  );
  await page
    .getByRole("button", { name: "Back to pages", exact: true })
    .click();
  await page.getByRole("button").filter({ hasText: "/about/" }).click();
  await expect(
    page
      .frameLocator("#preview-frame")
      .getByText("Visual edit after reopening the repository"),
  ).toBeVisible();
  for (const width of [390, 1440, 768, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
  }
  await expect(
    page
      .frameLocator("#preview-frame")
      .getByText("Visual edit after reopening the repository"),
  ).toBeVisible();
  await page.close();
  expect(browserErrors).toEqual([]);
});
