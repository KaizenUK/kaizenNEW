import { describe, expect, it } from "vitest";
import { nginxRedirectRules } from "../../shared/nginxRedirects.js";
import {
  mergeRedirectConfiguration,
  validateBuilderRedirects,
  builderRedirectChecks,
  localRedirectPaths,
} from "../../shared/builderRedirects.js";
import { saveRoutes, publishLocalRoutes } from "../../shared/builderRoutes";
import { makeRestorePlan, applyRestorePlan } from "../../shared/builderBackup";
describe("release redirects", () => {
  it("retires the local search service and rejects conflicting redirect owners", () => {
    const paths = localRedirectPaths([]);
    expect(paths).not.toContain("/services/local-seo/");
    expect(paths).toContain("/services/wordpress-web-design/");
    const { rules } = mergeRedirectConfiguration([], [], paths);
    for (const source of ["/services/local-seo", "/services/local-seo/"]) {
      expect(rules).toContain(
        `location = "${source}" { return 301 "/services/wordpress-web-design/$is_args$args"; }`,
      );
    }
    expect(() =>
      mergeRedirectConfiguration(
        [{ id: crypto.randomUUID(), source: "/services/local-seo/", destination: "/", status: 301 }],
        [],
        paths,
      ),
    ).toThrow(/source belongs to the existing site or editor/);
    expect(() =>
      mergeRedirectConfiguration(
        [],
        [{ source: "/services/local-seo", destination: "/", isPermanent: true }],
        paths,
      ),
    ).toThrow(/Conflicting existing redirects/);
  });
  it("checks aliases, occupied pages, full redirect graphs and final destinations", () => {
    const rules = [
      {
        id: crypto.randomUUID(),
        source: "/old",
        destination: "/new/",
        status: 302,
      },
    ];
    expect(builderRedirectChecks(rules).map((rule) => rule.source)).toEqual([
      "/old",
      "/old/",
    ]);
    expect(() => validateBuilderRedirects(rules, ["/old/"])).toThrow(
      /already uses/,
    );
    expect(() => mergeRedirectConfiguration(rules, [], ["/"])).toThrow(
      /destination/,
    );
    expect(() =>
      mergeRedirectConfiguration(
        rules,
        [{ source: "/new/", destination: "/old/" }],
        ["/"],
      ),
    ).toThrow(/cycle/);
    expect(
      mergeRedirectConfiguration(
        rules,
        [],
        ["/new/", "/_astro/index@_@astro.hash.css"],
      ).checks,
    ).toHaveLength(2);
    expect(mergeRedirectConfiguration(rules, [], ["/new/"]).rules[0]).toContain(
      "$is_args$args",
    );
  });
  it("keeps redirect restore draft-only with optimistic versions", () => {
    const rules = [
      {
        id: crypto.randomUUID(),
        source: "/old/",
        destination: "/",
        status: 302 as const,
      },
    ];
    const workspace = publishLocalRoutes(
      {
        pages: [],
        assets: [],
        saved: [],
        routes: saveRoutes(undefined, 0, rules),
      },
      1,
    );
    const incoming = {
      ...workspace,
      routes: saveRoutes(workspace.routes, 1, []),
    };
    const plan = makeRestorePlan(workspace, incoming),
      restored = applyRestorePlan(workspace, plan);
    expect(restored.routes!.draft).toEqual([]);
    expect(restored.routes!.published).toEqual(rules);
    expect(() => applyRestorePlan(restored, plan)).toThrow(/workspace changed/);
  });
  it("quotes exact internal routes and preserves status codes", () => {
    expect(
      nginxRedirectRules([
        {
          source: "old-page.html",
          destination: "/campaign/",
          isPermanent: true,
        },
        { source: "/temporary/", destination: "/", isPermanent: false },
      ]),
    ).toEqual([
      'location = "/old-page.html" { return 301 "/campaign/"; }',
      'location = "/temporary/" { return 302 "/"; }',
    ]);
  });
  it("fails the build for injected config, duplicate sources, cycles and unsupported URLs", () => {
    for (const source of [
      '/unsafe"; root /etc; #',
      "/path\nlocation /secret",
      "//$host/",
      "https://elsewhere.example/",
      "/../secret",
      "/x?name=value",
      "/x$uri",
    ])
      expect(() =>
        nginxRedirectRules([{ source, destination: "/" }]),
      ).toThrow();
    expect(() =>
      nginxRedirectRules([
        { source: "/a/", destination: "/b/" },
        { source: "/a/", destination: "/c/" },
      ]),
    ).toThrow(/duplicated/);
    expect(() =>
      nginxRedirectRules([
        { source: "/a/", destination: "/b/" },
        { source: "/b/", destination: "/a/" },
      ]),
    ).toThrow(/cycle/);
  });
});
