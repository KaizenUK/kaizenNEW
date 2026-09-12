import { expect, test } from "./browser-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { type Workspace } from "../../shared/visualBuilder";

test("save a developer brief, reuse a reviewed component and publish its responsive edits", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const file = "test-results/builder-browser-workspace/workspace.json";
  const previous: Workspace = JSON.parse(
    await readFile(file, "utf8").catch(
      () => '{"pages":[],"assets":[],"saved":[]}',
    ),
  );
  const slug = `reviewed-card-${crypto.randomUUID().slice(0, 8)}`;
  let result: Workspace | undefined;
  const api = async () => {
    const response = await page.request.get("/__builder-local");
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<Workspace>;
  };
  try {
    await writeFile(file, JSON.stringify({ pages: [], assets: [], saved: [] }));
    await page.goto("/builder/");
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Pack name", exact: true })
      .fill(slug);
    await page
      .getByRole("button", { name: "Try the sample asset pack", exact: true })
      .click();
    await expect(page.locator(".builder-import-status")).toContainText(
      "0 errors",
    );
    await page
      .getByRole("button", { name: "Inspect ExampleCard.tsx", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "React block conversion" });
    await expect(
      panel.getByRole("button", { name: "Use reviewed block", exact: true }),
    ).toHaveCount(0);
    await panel
      .getByLabel("What should this block do?", { exact: true })
      .fill("An editable project card");
    await panel
      .getByLabel("Developer notes", { exact: true })
      .fill("Retain the supplied source and licences.");
    let releaseSave!: () => void,
      delayed = false;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const localApi = (url: URL) => url.pathname === "/__builder-local";
    await page.route(localApi, async (route) => {
      if (
        !delayed &&
        route.request().method() === "POST" &&
        route.request().postDataJSON()?.action === "asset-conversion"
      ) {
        delayed = true;
        const response = await route.fetch();
        await saveGate;
        await route.fulfill({ response });
      } else await route.continue();
    });
    await panel
      .getByRole("button", { name: "Save conversion request", exact: true })
      .click();
    await expect(
      panel.getByRole("button", {
        name: "Save conversion request",
        exact: true,
      }),
    ).toBeDisabled();
    await panel
      .getByLabel("Developer notes", { exact: true })
      .fill("Keep these newer notes while saving.");
    releaseSave();
    await expect(panel).toContainText("Saved version 1");
    await expect(
      panel.getByLabel("Developer notes", { exact: true }),
    ).toHaveValue("Keep these newer notes while saving.");
    await panel
      .getByRole("button", { name: "Save conversion request", exact: true })
      .click();
    await expect(panel).toContainText("Saved version 2");
    await page.unroute(localApi);
    const original = (await api()).assets.find(
      (asset) => asset.name === "ExampleCard.tsx",
    )!;
    expect(original.conversion!.sources).toHaveLength(3);
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page.reload();
    const first = (await api()).pages[0];
    await page
      .getByRole("button")
      .filter({ hasText: `/${first.draft.slug}/` })
      .click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("button", { name: "Inspect ExampleCard.tsx", exact: true })
      .click();
    await expect(
      panel.getByLabel("What should this block do?", { exact: true }),
    ).toHaveValue("An editable project card");
    await panel
      .getByRole("button", {
        name: "Use reviewed sample requirements",
        exact: true,
      })
      .click();
    await panel
      .getByLabel("Conversion status", { exact: true })
      .selectOption("needs_review");
    const download = page.waitForEvent("download");
    await panel
      .getByRole("button", { name: "Save and export brief", exact: true })
      .click();
    await (await download).saveAs("test-results/builder-conversion-brief.md");
    expect(
      await readFile("test-results/builder-conversion-brief.md", "utf8"),
    ).toContain(original.hash);
    await expect(panel).toContainText("Reviewed block available");
    await page
      .getByLabel("Filter conversions", { exact: true })
      .selectOption("available");
    await expect(page.locator(".builder-asset")).toHaveCount(1);
    await page.screenshot({
      path: "test-results/builder-conversion-reviewed.png",
    });
    await panel
      .getByRole("button", { name: "Use reviewed block", exact: true })
      .click();
    const frame = page.frameLocator("#preview-frame");
    await frame.locator(".kb-reviewed-card").click();
    await page
      .getByRole("textbox", { name: "Card text", exact: true })
      .fill("A reviewed and editable card");
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    await page
      .getByRole("spinbutton", { name: "mobile All padding", exact: true })
      .fill("12");
    await expect(frame.locator(".kb-reviewed-card").locator("..")).toHaveCSS(
      "padding-left",
      "12px",
    );
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Page title", exact: true })
      .fill("Reviewed card demonstration");
    await page
      .getByRole("textbox", { name: "Page URL", exact: true })
      .fill(slug);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".builder-save-status")).toContainText(
      "All changes saved",
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish now", exact: true })
      .click();
    await expect(page.locator(".builder-toast")).toContainText(/publish/i);
    const live = await context.newPage();
    await live.setViewportSize({ width: 390, height: 844 });
    await live.goto(`/${slug}/`);
    await expect(live.locator(".kb-reviewed-card")).toHaveText(
      "A reviewed and editable card",
    );
    await expect(live.locator(".kb-reviewed-card").locator("..")).toHaveCSS(
      "padding-left",
      "12px",
    );
    await live.screenshot({
      path: "test-results/builder-conversion-mobile.png",
    });
    await live.close();
    await panel
      .getByLabel("Mobile layout", { exact: true })
      .fill("Add mobile swipe interaction");
    await panel
      .getByRole("button", { name: "Save conversion request", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Use reviewed block", exact: true }),
    ).toHaveCount(0);
    expect((await api()).pages[0].published!.data.content[0].type).toBe(
      "Registered",
    );
    await page
      .getByLabel("Filter conversions", { exact: true })
      .selectOption("");
    const design = (await api()).assets.find(
      (asset) => asset.kind === "design",
    )!;
    await page
      .getByRole("button", { name: `Inspect ${design.name}`, exact: true })
      .click();
    await panel
      .getByLabel("Conversion status", { exact: true })
      .selectOption("needs_review");
    await panel
      .getByRole("button", { name: "Save conversion request", exact: true })
      .click();
    await expect(panel).toContainText("No matching reviewed implementation");
    await expect(
      panel.getByRole("button", {
        name: "Use reviewed sample requirements",
        exact: true,
      }),
    ).toHaveCount(0);
    result = await api();
    await writeFile(
      "test-results/builder-conversions-fixture.json",
      JSON.stringify({ slug }),
    );
  } finally {
    await page.close();
    await writeFile(
      file,
      JSON.stringify({
        ...previous,
        pages: [...previous.pages, ...(result?.pages || [])],
        assets: [...previous.assets, ...(result?.assets || [])],
      }),
    );
  }
});
