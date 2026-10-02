import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBlogDate, getAuthorPath, getBlogReview } from "../../src/lib/blog";
import { SEAN_AUTHOR } from "../../src/data/blog-editorial";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("blog editorial information", () => {
  it("displays UK publication dates independently of the host timezone", () => {
    for (const timeZone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      vi.stubEnv("TZ", timeZone);
      expect(formatBlogDate("2026-02-03T23:08:21.000Z")).toBe("03 February 2026");
      expect(formatBlogDate("2026-02-03T23:08:21.000Z", "short")).toBe("03 Feb 2026");
      expect(formatBlogDate("2026-07-01T23:30:00.000Z")).toBe("02 July 2026");
    }
    expect(formatBlogDate()).toBe("Draft");
    expect(formatBlogDate("not-a-date")).toBe("Draft");
  });

  it("does not invent or advance review dates as time passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-12-01T00:00:00Z"));
    expect(getBlogReview("wp-post-183")).toMatchObject({ checkedOn: "2026-10-02", label: "October 2026" });
    expect(getBlogReview("drafts.wp-post-183")).toEqual(getBlogReview("wp-post-183"));
    expect(getBlogReview("new-unreviewed-post")).toBeNull();
    expect(getBlogReview("wp-post-58")).toBeNull();
  });

  it("links only the author with an available public profile", () => {
    expect(getAuthorPath(SEAN_AUTHOR)).toBe("/authors/sean-mcdonnell/");
    expect(getAuthorPath()).toBeNull();
    expect(getAuthorPath({ name: "Kaizen", slug: "Kaizen Team" })).toBeNull();
    expect(getAuthorPath({ ...SEAN_AUTHOR, _id: "another-author" })).toBeNull();
    expect(getAuthorPath({ ...SEAN_AUTHOR, slug: "other" })).toBeNull();
  });
});
