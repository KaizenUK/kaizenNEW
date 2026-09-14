import { test, expect, drainRepositoryRoutes } from "./browser-fixture";
import { hostedPreviewFixture } from "./hosted-preview-fixture";
import { openSiteProject } from "./hosted-repository-fixture";
import { helperToken, helperOwner } from "./hosted-helper-fixture";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.use({ ignoreHTTPSErrors: true }); // Trust only the fixture's temporary self-signed TLS certificate.
test("a real HTTPS hosted editor frames private Astro, React, styles, fonts and images and saves original source", async ({
  page,
  context,
  browserName,
}) => {
  const project = await (
    await page.request.post("/__builder-projects", {
      headers: { "X-Kaizen-Builder": "1" },
      data: { action: "create", name: "HTTPS hosted preview" },
    })
  ).json();
  await page.goto(`/builder/?project=${project.id}`);
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  const fixture = await hostedPreviewFixture(project.id);
  const root = fixture.api.folders.root(project.id);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    // Chromium adds an explicit third-party-cookie restriction. Other engines
    // exercise the same opaque HTTPS frame under their own cookie policy.
    if (browserName === "chromium") {
      const browserSession = await context.newCDPSession(page);
      await browserSession.send("Network.setCookieControls", {
        enableThirdPartyCookieRestriction: true,
      });
    }
    await openSiteProject(page, project, root, true, {
      origin: fixture.api.helper.origin,
      accessToken: helperToken(),
      direct: true,
      editorOrigin: fixture.origin,
    });
    await page
      .getByRole("button", { name: "Edit existing /", exact: true })
      .click();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    const iframe = page.locator('iframe[title="Website canvas"]');
    await expect(iframe).toBeVisible({ timeout: 45000 });
    const originalFrameUrl = await iframe.getAttribute("src");
    const canvas = page.frameLocator('iframe[title="Website canvas"]');
    const heading = canvas.getByRole("heading", { level: 1 });
    await expect(heading, consoleErrors.join("\n")).toBeVisible();
    await expect(heading).toHaveText("Hosted original");
    await expect(heading).toHaveCSS("color", "rgb(12, 34, 56)");
    await expect
      .poll(() =>
        canvas
          .getByRole("img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth,
          ),
      )
      .toBe(80);
    expect(
      await heading.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check("42px Fixture");
      }),
    ).toBe(true);
    expect(
      await heading.evaluate(() => {
        const denied: string[] = [];
        for (const [name, read] of [
          ["storage", () => localStorage.length],
          ["cookie", () => document.cookie],
          ["parent", () => parent.document.body],
        ] as const) {
          try {
            read();
          } catch {
            denied.push(name);
          }
        }
        return denied;
      }),
    ).toEqual(["storage", "cookie", "parent"]);
    // The editing canvas deliberately captures clicks to select source elements.
    await expect(
      canvas.getByRole("button", { name: "Count 0", exact: true }),
    ).toHaveAttribute("data-hydrated", "true");
    await canvas.getByRole("link", { name: "Contact us" }).click();
    await expect(
      page.getByLabel(/src\/pages\/index.astro .*href line/),
    ).toHaveValue("/contact/");
    await canvas.getByRole("img").click();
    await expect(
      page.getByLabel(/src\/pages\/index.astro .*src line/),
    ).toHaveValue("/picture.svg");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390) {
        await page
          .getByRole("button", { name: "Mobile preview", exact: true })
          .click();
        await page
          .getByRole("navigation", { name: "Editor panels" })
          .getByRole("button", { name: "Page", exact: true })
          .click();
      }
      await expect(heading).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/hosted-https-preview-${test.info().project.name}-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Desktop preview", exact: true })
      .click();
    await heading.dblclick();
    await heading.fill("Edited on the private HTTPS page");
    await heading.press("Tab");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Saved",
    );
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect
      .poll(() => readFile(path.join(root, "src/pages/index.astro"), "utf8"))
      .toContain("Edited on the private HTTPS page");
    await expect(iframe).not.toHaveAttribute("src", originalFrameUrl!, {
      timeout: 45000,
    });
    await expect(
      canvas.getByRole("heading", { name: "Edited on the private HTTPS page" }),
    ).toBeVisible({ timeout: 45000 });
    await expect(
      canvas.getByRole("button", { name: "Count 0", exact: true }),
    ).toHaveAttribute("data-hydrated", "true");
    const url = await iframe.getAttribute("src");
    expect(url).toMatch(
      new RegExp(
        `^${fixture.origin.replaceAll(".", "\\.")}/editor-preview/${project.id}/`,
      ),
    );
    await page
      .getByRole("button", { name: "Back to pages", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Export & handoff", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Export & handoff", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Check folder", exact: true })
      .click();
    const popupEvent = context.waitForEvent("page");
    await expect(
      page.getByRole("button", { name: "Open website preview", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open website preview", exact: true })
      .click();
    const popup = await popupEvent;
    const website = popup.frameLocator('iframe[title="Website preview"]');
    const publicPreview = await popup.locator("iframe").getAttribute("src");
    expect(
      await popup.evaluate(async (src) => {
        window.postMessage(
          {
            type: "kaizen-preview-navigate",
            nonce: new URL(src!).pathname.split("/")[4],
            route: "/contact/",
          },
          "*",
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        return document.querySelector("iframe")!.src;
      }, publicPreview),
    ).toBe(publicPreview);
    await expect(
      website.getByRole("button", { name: "Count 0", exact: true }),
    ).toHaveAttribute("data-hydrated", "true");
    await website.getByRole("button", { name: "Count 0", exact: true }).click();
    await expect(
      website.getByRole("button", { name: "Count 1", exact: true }),
    ).toBeVisible();
    await website.getByRole("link", { name: "Contact us" }).click();
    await expect(
      website.getByRole("heading", { name: "Private contact" }),
    ).toBeVisible();
    await website.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      website.getByRole("heading", {
        name: "Edited on the private HTTPS page",
      }),
    ).toBeVisible();
    await popup.close();
    const previewCookies = (await context.cookies()).filter(
      (cookie) =>
        cookie.name.includes("kaizen") && cookie.name.includes("preview"),
    );
    expect(
      previewCookies.find(
        (cookie) => cookie.name === "__Host-kaizen_builder_preview",
      ),
    ).toMatchObject({
      secure: true,
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
    });
    const frameCookie = previewCookies.find(
      (cookie) => cookie.name === "__Secure-kaizen_preview_frame",
    );
    expect(frameCookie).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: "None",
    });
    // Playwright's Chromium cookie API exposes CHIPS' partition key. Every
    // engine still proves cookie-authenticated assets and anonymous denial;
    // the server integration tests assert the Partitioned response attribute.
    if (browserName === "chromium")
      expect(frameCookie?.partitionKey).toBeTruthy();
    const anonymous = await context
      .browser()!
      .newContext({ ignoreHTTPSErrors: true });
    try {
      expect((await anonymous.request.get(url!)).status()).toBe(401);
    } finally {
      await anonymous.close();
    }
    fixture.api.members.get(project.id)!.delete(helperOwner);
    expect((await page.request.get(url!)).status()).toBe(403);
    expect(
      fixture.requests.filter(
        (request) =>
          request.path.startsWith("/editor-preview/") && request.status === 200,
      ).length,
    ).toBeGreaterThan(8);
  } catch (error) {
    console.info(
      "Hosted preview browser diagnostics",
      JSON.stringify({ errors: consoleErrors, requests: fixture.requests }),
    );
    throw error;
  } finally {
    drainRepositoryRoutes.delete(page);
    try {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await context.unrouteAll({ behavior: "wait" });
      }
    } finally {
      await fixture.close();
    }
  }
});
