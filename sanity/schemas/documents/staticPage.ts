import { defineField, defineType } from "sanity";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";

function normalizeStaticRoute(input: string): string {
  const trimmed = String(input ?? "").trim().toLowerCase();
  if (!trimmed) return "/";
  if (trimmed === "/") return "/";

  const withoutProtocol = trimmed
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!withoutProtocol) return "/";

  const normalized = withoutProtocol
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    )
    .filter(Boolean)
    .join("/");

  return normalized ? `/${normalized}` : "/";
}

export const staticPage = defineType({
  name: "staticPage",
  title: "Static SEO Page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Internal label for this route's SEO settings.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Route",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
        slugify: (input) => normalizeStaticRoute(input),
      },
      description:
        "Use '/' for homepage and '/blog' for the blog index route.",
      validation: (Rule) => [
        Rule.required(),
        Rule.custom((value) => {
          const current =
            typeof value === "object" &&
            value !== null &&
            "current" in value
              ? String((value as { current?: string }).current ?? "").trim()
              : "";

          if (!current) return "Route is required.";
          if (current === "/") return true;
          if (!current.startsWith("/")) return "Route must start with '/'.";
          if (current.endsWith("/"))
            return "Remove trailing slash (except '/').";
          if (/\s/.test(current)) return "Route must not contain spaces.";
          return true;
        }),
      ],
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      options: { collapsible: false, collapsed: false },
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          components: { field: SeoMetaTitleField },
          validation: (Rule) => [
            Rule.required().error("Meta title is required"),
            Rule.min(30).warning("Should be at least 30 characters"),
            Rule.max(60).error("Google truncates after ~60 characters"),
          ],
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          components: { field: SeoMetaDescriptionField },
          rows: 4,
          validation: (Rule) => [
            Rule.required().error("Meta description is required"),
            Rule.min(50).warning("Should be at least 50 characters"),
            Rule.max(160).error("Should not exceed 160 characters"),
          ],
        }),
        defineField({
          name: "shareImage",
          title: "Share Image",
          type: "image",
          description: "Recommended 1200x630 for social sharing.",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
        }),
        defineField({
          name: "canonicalUrl",
          title: "Canonical URL",
          type: "url",
          description: "Optional override. Leave blank for auto canonical.",
        }),
        defineField({
          name: "noIndex",
          title: "Hide from Search Engines",
          type: "boolean",
          initialValue: false,
          description: "Enable to emit a noindex robots meta tag.",
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: "title",
      route: "slug.current",
    },
    prepare: ({ title, route }) => ({
      title: title || "Untitled Static SEO Page",
      subtitle: route || "No route set",
    }),
  },
});
