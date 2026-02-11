import { defineField, defineType } from "sanity";

export const callToAction = defineType({
  name: "callToAction",
  title: "Call To Action",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Button Label",
      type: "string",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "href",
      title: "Button URL",
      type: "string",
      description: "Use absolute (https://...) or site-relative (/contact) URLs.",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || !value.trim()) {
            return "Button URL is required";
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
      name: "style",
      title: "Style",
      type: "string",
      initialValue: "primary",
      options: {
        layout: "radio",
        list: [
          { title: "Primary", value: "primary" },
          { title: "Ghost", value: "ghost" },
        ],
      },
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
      label: "label",
      href: "href",
      style: "style",
    },
    prepare: ({ label, href, style }) => ({
      title: label || "CTA Button",
      subtitle: `${style || "primary"} — ${href || "(missing href)"}`,
    }),
  },
});
