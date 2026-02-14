import { defineField, defineType } from "sanity";

export const formField = defineType({
  name: "formField",
  title: "Form Field",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required().max(60),
    }),
    defineField({
      name: "fieldType",
      title: "Field Type",
      type: "string",
      initialValue: "text",
      options: {
        list: [
          { title: "Text", value: "text" },
          { title: "Email", value: "email" },
          { title: "Phone", value: "tel" },
          { title: "Multi-line Text", value: "textarea" },
          { title: "Dropdown", value: "select" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "placeholder",
      title: "Placeholder",
      type: "string",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "required",
      title: "Required",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "options",
      title: "Dropdown Options",
      type: "array",
      of: [{ type: "string" }],
      description: "Only used when field type is Dropdown.",
      hidden: ({ parent }) => parent?.fieldType !== "select",
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "fieldType" },
  },
});
