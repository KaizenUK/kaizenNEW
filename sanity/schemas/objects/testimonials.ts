import { defineArrayMember, defineField, defineType } from "sanity";

export const testimonials = defineType({
  name: "testimonials",
  title: "Testimonials",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "items",
      title: "Quotes",
      type: "array",
      of: [defineArrayMember({ type: "testimonialItem" })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => ({
      title: heading || "Testimonials",
    }),
  },
});
