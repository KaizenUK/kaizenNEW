import { defineArrayMember, defineField, defineType } from "sanity";
import { Users } from "lucide-react";

export const teamGridMember = defineType({
  name: "teamGridMember",
  title: "Team Member",
  type: "object",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required().max(60),
    }),
    defineField({
      name: "role",
      title: "Role / Title",
      type: "string",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "image",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "bio",
      title: "Short Bio",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "linkedin",
      title: "LinkedIn URL",
      type: "url",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "image" },
  },
});

export const teamGrid = defineType({
  name: "teamGrid",
  title: "Team Grid",
  type: "object",
  icon: Users,
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "members",
      title: "Members",
      type: "array",
      of: [defineArrayMember({ type: "teamGridMember" })],
      validation: (Rule) => Rule.required().min(1).max(12),
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
      title: title || "Team Grid",
      subtitle: "People",
    }),
  },
});
