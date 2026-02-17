import { defineArrayMember, defineField, defineType } from "sanity";
import { FileText } from "lucide-react";

export const richTextSection = defineType({
  name: "richTextSection",
  title: "Rich Text Section",
  type: "object",
  icon: FileText,
  fields: [
    defineField({
      name: "heading",
      title: "Section Heading",
      type: "string",
      description: "Optional heading displayed above the content.",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "body",
      title: "Content",
      type: "array",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alt text",
            }),
          ],
        }),
        defineArrayMember({ type: "callToAction" }),
        defineArrayMember({ type: "codeBlock" }),
      ],
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
      title: "heading",
    },
    prepare: ({ title }) => ({
      title: title || "Rich Text Section",
    }),
  },
});
