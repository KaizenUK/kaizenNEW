import { defineArrayMember, defineField, defineType } from "sanity";
import { PostSeoStatsField } from "../../components/PostSeoStatsField";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";
import { SlugQualityField } from "../../components/SlugQualityField";

const MUST_REMOVE_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "for",
  "in",
  "on",
  "at",
  "to",
  "from",
  "with",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "it",
  "its",
  "that",
  "this",
  "these",
  "those",
]);

const NICE_TO_REMOVE_STOP_WORDS = new Set([
  "your",
  "my",
  "their",
  "our",
  "we",
  "you",
  "they",
  "he",
  "she",
  "him",
  "her",
  "who",
  "which",
  "what",
  "where",
  "when",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "now",
]);

export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    // ── Content group ──────────────────────────────────────────────
    defineField({
      name: "title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      components: { field: SlugQualityField },
      description:
        "Keep slugs short and keyword focused. Google usually ignores stop words, so removing them can improve readability.",
      validation: (Rule) => [
        Rule.required(),
        Rule.custom((value) => {
          const current =
            typeof value === "object" &&
            value !== null &&
            "current" in value
              ? String((value as { current?: string }).current ?? "").trim()
              : "";

          if (!current) return true;

          const tokens = current
            .toLowerCase()
            .split("-")
            .map((token) => token.trim())
            .filter(Boolean);

          const found = tokens.filter((token) =>
            MUST_REMOVE_STOP_WORDS.has(token),
          );

          if (!found.length) return true;
          return `Remove stop words from slug: ${Array.from(new Set(found)).join(", ")}`;
        }).warning(),
        Rule.custom((value) => {
          const current =
            typeof value === "object" &&
            value !== null &&
            "current" in value
              ? String((value as { current?: string }).current ?? "").trim()
              : "";

          if (!current) return true;

          const tokens = current
            .toLowerCase()
            .split("-")
            .map((token) => token.trim())
            .filter(Boolean);

          const found = tokens.filter((token) =>
            NICE_TO_REMOVE_STOP_WORDS.has(token),
          );

          if (!found.length) return true;
          return `Consider removing optional stop words: ${Array.from(new Set(found)).join(", ")}`;
        }).warning(),
      ],
    }),
    defineField({
      name: "body",
      type: "array",
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
      description: "Short summary used on index cards and social snippets.",
      validation: (Rule) => Rule.max(240),
    }),

    // ── Media group ────────────────────────────────────────────────
    defineField({
      name: "mainImage",
      title: "Main Image",
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
    defineField({
      name: "coverImage",
      title: "Legacy Cover Image",
      type: "image",
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
      name: "seoStatsPanel",
      title: "SEO Stats",
      type: "string",
      readOnly: true,
      hidden: ({ document }) => {
        const slugValue =
          typeof document?.slug === "object" &&
          document.slug !== null &&
          "current" in document.slug
            ? String((document.slug as { current?: string }).current ?? "").trim()
            : "";
        return !slugValue;
      },
      components: { field: PostSeoStatsField },
    }),
    defineField({
      name: "author",
      type: "reference",
      to: [{ type: "author" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
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
      validation: (Rule) => Rule.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "readTime",
      type: "number",
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
