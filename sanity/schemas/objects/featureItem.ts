import { defineField, defineType } from "sanity";

export const featureItem = defineType({
  name: "featureItem",
  title: "Feature Item",
  type: "object",
  fields: [
  
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "text",
      title: "Description",
      type: "string",
      validation: (Rule) => Rule.required().max(180),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "text",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || subtitle || "Feature Item",
      subtitle: subtitle || "",
    }),
  },
});
