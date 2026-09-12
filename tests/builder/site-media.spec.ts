import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
test.use({ actionTimeout: 10000 });
test("M3: replace a picture, explain managed content and reorder source sections on the page", async ({
  page,
}) => {
  const source =
    '<html><head><title>Garden</title></head><body><main><section><h1>Garden opening</h1><img src="/images/original.svg" srcset="/images/original.svg 1x" alt="Original image"></section><section><h2>Visit the studio</h2><blockquote>{cms.quote}</blockquote></section></main></body></html>';
  const fixture = await siteFixture(page, source),
    { root, project } = fixture;
  try {
    const bytes = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="40"><rect width="96" height="40" fill="purple"/></svg>',
    );
    const asset = {
      id: randomUUID(),
      hash: createHash("sha256").update(bytes).digest("hex"),
      name: "replacement.svg",
      path: "replacement.svg",
      pack: "Fixture",
      mime: "image/svg+xml",
      kind: "icon",
      size: bytes.length,
      url: "",
      tags: [],
      favourite: false,
      createdAt: new Date().toISOString(),
    };
    expect(
      (
        await page.request.post(
          `/__builder-local?project=${project.id}&action=upload`,
          {
            headers: {
              "X-Kaizen-Builder": "1",
              "X-Asset-Metadata": encodeURIComponent(JSON.stringify(asset)),
              "Content-Type": asset.mime,
            },
            data: bytes,
          },
        )
      ).ok(),
    ).toBe(true);
    await fixture.open();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    await frame.getByRole("img", { name: "Original image" }).click();
    await page
      .getByRole("button", { name: "Replace image", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use replacement.svg", exact: true })
      .click();
    await expect(frame.getByRole("img")).toHaveAttribute("src", /^blob:/);
    await expect
      .poll(() =>
        frame
          .getByRole("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 96,
          ),
      )
      .toBe(true);
    await expect(frame.getByRole("img")).not.toHaveAttribute(
      "srcset",
      /original/,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(() =>
        frame
          .getByRole("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 80,
          ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(() =>
        frame
          .getByRole("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 96,
          ),
      )
      .toBe(true);
    await frame.getByText("CMS supplied quote").click();
    await expect(
      page.getByText(/Managed elsewhere: no safe literal match/),
    ).toBeVisible();
    await frame.getByRole("heading", { name: "Visit the studio" }).hover();
    await frame
      .getByRole("button", { name: "Move section up", exact: true })
      .click();
    await expect(frame.locator("main > section").first()).toContainText(
      "Visit the studio",
    );
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      `public/images/${asset.hash}.svg`,
    );
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(() =>
        readFile(path.join(root, "public/images", `${asset.hash}.svg`), "utf8"),
      )
      .toBe(bytes.toString());
    const result = await readFile(
      path.join(root, "src/pages/index.astro"),
      "utf8",
    );
    expect(result.indexOf("Visit the studio")).toBeLessThan(
      result.indexOf("Garden opening"),
    );
    expect(result).toContain(`src="/images/${asset.hash}.svg"`);
    expect(result).toContain(`srcset="/images/${asset.hash}.svg"`);
    expect(
      (await readdir(path.join(root, "public/images"))).filter((file) =>
        file.startsWith(asset.hash),
      ),
    ).toHaveLength(1);
    await expect(frame.getByRole("img")).toHaveAttribute(
      "src",
      new RegExp(`/images/${asset.hash}\\.svg$`),
    );
    await expect
      .poll(() =>
        frame
          .getByRole("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 96,
          ),
      )
      .toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
