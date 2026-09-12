import { describe, expect, it, vi } from "vitest";
import {
  companionAllowedOrigins,
  DEFAULT_COMPANION_ORIGINS,
  DEFAULT_CONTACT_ORIGINS,
  DEFAULT_EDITOR_ORIGINS,
  parseAllowedOrigins,
} from "../../shared/builderOrigins";
import { handleContactRequest } from "../../shared/builderContact";

describe("configured browser origins", () => {
  it("retains each service's defaults only when its setting is absent", () => {
    expect(companionAllowedOrigins()).toEqual(["https://kaizenweb.co.uk"]);
    expect(
      parseAllowedOrigins(undefined, DEFAULT_CONTACT_ORIGINS, "contact"),
    ).toEqual(["https://kaizenweb.co.uk", "https://www.kaizenweb.co.uk"]);
    expect(
      parseAllowedOrigins(undefined, DEFAULT_EDITOR_ORIGINS, "editor"),
    ).toEqual(["https://kaizenweb.co.uk", "http://localhost:3333"]);
    expect(parseAllowedOrigins(" ", DEFAULT_EDITOR_ORIGINS, "editor")).toEqual(
      [],
    );
    expect(companionAllowedOrigins("")).toEqual([]);
  });
  it("replaces rather than extends defaults and normalises and deduplicates origins", () => {
    expect(
      parseAllowedOrigins(
        " https://EDITOR.example:443/,https://editor.example, https://stage.example:8443 ",
        DEFAULT_EDITOR_ORIGINS,
        "editor",
      ),
    ).toEqual(["https://editor.example", "https://stage.example:8443"]);
    expect(companionAllowedOrigins("https://builder.example")).toEqual([
      "https://builder.example",
    ]);
    expect(
      parseAllowedOrigins(
        "http://127.0.0.1:4321,http://[::1]:4321",
        [],
        "local",
      ),
    ).toEqual(["http://127.0.0.1:4321", "http://[::1]:4321"]);
  });
  it.each([
    "*",
    "https://*.example",
    "null",
    "file:///tmp/site",
    "javascript:alert(1)",
    "https:example.com",
    "https://example.com/path",
    "https://example.com?token=private",
    "https://example.com#private",
    "https://user:private@example.com",
    "https://example.com\\@evil.example",
    "http://remote.example",
    "https://exam\nple.com",
  ])("refuses unsafe configuration without falling back: %j", (value) => {
    expect(() =>
      parseAllowedOrigins(
        `${DEFAULT_COMPANION_ORIGINS[0]},${value}`,
        DEFAULT_COMPANION_ORIGINS,
        "BUILDER_COMPANION_ORIGINS",
      ),
    ).toThrow("BUILDER_COMPANION_ORIGINS must list complete HTTPS origins");
    try {
      companionAllowedOrigins(value);
    } catch (error) {
      expect((error as Error).message).not.toContain("private");
    }
  });
  it("keeps the test override limited to exact HTTP loopback origins", () => {
    expect(
      companionAllowedOrigins(
        "https://builder.example",
        "http://127.0.0.1:4333",
      ),
    ).toEqual(["https://builder.example", "http://127.0.0.1:4333"]);
    for (const value of [
      "https://remote.example",
      "http://localhost.evil:4333",
      "http://127.0.0.1:4333/path",
      "https://localhost:4333",
      "broken",
    ])
      expect(() => companionAllowedOrigins(undefined, value)).toThrow(
        /loopback HTTP origin/,
      );
  });
  it("applies the selected contact origins without accepting lookalike hosts or the old default", async () => {
    const submit = vi.fn();
    const options = {
      allowedOrigins: parseAllowedOrigins(
        "https://client.example/",
        DEFAULT_CONTACT_ORIGINS,
        "contact",
      ),
      submit,
    };
    for (const origin of [
      "https://kaizenweb.co.uk",
      "https://client.example.evil",
      "null",
    ]) {
      const response = await handleContactRequest(
        new Request("https://receiver.example", {
          method: "OPTIONS",
          headers: { origin },
        }),
        options,
      );
      expect(response.status).toBe(403);
      expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    }
    const response = await handleContactRequest(
      new Request("https://receiver.example", {
        method: "OPTIONS",
        headers: { origin: "https://client.example" },
      }),
      options,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://client.example",
    );
    expect(submit).not.toHaveBeenCalled();
  });
});
