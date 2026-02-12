import { defineField, defineType } from "sanity";

export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "role",
      type: "string",
      initialValue: "Author",
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 3,
      description: "Short biography for the author page.",
      validation: (Rule) => Rule.max(300),
    }),
  ],
  preview: {
    select: {
      title: "name",
      media: "image",
      subtitle: "role",
    },
  },
});
