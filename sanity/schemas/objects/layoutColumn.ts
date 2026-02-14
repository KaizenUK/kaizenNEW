import { defineArrayMember, defineField, defineType } from "sanity";

export const layoutColumn = defineType({
  name: "layoutColumn",
  title: "Column",
  type: "object",
  fields: [
    defineField({
      name: "content",
      title: "Column Content",
      type: "array",
      of: [
        defineArrayMember({ type: "hero" }),
        defineArrayMember({ type: "richTextSection" }),
        defineArrayMember({ type: "features" }),
        defineArrayMember({ type: "ctaSection" }),
        defineArrayMember({ type: "testimonials" }),
        defineArrayMember({ type: "faqSection" }),
        defineArrayMember({ type: "statsSection" }),
        defineArrayMember({ type: "imageGallery" }),
        defineArrayMember({ type: "videoEmbed" }),
        defineArrayMember({ type: "pricingSection" }),
        defineArrayMember({ type: "logoBar" }),
        defineArrayMember({ type: "teamGrid" }),
        defineArrayMember({ type: "contactForm" }),
        defineArrayMember({ type: "spacer" }),
      ],
    }),
    defineField({
      name: "verticalAlign",
      title: "Vertical Alignment",
      type: "string",
      initialValue: "top",
      options: {
        list: [
          { title: "Top", value: "top" },
          { title: "Center", value: "center" },
          { title: "Bottom", value: "bottom" },
        ],
        layout: "radio",
      },
    }),
  ],
  preview: {
    select: {
      content: "content",
    },
    prepare: ({ content }) => ({
      title: `Column (${Array.isArray(content) ? content.length : 0} items)`,
    }),
  },
});
