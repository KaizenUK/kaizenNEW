import { defineField, defineType } from "sanity";

export const testimonialItem = defineType({
  name: "testimonialItem",
  title: "Testimonial Item",
  type: "object",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.required().max(600),
    }),
    defineField({
      name: "name",
      title: "Client Name",
      type: "string",
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: "role",
      title: "Client Role / Company",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "avatar",
      title: "Avatar",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "quote",
      media: "avatar",
    },
    prepare: ({ title, subtitle, media }) => ({
      title: title || "Testimonial",
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 70) : "",
      media,
    }),
  },
});
