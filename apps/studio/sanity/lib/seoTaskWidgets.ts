import type { LayoutConfig } from "@sanity/dashboard";
import type { DocumentListWidgetConfig } from "sanity-plugin-dashboard-widget-document-list";

export type SeoTaskWidgetPreset = {
  title: string;
  query: string;
  layout?: LayoutConfig;
  showCreateButton?: boolean;
  createButtonText?: string;
};

/**
 * Centralized SEO task widget presets.
 * Edit these queries/titles to customize what appears in the SEO Tasks dashboard.
 */
export const seoTaskWidgetPresets: SeoTaskWidgetPreset[] = [
  {
    title: "Pages Needing SEO Work",
    query: `*[_type == "post" && (
      length(coalesce(seo.metaTitle, "")) < 40 ||
      length(coalesce(seo.metaDescription, "")) < 50 ||
      !defined(seo.focusKeyword) || seo.focusKeyword == "" ||
      (!defined(seo.shareImage) && !defined(mainImage) && !defined(coverImage))
    )] | order(_updatedAt desc) [0...25]`,
    layout: { width: "full" },
    showCreateButton: false,
  },
  {
    title: "Posts Missing Meta Title",
    query: `*[_type == "post" && !defined(seo.metaTitle)] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts With Short Meta Title (<30)",
    query: `*[_type == "post" && defined(seo.metaTitle) && length(seo.metaTitle) < 30] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts With Long Meta Title (>60)",
    query: `*[_type == "post" && defined(seo.metaTitle) && length(seo.metaTitle) > 60] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts Missing Meta Description",
    query: `*[_type == "post" && !defined(seo.metaDescription)] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts With Short Meta Description (<50)",
    query: `*[_type == "post" && defined(seo.metaDescription) && length(seo.metaDescription) < 50] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts With Long Meta Description (>160)",
    query: `*[_type == "post" && defined(seo.metaDescription) && length(seo.metaDescription) > 160] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts Missing Focus Keyword",
    query: `*[_type == "post" && (!defined(seo.focusKeyword) || seo.focusKeyword == "")] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts Missing Any Social Image",
    query: `*[_type == "post" && !defined(seo.shareImage) && !defined(mainImage) && !defined(coverImage)] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Posts Missing Author or Category",
    query: `*[_type == "post" && (!defined(author) || count(coalesce(categories, [])) == 0)] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Static SEO Pages Missing Meta",
    query: `*[_type == "staticPage" && (!defined(seo.metaTitle) || !defined(seo.metaDescription))] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
  {
    title: "Pages Missing SEO Meta",
    query: `*[_type == "page" && (!defined(seo.metaTitle) || !defined(seo.metaDescription))] | order(_updatedAt desc) [0...25]`,
    showCreateButton: false,
  },
];

export function toDocumentListWidgets(): DocumentListWidgetConfig[] {
  return seoTaskWidgetPresets.map((preset) => ({
    title: preset.title,
    query: preset.query,
    layout: preset.layout,
    showCreateButton: preset.showCreateButton ?? false,
    createButtonText: preset.createButtonText,
  }));
}
