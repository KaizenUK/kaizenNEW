import { defineField, defineType } from "sanity";
import { SeparatorHorizontal } from "lucide-react";

export const spacer = defineType({
  name: "spacer",
  title: "Spacer / Divider",
  type: "object",
  icon: SeparatorHorizontal,
  fields: [
    defineField({
      name: "height",
      title: "Height",
      type: "string",
      initialValue: "md",
      validation: (Rule) => Rule.required(),
      options: {
        list: [
          { title: "Small (2rem)", value: "sm" },
          { title: "Medium (4rem)", value: "md" },
          { title: "Large (6rem)", value: "lg" },
          { title: "Extra Large (8rem)", value: "xl" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "showLine",
      title: "Show Divider Line",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: { height: "height", showLine: "showLine" },
    prepare: ({ height, showLine }) => ({
      title: showLine ? "Divider" : "Spacer",
      subtitle: `Height: ${height || "md"}`,
    }),
  },
});
