import { defineField, defineType } from "sanity";
import { Sparkles } from "lucide-react";

export const hero = defineType({
  name: "hero",
  title: "Hero",
  type: "object",
  icon: Sparkles,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "buttonLink",
      title: "Button Link",
      type: "callToAction",
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "subtitle",
      media: "image",
    },
  },
});
