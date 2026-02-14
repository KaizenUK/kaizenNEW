import { defineArrayMember, defineField, defineType } from "sanity";
import { Mail } from "lucide-react";

export const contactForm = defineType({
  name: "contactForm",
  title: "Contact Form",
  type: "object",
  icon: Mail,
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
      name: "fields",
      title: "Form Fields",
      type: "array",
      of: [defineArrayMember({ type: "formField" })],
      validation: (Rule) => Rule.required().min(1).max(10),
    }),
    defineField({
      name: "submitLabel",
      title: "Submit Button Label",
      type: "string",
      initialValue: "Send Message",
      validation: (Rule) => Rule.required().max(30),
    }),
    defineField({
      name: "successMessage",
      title: "Success Message",
      type: "string",
      initialValue: "Thanks! We'll be in touch shortly.",
      validation: (Rule) => Rule.max(200),
    }),
    defineField({
      name: "actionUrl",
      title: "Form Action URL",
      type: "string",
      description:
        "Endpoint that receives the form data. Defaults to /api/contact if blank.",
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
      title: title || "Contact Form",
      subtitle: "Form",
    }),
  },
});
