import { test as base, type Page } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Windows can retain Chromium profile files after the browser exits, causing
// Playwright's automatic profile removal to hang. Like verify-local-runner.ts,
// retain a unique test-only profile, while keeping normal per-test contexts.
const builderTest =
  process.platform === "win32"
    ? base.extend({
        browser: [
          async (
            { playwright, browserName, launchOptions, channel, headless },
            use,
          ) => {
            const context = await playwright[
              browserName
            ].launchPersistentContext(
              await mkdtemp(path.join(tmpdir(), "kaizen-source-browser-")),
              { ...launchOptions, channel, headless },
            );
            try {
              const browser = context.browser();
              if (!browser)
                throw new Error(
                  "The local test browser did not expose a browser session.",
                );
              await use(browser);
            } finally {
              await context.close();
            }
          },
          { scope: "worker" },
        ],
      })
    : base;
export const drainRepositoryRoutes = new WeakSet<Page>();
export const test = builderTest.extend<{ repositoryRoutes: void }>({
  repositoryRoutes: [
    async ({ page }, use) => {
      await use();
      if (drainRepositoryRoutes.has(page)) {
        await page.unrouteAll({ behavior: "wait" });
        await page.context().unrouteAll({ behavior: "wait" });
      }
    },
    { auto: true },
  ],
});
export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";
