import { BLOG_REVIEWS, SEAN_AUTHOR } from "../data/blog-editorial";
import type { SanityAuthor } from "./sanity/client";

export function formatBlogDate(value?: string, month: "short" | "long" = "long"): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Draft";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month, year: "numeric", timeZone: "Europe/London",
  }).format(date);
}

export function getBlogReview(id: string) {
  const record = BLOG_REVIEWS[id.replace(/^drafts\./, "")];
  if (!record) return null;
  return {
    ...record,
    label: new Intl.DateTimeFormat("en-GB", {
      month: "long", year: "numeric", timeZone: "Europe/London",
    }).format(new Date(`${record.checkedOn}T12:00:00Z`)),
  };
}

export function getAuthorPath(author?: SanityAuthor): string | null {
  return author?._id === SEAN_AUTHOR._id && author.slug === SEAN_AUTHOR.slug
    ? `/authors/${SEAN_AUTHOR.slug}/`
    : null;
}
