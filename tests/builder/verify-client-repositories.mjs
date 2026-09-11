// Verify actual independently installed/built fixtures. Pass their repository paths.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

if (process.argv.length < 3)
  throw new Error("Pass an independently built repository folder.");
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : process.platform === "win32"
      ? { channel: "msedge" }
      : {}),
});
try {
  for (const [index, repository] of process.argv.slice(2).entries()) {
    const root = path.resolve(repository, "dist");
    const server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(
          new URL(request.url, "http://localhost").pathname,
        );
        const file = path.resolve(
          root,
          "." + pathname,
          ...(pathname.endsWith("/") ? ["index.html"] : []),
        );
        if (!file.startsWith(root + path.sep) || pathname.includes("/."))
          throw new Error("Not public output");
        const data = await readFile(file);
        response.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
          }[path.extname(file)] || "application/octet-stream",
        );
        response.end(data);
      } catch {
        response.statusCode = 404;
        response.end("Not found");
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const sockets = new Set();
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      for (const width of [1440, 390]) {
        console.log(`Checking ${repository} at ${width}px`);
        await page.setViewportSize({ width, height: 900 });
        expect((await page.goto(base + "/about/")).ok()).toBeTruthy();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          "https://client.example/about/",
        );
        const sitemap = await (
          await page.request.get(base + "/sitemap.xml")
        ).text();
        expect(sitemap).toContain("https://client.example/about/");
        expect(sitemap).not.toContain("/contact/");
        await expect(
          page.getByText("Independent client about", { exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        if (width === 390) {
          await page.locator(".kb-menu-mobile summary").focus();
          await page.keyboard.press("Enter");
          await expect(page.locator(".kb-menu-mobile")).toHaveAttribute(
            "open",
            "",
          );
        }
        const links = await page
          .locator("a[href^='/']")
          .evaluateAll((anchors) => [
            ...new Set(anchors.map((a) => a.getAttribute("href"))),
          ]);
        for (const href of links)
          expect(
            (await page.request.get(base + href)).ok(),
            `Broken internal link: ${href}`,
          ).toBeTruthy();
        await page.screenshot({
          path: `test-results/client-repository-${index}-${width}.png`,
          fullPage: true,
        });
        await page
          .locator(width === 390 ? ".kb-menu-mobile" : ".kb-menu-desktop")
          .getByRole("link", { name: "Contact", exact: true })
          .click();
        await expect(
          page.getByText("Independent client contact", { exact: true }),
        ).toBeVisible();
      }
      console.log(
        "Navigation checks complete; checking console and private-source exclusion.",
      );
      expect(errors).toEqual([]);
      expect(
        (await page.request.get(base + "/.kaizen/project.zip")).status(),
      ).toBe(404);
      console.log(
        `Verified ${repository}: desktop/mobile navigation, keyboard menu, links, console and private-source exclusion.`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      console.log("Closing fixture browser page");
      await page.close();
      console.log("Closing fixture server");
      server.close();
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      server.unref();
    }
  }
} finally {
  await browser.close();
}
console.log("Independent repository browser verification complete.");
