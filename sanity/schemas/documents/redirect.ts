import { defineField, defineType } from "sanity";

export const redirect = defineType({
  name: "redirect",
  title: "Redirect",
  type: "document",
  fields: [
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      description: "Path to match, e.g. /old-page",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string") return "Source is required";
          if (!value.startsWith("/")) return "Source must start with /";
          return true;
        }),
    }),
    defineField({
      name: "destination",
      title: "Destination",
      type: "string",
      description: "Target path or absolute URL.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "isPermanent",
      title: "Permanent Redirect (301)",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      source: "source",
      destination: "destination",
      isPermanent: "isPermanent",
    },
    prepare: ({ source, destination, isPermanent }) => ({
      title: `${source ?? "(missing)"} → ${destination ?? "(missing)"}`,
      subtitle: isPermanent ? "301 Permanent" : "302 Temporary",
    }),
  },
});
