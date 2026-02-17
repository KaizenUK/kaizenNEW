import { defineField, defineType } from "sanity";

export const socialLink = defineType({
  name: "socialLink",
  title: "Social Link",
  type: "object",
  fields: [
    defineField({
      name: "platform",
      title: "Platform",
      type: "string",
      validation: (Rule) => Rule.required().max(30),
    }),
    defineField({
      name: "url",
      title: "URL",
      type: "string",
      validation: (Rule) => Rule.required().uri({ allowRelative: false }),
    }),
  ],
  preview: {
    select: {
      platform: "platform",
      url: "url",
    },
    prepare: ({ platform, url }) => ({
      title: platform || "Social Link",
      subtitle: url,
    }),
  },
});
