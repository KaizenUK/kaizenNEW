import { defineArrayMember, defineField, defineType } from "sanity";
import { HelpCircle } from "lucide-react";

export const faqSection = defineType({
  name: "faqSection",
  title: "FAQ Section",
  type: "object",
  icon: HelpCircle,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      initialValue: "Frequently Asked Questions",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "items",
      title: "Questions",
      type: "array",
      of: [defineArrayMember({ type: "faqItem" })],
      validation: (Rule) => Rule.required().min(1),
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
      title: heading || "FAQ Section",
    }),
  },
});
