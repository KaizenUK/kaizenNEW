import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeRedirectConfiguration } from "../../shared/builderRedirects.js";

const { publishedFetch, previewFetch } = vi.hoisted(() => ({
  publishedFetch: vi.fn(),
  previewFetch: vi.fn(),
}));
vi.mock("@sanity/client", () => ({
  createClient: (config: { perspective: string }) => ({
    fetch: config.perspective === "published" ? publishedFetch : previewFetch,
  }),
}));
vi.mock("@sanity/image-url", () => ({ createImageUrlBuilder: () => ({}) }));

const retired = { _id: "old", slug: "software-project-rescue", title: "Old guide" };
const retained = {
  _id: "keep",
  slug: "fix-failing-software-project-financial-guide",
  title: "Merged guide",
};
let posts: typeof import("../../src/lib/sanity/client");

beforeAll(async () => {
  vi.stubEnv("PUBLIC_SANITY_PROJECT_ID", "test-project");
  vi.stubEnv("PUBLIC_SANITY_DATASET", "test");
  posts = await import("../../src/lib/sanity/client");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => vi.clearAllMocks());

describe("retired blog posts", () => {
  it("excludes retired documents from route/index and category lists", async () => {
    publishedFetch.mockResolvedValue([retired, retained]);
    expect((await posts.getAllPosts()).map((p) => p._id)).toEqual(["keep"]);
    expect((await posts.getPostsByCategory("guides")).map((p) => p._id)).toEqual(["keep"]);
  });

  it("blocks public detail reads while preserving editor previews", async () => {
    publishedFetch.mockResolvedValue(retired);
    previewFetch.mockResolvedValue(retired);
    expect(await posts.getPostBySlug(retired.slug)).toBeNull();
    expect(await posts.getPostById(retired._id)).toBeNull();
    expect(await posts.getPostBySlug(retired.slug, true)).toMatchObject(retired);
    expect(await posts.getPostById(retired._id, true)).toMatchObject(retired);
  });

  it("keeps active detail reads and missing-post handling", async () => {
    publishedFetch.mockResolvedValue(retained);
    expect(await posts.getPostBySlug(retained.slug)).toMatchObject(retained);
    expect(await posts.getPostById(retained._id)).toMatchObject(retained);
    publishedFetch.mockResolvedValue(null);
    expect(await posts.getPostBySlug("missing")).toBeNull();
    expect(await posts.getPostById("missing")).toBeNull();
  });

  it("sends both slash forms and legacy aliases straight to the retained guide with queries", () => {
    const destination = `/blog/${retained.slug}/`;
    const { rules } = mergeRedirectConfiguration([], [], [destination]);
    for (const prefix of ["blog", "blogdetail", "insights"]) {
      for (const suffix of ["", "/"]) {
        expect(rules).toContain(
          `location = "/${prefix}/${retired.slug}${suffix}" { return 301 "${destination}$is_args$args"; }`,
        );
      }
    }
  });
});
