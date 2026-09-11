import path from "node:path";
import { defineConfig } from "@playwright/test";

// A dedicated local service and workspace: never exercise production or personal drafts.
export default defineConfig({
  testDir: "./tests/builder",
  globalSetup: "./tests/builder/setup.ts",
  outputDir: "test-results/builder-browser-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4322",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  webServer: {
    command: "node tests/builder/dev-server.mjs",
    url: "http://127.0.0.1:4322/builder/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_BUILDER_CLOUD: "0",
      BUILDER_COMPANION_TEST_ORIGIN: "http://127.0.0.1:4323",
      BUILDER_CLIENT_DESTINATIONS_FILE: path.resolve(
        "test-results/builder-client-destinations.json",
      ),
      BUILDER_CLIENT_NGINX_PREFIX: path.resolve(
        "test-results/builder-client-nginx",
      ),
      BUILDER_CLIENT_NGINX_BINARY: process.env.KAIZEN_NGINX_BINARY || "nginx",
      BUILDER_CONTENT_FIXTURE: path.resolve(
        "test-results/builder-cms-source.json",
      ),
      BUILDER_TEST_CACHE_DIR: path.resolve("test-results/builder-vite-cache"),
      BUILDER_LOCAL_DIRECTORY: path.resolve(
        "test-results/builder-browser-workspace",
      ),
    },
  },
});
