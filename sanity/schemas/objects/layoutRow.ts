import { defineArrayMember, defineField, defineType } from "sanity";
import { Columns } from "lucide-react";

export const layoutRow = defineType({
  name: "layoutRow",
  title: "Column Layout",
  type: "object",
  icon: Columns,
  fields: [
    defineField({
      name: "layout",
      title: "Layout",
      type: "string",
      initialValue: "50-50",
      validation: (Rule) => Rule.required(),
      options: {
        list: [
          { title: "50 / 50", value: "50-50" },
          { title: "33 / 33 / 33", value: "33-33-33" },
          { title: "70 / 30", value: "70-30" },
          { title: "30 / 70", value: "30-70" },
          { title: "25 / 50 / 25", value: "25-50-25" },
          { title: "25 / 25 / 25 / 25", value: "25-25-25-25" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "columns",
      title: "Columns",
      type: "array",
      of: [defineArrayMember({ type: "layoutColumn" })],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const layout =
            typeof context.parent === "object" &&
            context.parent !== null &&
            "layout" in context.parent
              ? String((context.parent as { layout?: string }).layout)
              : "50-50";

          const expectedCols: Record<string, number> = {
            "50-50": 2,
            "33-33-33": 3,
            "70-30": 2,
            "30-70": 2,
            "25-50-25": 3,
            "25-25-25-25": 4,
          };

          const expected = expectedCols[layout] ?? 2;
          const actual = Array.isArray(value) ? value.length : 0;

          if (actual !== expected) {
            return `This layout requires exactly ${expected} columns (currently ${actual}).`;
          }
          return true;
        }),
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: {
      layout: "layout",
      columns: "columns",
    },
    prepare: ({ layout, columns }) => ({
      title: `Column Layout (${layout || "50-50"})`,
      subtitle: `${Array.isArray(columns) ? columns.length : 0} columns`,
    }),
  },
});
