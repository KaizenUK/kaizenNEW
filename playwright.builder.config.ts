import path from "node:path";
import { defineConfig } from "@playwright/test";
import {
  BUILDER_TEST_ORIGIN,
  BUILDER_TEST_PORT,
  COMPANION_TEST_ORIGIN,
} from "./tests/builder/ports";

// Core journeys run in all three engines; Chromium retains the complete suite.
const coreJourneys = [
  "auth",
  "account",
  "projects",
  "editor",
  "first-run",
  "page-templates",
  "starter-site",
  "site-canvas",
  "site-media",
  "site-frame-assets",
  "hosted-preview",
  "hosted-helper",
  "hosted-save",
  "companion",
  "uploads",
].map((name) => `**/${name}.spec.ts`);

// A dedicated local service and workspace: never exercise production or personal drafts.
export default defineConfig({
  testDir: "./tests/builder",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "firefox",
      testMatch: coreJourneys,
      use: { browserName: "firefox" },
    },
    { name: "webkit", testMatch: coreJourneys, use: { browserName: "webkit" } },
  ],
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
    baseURL: BUILDER_TEST_ORIGIN,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  webServer: {
    command: `node scripts/dev.mjs --port ${BUILDER_TEST_PORT}`,
    url: `${BUILDER_TEST_ORIGIN}/builder/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_BUILDER_CLOUD: "0",
      BUILDER_COMPANION_TEST_ORIGIN: COMPANION_TEST_ORIGIN,
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
