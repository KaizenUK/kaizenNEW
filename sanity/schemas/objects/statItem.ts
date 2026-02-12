import { defineField, defineType } from "sanity";

export const statItem = defineType({
  name: "statItem",
  title: "Stat Item",
  type: "object",
  fields: [
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      description: 'The number or metric, e.g. "98%", "500+", "24/7".',
      validation: (Rule) => Rule.required().max(20),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description: 'What the number represents, e.g. "Client Satisfaction".',
      validation: (Rule) => Rule.required().max(80),
    }),
  ],
  preview: {
    select: {
      value: "value",
      label: "label",
    },
    prepare: ({ value, label }) => ({
      title: `${value || "?"} — ${label || "Stat"}`,
    }),
  },
});
