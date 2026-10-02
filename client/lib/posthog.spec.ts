import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePostHog, logPostHog } from "./posthog";

afterEach(() => vi.unstubAllGlobals());

describe("optional enquiry analytics", () => {
  it("does not capture without consent", () => {
    const capture = vi.fn();
    vi.stubGlobal("window", { posthog: { capture } });
    capturePostHog("contact_form_submitted");
    expect(capture).not.toHaveBeenCalled();
  });

  it("passes a saved lead to the consented tracker", () => {
    const capture = vi.fn();
    vi.stubGlobal("window", { kaizenAnalyticsAllowed: true, posthog: { capture } });
    capturePostHog("scanner_email_lead_saved", { marketing_consent: false });
    expect(capture).toHaveBeenCalledExactlyOnceWith("scanner_email_lead_saved", { marketing_consent: false });
  });

  it("does not fail a saved enquiry when the tracker throws", () => {
    const fail = () => { throw new Error("Tracker blocked"); };
    vi.stubGlobal("window", { kaizenAnalyticsAllowed: true, posthog: { capture: fail, logger: { info: fail } } });
    expect(() => capturePostHog("contact_form_submitted")).not.toThrow();
    expect(() => logPostHog("stored")).not.toThrow();
  });

  it("works without a browser or a loaded tracker", () => {
    expect(() => capturePostHog("contact_form_submitted")).not.toThrow();
    vi.stubGlobal("window", { kaizenAnalyticsAllowed: true });
    expect(() => capturePostHog("contact_form_submitted")).not.toThrow();
  });
});
