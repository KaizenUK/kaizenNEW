// Run after generating and building test-results/export-project.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const staticBuild = process.argv.includes("--static");
const root = path.resolve(
  staticBuild
    ? "test-results/builder-static-site"
    : "test-results/export-project/dist",
);
let plainSlug = "export-demo";
let interactiveSlug = "campaigns/second-page";
let contactSlug = interactiveSlug;
let sharedSlug = "shared-export";
let cmsSlug = "cms-export";
if (staticBuild) {
  const workspace = JSON.parse(
    await readFile(
      "test-results/builder-browser-workspace/workspace.json",
      "utf8",
    ),
  );
  const published = workspace.pages
    .filter((page) => page.published)
    .map((page) => page.published);
  plainSlug = published.find((page) =>
    page.data.content.some((block) => block.type === "Hero"),
  ).slug;
  interactiveSlug = published
    .filter((page) =>
      page.data.content.some(
        (block) => block.type === "Video" && block.props.src,
      ),
    )
    .at(-1).slug;
  contactSlug = published
    .filter((page) =>
      page.data.content.some((block) => block.type === "ContactForm"),
    )
    .at(-1).slug;
  sharedSlug = published
    .filter((page) =>
      page.data.content.some((block) => block.props.id === "site-header"),
    )
    .at(-1).slug;
  cmsSlug = published
    .filter((page) =>
      page.data.content.some((block) => block.type === "ContentList"),
    )
    .at(-1).slug;
}
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".vtt": "text/vtt",
};
let receivedEnquiries = 0;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (pathname === "/export-contact-test" && request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const submission = JSON.parse(Buffer.concat(chunks).toString());
      expect(submission).toMatchObject({
        name: "Export",
        message: "Independent export enquiry",
        consent_to_gdpr: true,
        marketing_consent: false,
      });
      receivedEnquiries++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const cmsRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("api.sanity.io"))
      cmsRequests.push(request.url());
  });
  if (staticBuild)
    await page.route(
      "https://cdn.sanity.io/images/builder-fixture/**",
      async (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: await readFile("public/builder-samples/landscape.svg"),
        }),
    );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/${plainSlug}/`);
  await expect(page.locator("script")).toHaveCount(0);
  if (!staticBuild)
    await expect(page.locator(".kb-reviewed-card")).toHaveText(
      "Reviewed export <script>example</script>",
    );
  await expect(page.locator(".kb-hero img")).toBeVisible();
  expect(
    await page.locator(".kb-hero img").evaluate((image) => image.naturalWidth),
  ).toBeGreaterThan(0);
  if (staticBuild) {
    const fixture = JSON.parse(
      await readFile("test-results/builder-conversions-fixture.json", "utf8"),
    );
    await page.goto(`${origin}/${fixture.slug}/`);
    await expect(page.locator(".kb-reviewed-card")).toHaveText(
      "A reviewed and editable card",
    );
    await expect(page.locator(".kb-reviewed-card").locator("..")).toHaveCSS(
      "padding-left",
      "12px",
    );
    await expect(page.locator("script")).toHaveCount(0);
  }
  await page.goto(`${origin}/${interactiveSlug}/`);
  await expect(page.locator("script")).toHaveCount(1);
  await expect(page.locator("script")).toHaveAttribute(
    "src",
    staticBuild ? /^\/_astro\/runtime\.[\w-]+\.js$/ : "/builder-runtime.js",
  );
  await page
    .getByRole("tab", { name: "Discover", exact: true })
    .first()
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Design", exact: true }).first(),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel").first()).toContainText(
    "Thoughtful layouts",
  );
  await page.locator(".kb-menu-mobile summary").click();
  await expect(page.locator(".kb-menu-mobile")).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".kb-menu-mobile")).not.toHaveAttribute("open");
  await page.locator(".kb-accordion summary").first().click();
  await expect(page.locator(".kb-accordion details").first()).toHaveAttribute(
    "open",
    "",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page.locator("video").evaluate(async (video) => {
    await video.play();
  });
  await expect
    .poll(() => page.locator("video").evaluate((video) => video.currentTime))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.locator("video track").evaluate((track) => track.readyState),
    )
    .toBe(2);
  expect(errors).toEqual([]);
  {
    if (staticBuild) await page.goto(`${origin}/${contactSlug}/`);
    const form = page.getByRole("form", { name: "Contact us", exact: true });
    await form
      .getByLabel("First name (required)", { exact: true })
      .fill("Export");
    await form
      .getByLabel("Email (required)", { exact: true })
      .fill("export@example.org");
    await form
      .getByLabel("Message (required)", { exact: true })
      .fill("Independent export enquiry");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByRole("status")).toHaveText(
      await form.getAttribute("data-success"),
    );
    expect(receivedEnquiries).toBe(1);
    await page.goto(`${origin}/${sharedSlug}/`);
    await expect(page.locator(".kb-menu-brand")).toBeVisible();
    if (staticBuild) {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(390);
      expect(
        await page
          .locator(".kb-menu")
          .first()
          .evaluate((element) =>
            Math.round(element.getBoundingClientRect().width),
          ),
      ).toBe(390);
    } else {
      await expect(
        page.getByRole("heading", {
          name: "An exported shared section",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".kb-page > .kb-container").nth(1)).toHaveCSS(
        "padding-left",
        "24px",
      );
      await expect(page.locator(".kb-menu-brand")).toBeVisible();
    }
  }
  await page.goto(`${origin}/${cmsSlug}/`);
  await expect(page.locator("script")).toHaveCount(0);
  await expect(page.locator(".kb-content-card")).toHaveCount(2);
  await expect(
    page
      .locator(".kb-content-card h3")
      .filter({ hasText: "A thoughtful first impression" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".kb-content-card img")
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(cmsRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect
    .poll(() =>
      page
        .locator(".kb-content-grid")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
        ),
    )
    .toBe(staticBuild ? 2 : 3);
  await page.screenshot({
    path: `test-results/builder-${staticBuild ? "static" : "export"}-cms-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `test-results/builder-${staticBuild ? "static" : "export"}-interactive-mobile.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  console.log(
    `${staticBuild ? "Static publication" : "Export"} browser check passed: media, mobile layout, tab keyboard controls, menu, FAQ, video/captions, contact submission, shared content, static Sanity listings, and selective scripts under script-src 'self'.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
