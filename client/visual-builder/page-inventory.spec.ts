import { describe, expect, it } from "vitest";
import { existingPageInventory } from "../../shared/builderPageInventory";

describe("existing page ownership", () => {
  it("lists source routes and CMS pages without exposing templates or editor routes", () => {
    const inventory = existingPageInventory(
      {
        "../pages/index.astro":
          "---\nconst privateServerValue = 'not-for-the-inventory';\n---\n<h1>Home</h1>",
        "../pages/about.astro": "---\n---\nAbout",
        "../pages/blog/index.astro": "---\n---",
        "../pages/blog/[slug].astro": "---\n---",
        "../pages/[...slug].astro": "---\n---",
        "../pages/builder.astro": "---\n---",
        "../pages/builder/companion.astro": "---\n---",
        "../pages/insights.astro":
          "---\nreturn Astro.redirect('/blog',301);\n---",
      },
      [
        "/cms-campaign/",
        "/about/",
        "/api/private",
        "/builder/",
        "/builder/companion/",
        "//bad/path//",
        "/evil?query=x",
      ],
    );
    expect(inventory.find((page) => page.path === "/")?.kind).toBe("site");
    expect(inventory.find((page) => page.path === "/about/")?.kind).toBe(
      "site",
    );
    expect(inventory.find((page) => page.path === "/cms-campaign/")?.kind).toBe(
      "cms",
    );
    expect(inventory.find((page) => page.path === "/blog/")?.kind).toBe("cms");
    expect(inventory.find((page) => page.path === "/insights/")).toMatchObject({
      kind: "redirect",
      destination: "/blog/",
    });
    expect(
      inventory.some(
        (page) =>
          page.path.includes("[") ||
          page.path.startsWith("/builder/") ||
          page.path.startsWith("/api/"),
      ),
    ).toBe(false);
    expect(JSON.stringify(inventory)).not.toContain("not-for-the-inventory");
    expect(inventory.find((page) => page.path === "/services/")).toMatchObject({
      kind: "redirect",
      destination: "/services/wordpress-web-design/",
    });
  });
});
