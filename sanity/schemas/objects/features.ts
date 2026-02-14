import { defineArrayMember, defineField, defineType } from "sanity";
import { LayoutGrid } from "lucide-react";

export const features = defineType({
  name: "features",
  title: "Features",
  type: "object",
  icon: LayoutGrid,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(100),
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [defineArrayMember({ type: "featureItem" })],
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
      title: heading || "Features",
    }),
  },
});
