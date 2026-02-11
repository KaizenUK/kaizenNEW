import { defineField, defineType } from "sanity";

export const featureItem = defineType({
  name: "featureItem",
  title: "Feature Item",
  type: "object",
  fields: [
    defineField({
      name: "icon",
      title: "Icon",
      type: "string",
      description: "Icon name or emoji.",
      validation: (Rule) => Rule.required().max(40),
    }),
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
      icon: "icon",
    },
    prepare: ({ title, subtitle, icon }) => ({
      title: title || subtitle || "Feature Item",
      subtitle: icon ? `Icon: ${icon}` : "No icon",
    }),
  },
});
