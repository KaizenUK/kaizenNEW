// Full-page screenshots at desktop (1440px) and phone (375px) widths, cut into
// tiles that are easy to review. Agent-agnostic; needs Playwright's Chromium
// (pnpm exec playwright install chromium).
//
//   node scripts/audit/page-shots.mjs <outDir> / /about/ /services/wordpress-web-design/
//   BASE_URL=http://localhost:4321 node scripts/audit/page-shots.mjs shots /
//
// Output per page and width: <name>.<desk|mob>.full.jpg, numbered tiles, and
// report.json (page height, tile count, horizontal overflow in px).
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = (process.env.BASE_URL || "https://kaizenweb.co.uk").replace(/\/$/, "");
const [out, ...pages] = process.argv.slice(2);
if (!out || !pages.length) {
  console.error("Usage: node scripts/audit/page-shots.mjs <outDir> <path> [path ...]");
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
const views = [
  { name: "desk", options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, tile: 1800 },
  { name: "mob", options: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 }, tile: 1600 },
];
const browser = await chromium.launch();
const report = {};
for (const view of views) {
  const context = await browser.newContext(view.options);
  for (const slug of pages) {
    const page = await context.newPage();
    const name = `${slug.replace(/^\/|\/$/g, "").replace(/\//g, "__") || "home"}.${view.name}`;
    try {
      await page.goto(base + slug, { waitUntil: "networkidle", timeout: 60000 });
      // Scroll through so scroll-triggered reveals and lazy images run first.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 400) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      const full = await page.evaluate(() => document.documentElement.scrollHeight);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const width = view.options.viewport.width;
      await page.screenshot({ fullPage: true, type: "jpeg", quality: 70, path: path.join(out, `${name}.full.jpg`) });
      let tiles = 0;
      for (let y = 0; y < full; y += view.tile, tiles++)
        await page.screenshot({ fullPage: true, type: "jpeg", quality: 70, clip: { x: 0, y, width, height: Math.min(view.tile, full - y) }, path: path.join(out, `${name}.${String(tiles).padStart(2, "0")}.jpg`) });
      report[name] = { height: full, tiles, overflow };
      console.log(name, `${full}px`, `${tiles} tiles`, overflow > 0 ? `OVERFLOW ${overflow}px` : "no overflow");
    } catch (error) {
      report[name] = { error: String(error).slice(0, 200) };
      console.log(name, "ERROR", String(error).slice(0, 200));
    }
    await page.close();
  }
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
