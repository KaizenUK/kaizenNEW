import { defineArrayMember, defineField, defineType } from "sanity";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    // â”€â”€ Content (left column) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      name: "replaceRouteContent",
      title: "Replace Existing Route Content",
      type: "boolean",
      initialValue: false,
      description:
        "Enable to render this page's section blocks on the live route. Leave off for SEO-only control.",
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
        defineArrayMember({ type: "pricingSection" }),
        defineArrayMember({ type: "logoBar" }),
        defineArrayMember({ type: "teamGrid" }),
        defineArrayMember({ type: "contactForm" }),
        defineArrayMember({ type: "layoutRow" }),
        defineArrayMember({ type: "spacer" }),
      ],
      options: {
        insertMenu: {
          groups: [
            {
              name: "layout",
              title: "Layout",
              of: ["hero", "ctaSection", "richTextSection", "layoutRow", "spacer"],
            },
            {
              name: "social-proof",
              title: "Social Proof",
              of: ["testimonials", "statsSection", "logoBar"],
            },
            {
              name: "content",
              title: "Content",
              of: ["features", "faqSection", "pricingSection"],
            },
            {
              name: "media",
              title: "Media",
              of: ["imageGallery", "videoEmbed"],
            },
            {
              name: "people",
              title: "People",
              of: ["teamGrid", "contactForm"],
            },
          ],
        },
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const replaceRouteContent =
            typeof context.document === "object" &&
            context.document !== null &&
            "replaceRouteContent" in context.document
              ? Boolean(
                  (context.document as { replaceRouteContent?: boolean })
                    .replaceRouteContent,
                )
              : false;

          if (!replaceRouteContent) return true;
          if (Array.isArray(value) && value.length > 0) return true;
          return "Add at least one section when route replacement is enabled.";
        }),
    }),
    // â"€â"€ SEO (right column via CSS grid) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          components: { field: SeoMetaTitleField },
          description: "Keep between 30\u201360 characters.",
          validation: (Rule) => [
            Rule.required().warning("Meta title is recommended"),
            Rule.min(30).warning("Should be at least 30 characters"),
            Rule.max(60).warning("Google truncates after ~60 characters"),
          ],
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          components: { field: SeoMetaDescriptionField },
          rows: 4,
          description: "Target 50\u2013160 characters.",
          validation: (Rule) => [
            Rule.required().warning("Meta description is recommended"),
            Rule.min(50).warning("Should be at least 50 characters"),
            Rule.max(160).warning("Should not exceed 160 characters"),
          ],
        }),
        defineField({
          name: "keywordTags",
          title: "Keyword Tags",
          type: "tags",
          description:
            "Reusable SEO keywords. Tags you create are suggested in future pages.",
          options: {
            includeFromRelated: "keywordTags",
            allowCreate: true,
            onCreate: (inputValue: string) => ({
              label: inputValue.trim(),
              value: inputValue
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-"),
            }),
          },
        }),
        defineField({
          name: "shareImage",
          title: "Share Image",
          type: "image",
          description: "Recommended 1200\u00d7630 for social sharing.",
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
