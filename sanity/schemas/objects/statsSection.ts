import { defineArrayMember, defineField, defineType } from "sanity";
import { BarChart3 } from "lucide-react";

export const statsSection = defineType({
  name: "statsSection",
  title: "Stats Section",
  type: "object",
  icon: BarChart3,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "items",
      title: "Stats",
      type: "array",
      of: [defineArrayMember({ type: "statItem" })],
      validation: (Rule) => Rule.required().min(2).max(6),
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: {
      heading: "heading",
    },
    prepare: ({ heading }) => ({
      title: heading || "Stats Section",
    }),
  },
});
