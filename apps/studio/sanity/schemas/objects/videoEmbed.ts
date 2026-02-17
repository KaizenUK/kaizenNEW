import { defineField, defineType } from "sanity";
import { Video } from "lucide-react";

export const videoEmbed = defineType({
  name: "videoEmbed",
  title: "Video Embed",
  type: "object",
  icon: Video,
  fields: [
    defineField({
      name: "url",
      title: "Video URL",
      type: "url",
      description: "Paste a YouTube or Vimeo URL.",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string") return "URL is required";
          if (
            value.includes("youtube.com") ||
            value.includes("youtu.be") ||
            value.includes("vimeo.com")
          ) {
            return true;
          }
          return "Only YouTube and Vimeo URLs are supported";
        }),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      validation: (Rule) => Rule.max(200),
    }),
    defineField({
      name: "settings",
      title: "Section Settings",
      type: "sectionSettings",
    }),
  ],
  preview: {
    select: {
      url: "url",
      caption: "caption",
    },
    prepare: ({ url, caption }) => ({
      title: caption || "Video Embed",
      subtitle: url || "No URL",
    }),
  },
});
