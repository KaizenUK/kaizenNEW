import { defineField, defineType } from "sanity";
import { MousePointerClick } from "lucide-react";

export const ctaSection = defineType({
  name: "ctaSection",
  title: "CTA Section",
  type: "object",
  icon: MousePointerClick,
  fields: [
    defineField({
      name: "text",
      title: "Big Text",
      type: "string",
      validation: (Rule) => Rule.required().max(180),
    }),
    defineField({
      name: "buttonLink",
      title: "Button",
      type: "callToAction",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: {
      title: "text",
      subtitle: "buttonLink.label",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "CTA Section",
      subtitle: subtitle ? `Button: ${subtitle}` : "No button",
    }),
  },
});
