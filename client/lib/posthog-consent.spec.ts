import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../src/components/posthog.astro", import.meta.url), "utf8");
const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];

describe("remembered analytics consent when the SDK loads", () => {
  it.each([
    { allowed: true, oldOptOut: true, optIn: 1, optOut: 0 },
    { allowed: true, oldOptOut: false, optIn: 0, optOut: 0 },
    { allowed: false, oldOptOut: true, optIn: 0, optOut: 1 },
    { allowed: false, oldOptOut: false, optIn: 0, optOut: 1 },
  ])("applies $allowed instead of remembered opt-out $oldOptOut", ({ allowed, oldOptOut, optIn, optOut }) => {
    const context: Record<string, any> = {
      apiKey: "public-test", apiHost: "https://eu.i.posthog.com", URL,
      location: { hostname: "kaizenweb.co.uk", pathname: "/" },
      navigator: { webdriver: true },
      localStorage: { getItem: () => JSON.stringify({ analytics: true }) },
      addEventListener: vi.fn(),
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore: vi.fn() } }],
      },
    };
    context.window = context;
    context.parent = context;
    runInNewContext(script, context);
    // Consent can change while the external SDK is still loading.
    context.kaizenAnalyticsAllowed = allowed;
    const client = {
      has_opted_out_capturing: () => oldOptOut,
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    context.posthog._i[0][1].loaded(client);
    expect(client.opt_in_capturing).toHaveBeenCalledTimes(optIn);
    expect(client.opt_out_capturing).toHaveBeenCalledTimes(optOut);
  });
});
