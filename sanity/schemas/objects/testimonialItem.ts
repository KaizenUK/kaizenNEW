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
      title: "Role / Job Title",
      type: "string",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "company",
      title: "Company",
      type: "string",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "image",
      title: "Avatar",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "quote",
      media: "image",
    },
    prepare: ({ title, subtitle, media }) => ({
      title: title || "Testimonial",
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 70) : "",
      media,
    }),
  },
});
