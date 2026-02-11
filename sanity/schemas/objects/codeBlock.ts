import { defineField, defineType } from "sanity";

export const codeBlock = defineType({
  name: "codeBlock",
  title: "Code Block",
  type: "object",
  fields: [
    defineField({
      name: "language",
      type: "string",
      title: "Language",
      initialValue: "typescript",
      options: {
        list: [
          { title: "TypeScript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
          { title: "TSX", value: "tsx" },
          { title: "JSX", value: "jsx" },
          { title: "CSS", value: "css" },
          { title: "Bash", value: "bash" },
          { title: "JSON", value: "json" },
          { title: "HTML", value: "markup" },
          { title: "Python", value: "python" },
          { title: "SQL", value: "sql" },
        ],
      },
    }),
    defineField({
      name: "filename",
      type: "string",
      title: "Filename",
      description: "Optional filename shown above the code block.",
    }),
    defineField({
      name: "code",
      type: "text",
      rows: 10,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "language",
      subtitle: "code",
      filename: "filename",
    },
    prepare: ({ title, subtitle, filename }) => ({
      title: filename || `${title ?? "code"} snippet`,
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 64) : "",
    }),
  },
});
