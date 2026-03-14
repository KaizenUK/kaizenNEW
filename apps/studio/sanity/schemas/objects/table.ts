import { defineArrayMember, defineField, defineType } from "sanity";

export const tableCell = defineType({
  name: "tableCell",
  title: "Table Cell",
  type: "object",
  fields: [
    defineField({
      name: "content",
      title: "Content",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.required().max(500),
    }),
  ],
  preview: {
    select: {
      title: "content",
    },
    prepare: ({ title }) => ({
      title: typeof title === "string" && title.trim() ? title : "Empty cell",
    }),
  },
});

export const tableRow = defineType({
  name: "tableRow",
  title: "Table Row",
  type: "object",
  fields: [
    defineField({
      name: "cells",
      title: "Cells",
      type: "array",
      of: [defineArrayMember({ type: "tableCell" })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      cells: "cells",
    },
    prepare: ({ cells }) => {
      const values = Array.isArray(cells)
        ? cells
            .map((cell) =>
              typeof cell?.content === "string" ? cell.content.trim() : "",
            )
            .filter(Boolean)
        : [];

      return {
        title: values.length ? values.join(" | ") : "Empty row",
        subtitle: `${Array.isArray(cells) ? cells.length : 0} cell${Array.isArray(cells) && cells.length === 1 ? "" : "s"}`,
      };
    },
  },
});

export const table = defineType({
  name: "table",
  title: "Table",
  type: "object",
  fields: [
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional label shown below the table.",
      validation: (Rule) => Rule.max(180),
    }),
    defineField({
      name: "hasHeaderRow",
      title: "Use first row as header",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "rows",
      title: "Rows",
      type: "array",
      of: [defineArrayMember({ type: "tableRow" })],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .custom((rows) => {
            if (!Array.isArray(rows) || rows.length === 0) return true;

            const columnCounts = rows.map((row) =>
              Array.isArray(row?.cells) ? row.cells.length : 0,
            );
            const expected = columnCounts[0] ?? 0;

            return columnCounts.every((count) => count === expected)
              ? true
              : "Each row should have the same number of cells.";
          }),
    }),
  ],
  preview: {
    select: {
      caption: "caption",
      rows: "rows",
    },
    prepare: ({ caption, rows }) => {
      const rowCount = Array.isArray(rows) ? rows.length : 0;
      const columnCount =
        Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0]?.cells)
          ? rows[0].cells.length
          : 0;

      return {
        title:
          typeof caption === "string" && caption.trim() ? caption : "Table",
        subtitle: `${rowCount} row${rowCount === 1 ? "" : "s"} x ${columnCount} column${columnCount === 1 ? "" : "s"}`,
      };
    },
  },
});
