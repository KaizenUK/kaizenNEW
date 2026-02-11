import { defineArrayMember, defineField, defineType } from "sanity";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";

export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "media", title: "Media" },
    { name: "seo", title: "SEO" },
    { name: "settings", title: "Settings" },
  ],
  fields: [
    // ── Content group ──────────────────────────────────────────────
    defineField({
      name: "title",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      group: "content",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "body",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alt text",
            }),
          ],
        }),
        defineArrayMember({ type: "callToAction" }),
        defineArrayMember({ type: "codeBlock" }),
        defineArrayMember({ type: "videoEmbed" }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      group: "content",
      description: "Short summary used on index cards and social snippets.",
      validation: (Rule) => Rule.max(240),
    }),

    // ── Media group ────────────────────────────────────────────────
    defineField({
      name: "mainImage",
      title: "Main Image",
      type: "image",
      group: "media",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
      fields: [
        defineField({
          name: "alt",
          type: "string",
          title: "Alt text",
        }),
      ],
    }),
    defineField({
      name: "coverImage",
      title: "Legacy Cover Image",
      type: "image",
      group: "media",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
      hidden: ({ document }) =>
        Boolean((document as { mainImage?: unknown })?.mainImage),
      description:
        "Fallback for older imported posts. Use Main Image for new content.",
      fields: [
        defineField({
          name: "alt",
          type: "string",
          title: "Alt text",
        }),
      ],
    }),

    // ── SEO group ──────────────────────────────────────────────────
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      group: "seo",
      options: {
        collapsible: false,
        collapsed: false,
      },
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          components: { field: SeoMetaTitleField },
          description:
            "Keep between 30–60 characters. Include your focus keyword.",
          validation: (Rule) => [
            Rule.required().error("Meta title is required"),
            Rule.min(30).warning("Should be at least 30 characters"),
            Rule.max(60).error("Google truncates after ~60 characters"),
            Rule.custom((value, context) => {
              const title = typeof value === "string" ? value.trim() : "";
              const focusKeyword = String(
                (context.parent as { focusKeyword?: string } | undefined)
                  ?.focusKeyword ?? "",
              ).trim();
              if (!title || !focusKeyword) return true;
              if (title.toLowerCase().includes(focusKeyword.toLowerCase()))
                return true;
              return "Focus keyword missing from title";
            }).warning(),
          ],
        }),
        defineField({
          name: "focusKeyword",
          title: "Focus Keyword",
          type: "string",
          description:
            "Primary keyword to validate against meta title and description.",
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          components: { field: SeoMetaDescriptionField },
          rows: 4,
          description: "Target 50–160 characters for best snippets.",
          validation: (Rule) => [
            Rule.required().error("Meta description is required"),
            Rule.min(50).warning("Should be at least 50 characters"),
            Rule.max(160).error("Should not exceed 160 characters"),
            Rule.custom((value, context) => {
              const desc = typeof value === "string" ? value.trim() : "";
              const focusKeyword = String(
                (context.parent as { focusKeyword?: string } | undefined)
                  ?.focusKeyword ?? "",
              ).trim();
              if (!desc || !focusKeyword) return true;
              if (desc.toLowerCase().includes(focusKeyword.toLowerCase()))
                return true;
              return "Focus keyword missing from meta description";
            }).warning(),
          ],
        }),
        defineField({
          name: "shareImage",
          title: "Share Image",
          type: "image",
          description:
            "Recommended 1200×630. Falls back to Main Image if empty.",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
        }),
        defineField({
          name: "canonicalUrl",
          title: "Canonical URL",
          type: "url",
          description:
            "Only set if this content was originally published elsewhere.",
        }),
      ],
    }),

    // ── Settings group ─────────────────────────────────────────────
    defineField({
      name: "author",
      type: "reference",
      to: [{ type: "author" }],
      group: "settings",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      group: "settings",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "category" }],
        }),
      ],
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: "publishedAt",
      type: "datetime",
      group: "settings",
      validation: (Rule) => Rule.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "readTime",
      type: "number",
      group: "settings",
      description: "Leave blank to auto-estimate from body text.",
      validation: (Rule) => Rule.min(1).max(60),
    }),
  ],
  orderings: [
    {
      title: "Published Date (Newest)",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
    {
      title: "Published Date (Oldest)",
      name: "publishedAtAsc",
      by: [{ field: "publishedAt", direction: "asc" }],
    },
    {
      title: "Title A→Z",
      name: "titleAsc",
      by: [{ field: "title", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "author.name",
      media: "mainImage",
      fallbackMedia: "coverImage",
    },
    prepare: ({ title, subtitle, media, fallbackMedia }) => ({
      title,
      subtitle,
      media: media || fallbackMedia,
    }),
  },
});
