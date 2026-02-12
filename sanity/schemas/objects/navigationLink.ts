import { defineField, defineType } from "sanity";

export const navigationLink = defineType({
  name: "navigationLink",
  title: "Navigation Link",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "href",
      title: "URL",
      type: "string",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || !value.trim()) {
            return "URL is required";
          }
          const href = value.trim();
          if (
            href.startsWith("/") ||
            href.startsWith("https://") ||
            href.startsWith("http://") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return true;
          }
          return "URL must start with /, https://, http://, mailto:, or tel:";
        }),
    }),
    defineField({
      name: "newTab",
      title: "Open In New Tab",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: "label",
      subtitle: "href",
    },
  },
});
