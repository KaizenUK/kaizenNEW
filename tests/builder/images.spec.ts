import { expect, test } from "./browser-fixture";
import { BUILDER_TEST_ORIGIN } from "./ports";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { starterBlocks } from "../../client/visual-builder/starters";
import type { Asset, Workspace } from "../../shared/visualBuilder";

test("optimised images retain originals and smaller mobile files through editing, publication and export", async ({
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
  const slug = `image-quality-${crypto.randomUUID().slice(0, 8)}`;
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
  let result: Workspace | undefined;
  try {
    await writeFile(file, JSON.stringify({ pages: [], assets: [], saved: [] }));
    await page.goto("/builder/");
    const encoded = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 3200;
      canvas.height = 1800;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, 3200, 1800);
      gradient.addColorStop(0, "#23537b");
      gradient.addColorStop(1, "#edbe70");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 3200, 1800);
      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = `hsla(${i * 17},60%,50%,0.2)`;
        ctx.beginPath();
        ctx.arc(
          (i * 137) % 3200,
          (i * 97) % 1800,
          80 + (i % 50),
          0,
          2 * Math.PI,
        );
        ctx.fill();
      }
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const bytes = Buffer.from(encoded, "base64"),
      hash = createHash("sha256").update(bytes).digest("hex");
    await page.getByRole("button", { name: "Blank page", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Pack name", exact: true })
      .fill(slug);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "wide-landscape.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await expect(page.locator(".builder-import-status")).toContainText(
      "0 errors",
      { timeout: 60_000 },
    );
    let workspace: Workspace = await api();
    const asset = workspace.assets.find((item) => !item.generatedFrom)!;
    expect(asset.hash).toBe(hash);
    expect(asset.image).toMatchObject({
      source: asset.url,
      status: "ready",
      width: 3200,
      height: 1800,
    });
    expect(asset.image!.variants.map((item) => item.width)).toEqual([
      320, 640, 1280, 1920, 2560,
    ]);
    expect(
      workspace.assets.filter((item) => item.generatedFrom === asset.url),
    ).toHaveLength(5);
    expect(await (await page.request.get(asset.url)).body()).toEqual(bytes);
    for (const variant of asset.image!.variants) {
      const response = await page.request.get(variant.url),
        body = await response.body();
      expect(response.headers()["content-type"]).toContain("image/webp");
      expect(body.length).toBeLessThan(bytes.length);
      expect(createHash("sha256").update(body).digest("hex")).toBe(
        variant.hash,
      );
    }
    await expect(page.locator(".builder-asset")).toHaveCount(1);
    await expect(page.locator(".builder-asset img").first()).toHaveAttribute(
      "src",
      asset.image!.variants[0].url,
    );
    await page
      .getByRole("button", { name: "Use wide-landscape.png", exact: true })
      .click();
    await page.getByRole("button", { name: "Page", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Page title", exact: true })
      .fill("Image quality demonstration");
    await page
      .getByRole("textbox", { name: "Page URL", exact: true })
      .fill(slug);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".builder-save-status")).toContainText(
      "Saved",
    );
    workspace = await api();
    // Add a background fixture to exercise responsive CSS alongside the image placed through the UI.
    await page.reload();
    const saved = workspace.pages[0],
      background = starterBlocks.Section();
    background.props.id = "optimised-background";
    background.props.style = {
      desktop: { backgroundImage: asset.url, minHeight: 120 },
    };
    saved.draft.data.content.push(background);
    await api({
      action: "save",
      id: saved.id,
      version: saved.version,
      document: saved.draft,
    });
    await page.reload();
    await page
      .getByRole("button")
      .filter({ hasText: `/${slug}/` })
      .click();
    const frame = page.frameLocator("#preview-frame");
    await expect(frame.locator(".kb-page img")).toHaveAttribute(
      "srcset",
      /320w.*2560w/,
    );
    await page
      .getByRole("button", { name: "Mobile preview", exact: true })
      .click();
    await expect(
      frame.locator('[data-block-id="optimised-background"]'),
    ).toHaveCSS(
      "background-image",
      `url("${BUILDER_TEST_ORIGIN}${asset.image!.variants[1].url}")`,
    );
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish now", exact: true })
      .click();
    await expect(page.locator(".builder-toast")).toContainText(/publish/i);
    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(`/${slug}/`);
    const image = mobile.locator(".kb-page img");
    await expect(image).toHaveAttribute("src", asset.url);
    const rectangle = await image.boundingBox();
    expect(rectangle!.width / rectangle!.height).toBeCloseTo(3200 / 1800, 2);
    await expect
      .poll(() =>
        image.evaluate(
          (element: HTMLImageElement) => element.complete && element.currentSrc,
        ),
      )
      .toContain(asset.image!.variants[1].url);
    await expect(
      mobile.locator('[data-block-id="optimised-background"]'),
    ).toHaveCSS(
      "background-image",
      `url("${BUILDER_TEST_ORIGIN}${asset.image!.variants[1].url}")`,
    );
    await mobile.screenshot({ path: "test-results/builder-images-mobile.png" });
    await mobile.close();
    const publication = (await api()).pages[0].published;
    expect(publication.data.content[0].props.image).toEqual(asset.image);
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Details for wide-landscape.png",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: /Regenerate optimised/ }).click();
    await expect(page.locator(".builder-asset-detail")).toContainText(
      "5 smaller WebP versions",
    );
    await expect(page.locator(".builder-import-status")).toContainText(
      "Image optimisation finished",
    );
    expect((await api()).pages[0].published).toEqual(publication);
    const collision: Asset = {
      ...asset,
      path: "another.png",
      hash: "c".repeat(64),
    };
    const rejected = await page.request.post("/__builder-local?action=upload", {
      headers: {
        "X-Kaizen-Builder": "1",
        "X-Asset-Metadata": encodeURIComponent(JSON.stringify(collision)),
        "Content-Type": "image/png",
      },
      data: Buffer.from("cannot overwrite"),
    });
    expect(rejected.ok()).toBe(false);
    expect(await (await page.request.get(asset.url)).body()).toEqual(bytes);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export ZIP", exact: true }).click();
    await (await download).saveAs("test-results/builder-images-react.zip");
    result = await api();
    await writeFile(
      "test-results/builder-images-fixture.json",
      JSON.stringify({ slug, asset, originalBytes: bytes.length }),
    );
  } finally {
    await page.close();
    // Keep successful fixtures for the separate static build, alongside all earlier isolated fixtures.
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
