import { defineArrayMember, defineField, defineType } from "sanity";
import { Building2 } from "lucide-react";

export const logoBarItem = defineType({
  name: "logoBarItem",
  title: "Logo",
  type: "object",
  fields: [
    defineField({
      name: "image",
      title: "Logo Image",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "alt",
      title: "Alt Text",
      type: "string",
      validation: (Rule) => Rule.required().max(100),
    }),
    defineField({
      name: "href",
      title: "Link (optional)",
      type: "url",
      validation: (Rule) =>
        Rule.uri({ allowRelative: true, scheme: ["http", "https"] }),
    }),
  ],
  preview: {
    select: { title: "alt", media: "image" },
  },
});

export const logoBar = defineType({
  name: "logoBar",
  title: "Logo / Client Bar",
  type: "object",
  icon: Building2,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: 'e.g. "Trusted by" or "Our Partners".',
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "logos",
      title: "Logos",
      type: "array",
      of: [defineArrayMember({ type: "logoBarItem" })],
      validation: (Rule) => Rule.required().min(1).max(20),
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
      title: title || "Logo Bar",
      subtitle: "Logos / Partners",
    }),
  },
});
