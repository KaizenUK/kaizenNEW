import { expect, test } from "./browser-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";
import { initialSiteDesign } from "../../shared/builderSite";
import { type Workspace } from "../../shared/visualBuilder";
import {
  conversionDraft,
  availableRegistration,
} from "../../shared/builderConversions";
import { exampleCardRequirements } from "../../shared/builderRegistry";

test("download an editable project, restore into an empty workspace and edit its linked responsive pages", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const workspaceFile = "test-results/builder-browser-workspace/workspace.json";
  // This test temporarily replaces only the explicitly isolated browser fixture. Original personal data is never read or written.
  const previous = await readFile(workspaceFile, "utf8").catch(
    () => '{"pages":[],"assets":[],"saved":[]}',
  );
  const empty = JSON.stringify({ pages: [], assets: [], saved: [] });
  const api = async (data?: unknown): Promise<any> => {
    const response = data
      ? await page.request.post("/__builder-local", {
          headers: { "X-Kaizen-Builder": "1" },
          data,
        })
      : await page.request.get("/__builder-local");
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  try {
    await writeFile(workspaceFile, empty);
    await page.goto("/builder/");
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("button", { name: "Try the sample asset pack", exact: true })
      .click();
    await expect(page.locator(".builder-import-status")).toContainText(
      "0 errors",
    );
    let workspace: Workspace = await api();
    const code = workspace.assets.find(
      (asset) => asset.name === "ExampleCard.tsx",
    )!;
    const conversion = {
      ...conversionDraft(code, workspace.assets),
      requirements: { ...exampleCardRequirements },
      status: "needs_review",
    };
    await api({
      action: "asset-conversion",
      expected: code,
      draft: conversion,
    });
    const source = workspace.assets.find(
      (asset) => asset.name === "kaizen-logo.png",
    )!;
    const design = initialSiteDesign(),
      menu = starterBlocks.Menu();
    menu.props.text = "Backup Studio";
    design.theme.accent = "#334455";
    design.components = [
      {
        id: "backup-header",
        name: "Backup header",
        kind: "header",
        blocks: [menu],
      },
      {
        id: "backup-footer",
        name: "Backup footer",
        kind: "footer",
        blocks: [starterBlocks.Footer()],
      },
    ];
    await api({ action: "site", version: 0, design });
    for (const [index, title] of ["Welcome", "Our work", "Enquire"].entries()) {
      const document = newDocument(title, `backup-page-${index}`, false),
        text = starterBlocks.Text(),
        image = starterBlocks.Image();
      text.props.text = `Editable ${title}`;
      image.props.src = source.url;
      image.props.style = { desktop: { maxWidth: 480 }, mobile: { width: 80 } };
      document.data.content = [
        text,
        image,
        starterBlocks.Registered(),
        ...(index === 2 ? [starterBlocks.ContactForm()] : []),
      ];
      document.site = {
        useTheme: true,
        headerId: "backup-header",
        footerId: "backup-footer",
      };
      await api({
        action: "save",
        id: index === 0 ? workspace.pages[0].id : crypto.randomUUID(),
        version: index === 0 ? workspace.pages[0].version : 0,
        document,
      });
    }
    await api({
      action: "saved",
      item: {
        id: crypto.randomUUID(),
        name: "Reusable image",
        kind: "section",
        blocks: [
          {
            ...starterBlocks.Image(),
            props: {
              id: crypto.randomUUID(),
              src: source.url,
              alt: "Reusable",
            },
          },
        ],
      },
    });
    workspace = await api();
    await api({
      action: "publish-site",
      version: workspace.site!.version,
      pageVersions: Object.fromEntries(
        workspace.pages.map((item) => [item.id, item.version]),
      ),
    });
    await page.goto("/builder/");
    await page
      .getByRole("button", { name: "Project backups", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download editable backup", exact: true })
      .click();
    const archive = await download;
    const filename = "test-results/builder-editable-project.zip";
    await archive.saveAs(filename);
    await expect(page.getByRole("status")).toContainText(
      "Backup downloaded: 3 pages",
    );
    const files = unzipSync(await readFile(filename)),
      manifest = JSON.parse(strFromU8(files["project.json"]));
    expect(manifest.workspace.pages).toHaveLength(3);
    expect(manifest.workspace.site.draft.components).toHaveLength(2);
    expect(manifest.workspace.saved).toHaveLength(1);
    expect(manifest.files.length).toBe(workspace.assets.length);
    // A fresh workspace has no registered files or publications. Restoration must re-upload bytes and remap references.
    await writeFile(workspaceFile, empty);
    await page.reload();
    await page
      .getByRole("button", { name: "Project backups", exact: true })
      .click();
    await page
      .getByLabel("Project backup file", { exact: true })
      .setInputFiles(filename);
    await expect(
      page.getByRole("region", { name: "Backup restore review" }),
    ).toContainText("3 pages");
    await expect(
      page.getByRole("region", { name: "Backup restore review" }),
    ).toContainText("Add as a draft");
    await page.screenshot({ path: "test-results/builder-backup-review.png" });
    await page
      .getByRole("button", { name: "Restore drafts", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Restored 3 editable page drafts",
      { timeout: 60_000 },
    );
    const restored: Workspace = await api();
    expect(restored.pages.every((item) => !item.published)).toBe(true);
    expect(restored.site!.published).toBeNull();
    expect(restored.site!.draft).toEqual(design);
    expect(restored.assets).toHaveLength(workspace.assets.length);
    const restoredCode = restored.assets.find(
      (asset) => asset.name === code.name,
    )!;
    expect(restoredCode.id).not.toBe(code.id);
    expect(
      restoredCode.conversion!.sources.some(
        (source) => source.assetId === code.id,
      ),
    ).toBe(false);
    expect(availableRegistration(restoredCode, restored.assets)?.id).toBe(
      "example-card-v1",
    );
    const restoredImage = restored.assets.find(
      (asset) => asset.name === source.name,
    )!;
    expect(restoredImage.id).not.toBe(source.id);
    expect(restoredImage.image?.source).toBe(restoredImage.url);
    expect(restoredImage.image?.variants.length).toBe(
      source.image?.variants.length,
    );
    for (const variant of restoredImage.image?.variants || []) {
      expect(
        source.image!.variants.some((old) => old.url === variant.url),
      ).toBe(false);
      expect(
        restored.assets.find((asset) => asset.url === variant.url)
          ?.generatedFrom,
      ).toBe(restoredImage.url);
      expect((await page.request.get(variant.url)).ok()).toBeTruthy();
    }
    for (const item of restored.pages)
      expect(item.draft.data.content[1].props.src).toBe(restoredImage.url);
    expect(restored.saved[0].blocks[0].props.src).toBe(restoredImage.url);
    expect((await page.request.get(restoredImage.url)).ok()).toBeTruthy();
    expect(restored.assets.some((asset) => asset.kind === "design")).toBe(true);
    expect(restored.assets.some((asset) => asset.kind === "licence")).toBe(
      true,
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button")
      .filter({ hasText: "/backup-page-0/" })
      .click();
    const canvas = page.frameLocator("#preview-frame");
    await expect(canvas.locator(".kb-menu-brand")).toHaveText("Backup Studio");
    await canvas.getByText("Editable Welcome", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Text", exact: true })
      .fill("Changed after restoring");
    await expect(
      canvas.getByText("Changed after restoring", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    const restoredImageNode = canvas.locator(
      `[data-block-id="${restored.pages.find((item) => item.draft.slug === "backup-page-0")!.draft.data.content[1].props.id}"]`,
    );
    await expect
      .poll(() =>
        restoredImageNode.evaluate((node) => {
          const parent = node.parentElement!,
            style = getComputedStyle(parent);
          const available =
            parent.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
          return Math.round(
            (parseFloat(getComputedStyle(node).width) / available) * 100,
          );
        }),
      )
      .toBe(80);
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await page
      .getByRole("button")
      .filter({ hasText: "/backup-page-0/" })
      .click();
    await expect(
      canvas.getByText("Changed after restoring", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/builder-backup-restored-editor.png",
    });
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
  } finally {
    await page.close();
    await writeFile(workspaceFile, previous);
  }
});
