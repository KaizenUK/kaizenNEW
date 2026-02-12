import { defineArrayMember, defineField, defineType } from "sanity";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    // ── Content (left column) ─────────────────────────────────────
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "content",
      title: "Page Sections",
      type: "array",
      of: [
        defineArrayMember({ type: "hero" }),
        defineArrayMember({ type: "richTextSection" }),
        defineArrayMember({ type: "features" }),
        defineArrayMember({ type: "ctaSection" }),
        defineArrayMember({ type: "testimonials" }),
        defineArrayMember({ type: "faqSection" }),
        defineArrayMember({ type: "statsSection" }),
        defineArrayMember({ type: "imageGallery" }),
        defineArrayMember({ type: "videoEmbed" }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),

    // ── SEO (right column via CSS grid) ───────────────────────────
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
          description: "Keep between 30–60 characters.",
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
          description: "Target 50–160 characters.",
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
          description: "Recommended 1200×630 for social sharing.",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
        }),
        defineField({
          name: "noIndex",
          title: "Hide from Search Engines",
          type: "boolean",
          initialValue: false,
          description: "Enable to add noindex meta tag.",
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "slug.current",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "Untitled Page",
      subtitle: subtitle ? `/${subtitle}` : "No slug",
    }),
  },
});
