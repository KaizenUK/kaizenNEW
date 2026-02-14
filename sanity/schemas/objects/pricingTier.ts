import { defineField, defineType } from "sanity";

export const pricingTier = defineType({
  name: "pricingTier",
  title: "Pricing Tier",
  type: "object",
  fields: [
    defineField({
      name: "name",
      title: "Tier Name",
      type: "string",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "price",
      title: "Price",
      type: "string",
      description: 'Display price, e.g. "£2,000" or "From £500/mo".',
      validation: (Rule) => Rule.required().max(30),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.max(200),
    }),
    defineField({
      name: "features",
      title: "Feature List",
      type: "array",
      of: [{ type: "string" }],
      description: "One feature per line.",
    }),
    defineField({
      name: "buttonLink",
      title: "Button",
      type: "callToAction",
    }),
    defineField({
      name: "isHighlighted",
      title: "Highlighted / Recommended",
      type: "boolean",
      initialValue: false,
      description: "Visually emphasise this tier as the recommended option.",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "price" },
  },
});
