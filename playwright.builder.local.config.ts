import base from "./playwright.builder.config";

// Local-only variant for machines without Playwright's bundled Chromium.
// PLAYWRIGHT_EXECUTABLE=<path to a Chromium/Chrome binary> uses that binary directly;
// otherwise PLAYWRIGHT_CHANNEL picks an installed browser (default msedge).
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE;

export default {
  ...base,
  use: {
    ...base.use,
    ...(executablePath
      ? { launchOptions: { executablePath } }
      : { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" }),
  },
};
