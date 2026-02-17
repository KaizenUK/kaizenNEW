import { defineArrayMember, defineField, defineType } from "sanity";
import { CreditCard } from "lucide-react";

export const pricingSection = defineType({
  name: "pricingSection",
  title: "Pricing Table",
  type: "object",
  icon: CreditCard,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "tiers",
      title: "Tiers",
      type: "array",
      of: [defineArrayMember({ type: "pricingTier" })],
      validation: (Rule) => Rule.required().min(1).max(4),
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: { title: "heading" },
    prepare: ({ title }) => ({
      title: title || "Pricing Table",
      subtitle: "Pricing",
    }),
  },
});
