import { defineField, defineType } from "sanity";

export const faqItem = defineType({
  name: "faqItem",
  title: "FAQ Item",
  type: "object",
  fields: [
    defineField({
      name: "question",
      title: "Question",
      type: "string",
      validation: (Rule) => Rule.required().max(200),
    }),
    defineField({
      name: "answer",
      title: "Answer",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.required().max(1000),
    }),
  ],
  preview: {
    select: {
      title: "question",
      subtitle: "answer",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "FAQ Item",
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 80) : "",
    }),
  },
});
