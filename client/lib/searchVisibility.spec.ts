import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeRedirectConfiguration } from "../../shared/builderRedirects.js";
import { isStagingBuild } from "../../src/lib/site";
import { plainPunctuation } from "../../src/components/blog/PortableTextRenderer";

describe("blog body text", () => {
  it("uses straight quotes and three dots, whatever Sanity sends", () => {
    expect(
      plainPunctuation("“It’s the agency’s site…”"),
    ).toBe("\"It's the agency's site...\"");
  });
});

describe("staging builds", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("are noindex only when built from the stage branch", () => {
    vi.stubEnv("KAIZEN_DEPLOY_BRANCH", "stage");
    expect(isStagingBuild()).toBe(true);
    vi.stubEnv("KAIZEN_DEPLOY_BRANCH", "main");
    expect(isStagingBuild()).toBe(false);
    vi.stubEnv("KAIZEN_DEPLOY_BRANCH", "");
    expect(isStagingBuild()).toBe(false);
  });
});

describe("retired public routes", () => {
  it("are real Nginx 301s with and without the trailing slash", () => {
    const { rules } = mergeRedirectConfiguration([], [], ["/"]);
    expect(rules).toContain(
      'location = "/web-design-wirral" { return 301 "/$is_args$args"; }',
    );
    expect(rules).toContain(
      'location = "/web-design-wirral/" { return 301 "/$is_args$args"; }',
    );
    expect(rules).toContain(
      'location = "/blog/new-kaizen-website-relaunch/" { return 301 "/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/$is_args$args"; }',
    );
  });

  it("leave a path to a Sanity redirect that already covers it", () => {
    const { rules } = mergeRedirectConfiguration(
      [],
      [{ source: "/agile-coaching/", destination: "/contract-product-owner/", isPermanent: true }],
      ["/"],
    );
    const forPath = rules.filter((rule) => rule.includes('"/agile-coaching/"'));
    expect(forPath).toEqual([
      'location = "/agile-coaching/" { return 301 "/contract-product-owner/"; }',
    ]);
    expect(rules).toContain(
      'location = "/agile-coaching" { return 301 "/contract-product-owner/$is_args$args"; }',
    );
  });
});
