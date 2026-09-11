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
    .getByRole("button", { name: "Export & repositories", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Absolute repository folder" })
    .fill(root);
  await page
    .getByRole("button", { name: "Inspect repository", exact: true })
    .click();
  await expect(page.locator(".builder-repository")).toContainText(
    "code-managed",
  );
  await page
    .getByRole("button", { name: "Prepare file proposal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Proposed repository changes" }),
  ).toBeVisible();
  await expect(
    readFile(path.join(root, "src/pages/about.astro")),
  ).rejects.toThrow();
  await page.screenshot({
    path: "test-results/repository-unity-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Apply reviewed file changes", exact: true })
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
      name: "Reopen as a separate editable project",
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
    "All changes saved",
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
});
