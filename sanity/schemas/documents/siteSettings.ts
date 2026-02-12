import { defineArrayMember, defineField, defineType } from "sanity";

export const SITE_SETTINGS_ID = "siteSettings";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "siteTitle",
      title: "Site Title",
      type: "string",
      validation: (Rule) => Rule.required().max(100),
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "mainNavigation",
      title: "Main Navigation",
      type: "array",
      of: [defineArrayMember({ type: "navigationLink" })],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "footerText",
      title: "Footer Text",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.max(500),
    }),
    defineField({
      name: "socialLinks",
      title: "Social Links",
      type: "array",
      of: [defineArrayMember({ type: "socialLink" })],
    }),
    defineField({
      name: "defaultShareImage",
      title: "Default Share Image",
      type: "image",
      description: "Fallback OG image when a page or post has none.",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      title: "siteTitle",
      media: "logo",
    },
    prepare: ({ title, media }) => ({
      title: title || "Site Settings",
      subtitle: "Singleton",
      media,
    }),
  },
});
