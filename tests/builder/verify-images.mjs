// Run after images.spec.ts and building its extracted React ZIP or the isolated Astro static site.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium, expect } from "@playwright/test";

const staticBuild = process.argv.includes("--static");
const root = path.resolve(
  staticBuild
    ? "test-results/builder-static-site"
    : "test-results/image-export-project/dist",
);
const fixture = JSON.parse(
  await readFile("test-results/builder-images-fixture.json", "utf8"),
);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".webp": "image/webp",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`,
    );
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    const bytes = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Content-Security-Policy": "script-src 'self'",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      requests = [],
      errors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/${fixture.slug}/`);
    const image = page.locator(".kb-page img");
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((node) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    await expect(image).toHaveAttribute("srcset", /320w.*2560w/);
    const rectangle = await image.boundingBox();
    await expect(image).toHaveCSS(
      "aspect-ratio",
      `${fixture.asset.image.width} / ${fixture.asset.image.height}`,
    );
    // The existing desktop stylesheet caps tall images at 800px. At mobile
    // width that cap is inactive, so the rendered box must use the natural ratio.
    if (width === 390)
      expect(rectangle.width / rectangle.height).toBeCloseTo(
        fixture.asset.image.width / fixture.asset.image.height,
        2,
      );
    const state = await image.evaluate((node) => ({
      source: node.src,
      current: node.currentSrc,
    }));
    expect(state.current).not.toBe(state.source);
    expect(requests).not.toContain(state.source);
    expect(requests.every((url) => url.startsWith(origin))).toBe(true);
    expect(errors).toEqual([]);
    await expect(page.locator("script")).toHaveCount(0);
    const original = await page.request.get(state.source);
    expect(
      createHash("sha256")
        .update(await original.body())
        .digest("hex"),
    ).toBe(fixture.asset.hash);
    const variant = fixture.asset.image.variants.find(
      (item) => item.width === (width === 390 ? 640 : 2560),
    );
    const background = await page
      .locator('[data-block-id="optimised-background"]')
      .evaluate((node) => getComputedStyle(node).backgroundImage);
    const backgroundUrl = background.slice(5, -2);
    const backgroundFile = await page.request.get(backgroundUrl);
    expect(
      createHash("sha256")
        .update(await backgroundFile.body())
        .digest("hex"),
    ).toBe(variant.hash);
    if (width === 390) {
      const file = await page.request.get(state.current);
      expect(
        createHash("sha256")
          .update(await file.body())
          .digest("hex"),
      ).toBe(variant.hash);
      expect((await file.body()).length).toBeLessThan(
        fixture.originalBytes / 10,
      );
    }
    await page.screenshot({
      path: `test-results/builder-images-${staticBuild ? "static" : "export"}-${width}.png`,
    });
    await page.close();
  }
  console.log(
    `${staticBuild ? "Astro static" : "React export"} image check passed: original checksums, mobile variants, responsive backgrounds, local bundled files and no visitor scripts.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
