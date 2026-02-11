import { defineArrayMember, defineField, defineType } from "sanity";

export const imageGallery = defineType({
  name: "imageGallery",
  title: "Image Gallery",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alt text",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "caption",
              type: "string",
              title: "Caption",
            }),
          ],
        }),
      ],
      validation: (Rule) => Rule.required().min(1).max(12),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      image0: "images.0",
    },
    prepare: ({ heading, image0 }) => ({
      title: heading || "Image Gallery",
      media: image0,
    }),
  },
});
