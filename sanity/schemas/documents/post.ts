import { defineArrayMember, defineField, defineType } from "sanity";
import { 
  EditIcon, 
  ImageIcon, 
  SearchIcon, 
  CogIcon 
} from "@sanity/icons"; // <--- Import icons here
import { PostSeoStatsField } from "../../components/PostSeoStatsField";
import { SeoMetaDescriptionField } from "../../components/SeoMetaDescriptionField";
import { SeoMetaTitleField } from "../../components/SeoMetaTitleField";
import { SlugQualityField } from "../../components/SlugQualityField";

// ... (Your STOP_WORDS constants remain here - concealed for brevity) ...
const MUST_REMOVE_STOP_WORDS = new Set(["a", "an", "the", "and", "or", "but", "of", "for", "in", "on", "at", "to", "from", "with", "by", "as", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "it", "its", "that", "this", "these", "those"]);
const NICE_TO_REMOVE_STOP_WORDS = new Set(["your", "my", "their", "our", "we", "you", "they", "he", "she", "him", "her", "who", "which", "what", "where", "when", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now"]);

export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  // 1. PRETTY GROUPS WITH ICONS
  groups: [
    { 
      name: "content", 
      title: "Content", 
      icon: EditIcon, // Adds the pencil icon
      default: true 
    },
    { 
      name: "media", 
      title: "Media", 
      icon: ImageIcon // Adds the image icon
    },
    { 
      name: "seo", 
      title: "SEO", 
      icon: SearchIcon // Adds the magnifying glass
    },
    { 
      name: "settings", 
      title: "Settings", 
      icon: CogIcon // Adds the gear icon
    },
  ],
  fields: [
    // ... (The rest of your fields remain EXACTLY the same) ...
    // Just copy the fields from the previous file I gave you.
    // Ensure 'group: "content"', etc., is still set on them.
    
    // ── Content group ──────────────────────────────────────────────
    defineField({
      name: "title",
      type: "string",
      validation: (Rule) => Rule.required(),
      group: "content",
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      components: { field: SlugQualityField },
      group: "settings",
      description: "Keep slugs short and keyword focused.",
      validation: (Rule) => [
        Rule.required(),
        Rule.custom((value) => {
             // ... your slug validation logic ...
             return true; 
        }).warning(),
      ],
    }),
    defineField({
      name: "body",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true, aiAssist: { exclude: true } },
          fields: [defineField({ name: "alt", type: "string", title: "Alt text" })],
        }),
        defineArrayMember({ type: "callToAction" }),
        defineArrayMember({ type: "codeBlock" }),
        defineArrayMember({ type: "videoEmbed" }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      group: "content",
      description: "Short summary used on index cards and social snippets.",
      validation: (Rule) => Rule.max(240),
    }),

    // ── Media group ────────────────────────────────────────────────
    defineField({
      name: "mainImage",
      title: "Main Image",
      type: "image",
      group: "media",
      options: { hotspot: true, aiAssist: { exclude: true } },
      fields: [defineField({ name: "alt", type: "string", title: "Alt text" })],
    }),
    defineField({
      name: "coverImage",
      title: "Legacy Cover Image",
      type: "image",
      group: "media",
      options: { hotspot: true, aiAssist: { exclude: true } },
      hidden: ({ document }) => Boolean((document as { mainImage?: unknown })?.mainImage),
      fields: [defineField({ name: "alt", type: "string", title: "Alt text" })],
    }),

    // ── SEO group ──────────────────────────────────────────────────
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      group: "seo",
      options: { collapsible: false, collapsed: false },
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          components: { field: SeoMetaTitleField },
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "focusKeyword",
          title: "Focus Keyword",
          type: "string",
        }),
        defineField({
          name: "keywordTags",
          title: "Keyword Tags",
          type: "tags",
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          components: { field: SeoMetaDescriptionField },
          rows: 4,
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "shareImage",
          title: "Share Image",
          type: "image",
        }),
        defineField({
          name: "canonicalUrl",
          title: "Canonical URL",
          type: "url",
        }),
      ],
    }),

    // ── Settings group ─────────────────────────────────────────────
    defineField({
      name: "seoStatsPanel",
      title: "SEO Stats",
      type: "string",
      readOnly: true,
      group: "seo",
      components: { field: PostSeoStatsField },
    }),
    defineField({
      name: "author",
      type: "reference",
      to: [{ type: "author" }],
      group: "settings",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      group: "settings",
      of: [defineArrayMember({ type: "reference", to: [{ type: "category" }] })],
    }),
    defineField({
      name: "publishedAt",
      type: "datetime",
      group: "settings",
      validation: (Rule) => Rule.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "readTime",
      type: "number",
      group: "settings",
      validation: (Rule) => Rule.min(1).max(60),
    }),
  ],
  // ... (orderings and preview remain the same) ...
  orderings: [
    { title: "Published Date (Newest)", name: "publishedAtDesc", by: [{ field: "publishedAt", direction: "desc" }] },
    { title: "Published Date (Oldest)", name: "publishedAtAsc", by: [{ field: "publishedAt", direction: "asc" }] },
    { title: "Title A→Z", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
  preview: {
    select: { title: "title", subtitle: "author.name", media: "mainImage", fallbackMedia: "coverImage" },
    prepare: ({ title, subtitle, media, fallbackMedia }) => ({ title, subtitle, media: media || fallbackMedia }),
  },
});