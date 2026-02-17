import { contextDocumentTypeName } from "@sanity/assist";
import { SEOPane } from "sanity-plugin-seo-pane";
import type { StructureBuilder } from "sanity/structure";
import type { SanityDocument } from "sanity";
import { SITE_SETTINGS_ID } from "../schemas/documents/siteSettings";
import {
  EarthGlobeIcon,
  EditIcon,
  CalendarIcon,
  DocumentsIcon,
  CogIcon,
  UsersIcon,
  TagIcon,
  SearchIcon,
  ArrowRightIcon,
} from "@sanity/icons";

// --- Helpers ---

function normalizeDocumentId(id: unknown): string {
  return String(id ?? "").replace(/^drafts\./, "").trim();
}

function normalizeSlugPathSegment(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function resolvePostPreviewUrl(doc: SanityDocument): string {
  const slugValue = normalizeSlugPathSegment(
    typeof doc.slug === "object" && doc.slug !== null && "current" in doc.slug
      ? String((doc.slug as { current?: string }).current ?? "").trim()
      : "",
  );

  const docId = normalizeDocumentId((doc as { _id?: string })._id);

  if (!slugValue) return "/blog";

  const previewUrl = `/preview/blog/${encodeURIComponent(slugValue)}`;
  return docId ? `${previewUrl}?id=${encodeURIComponent(docId)}` : previewUrl;
}

function cleanDocumentId(documentId: string): string {
  return documentId.replace(/^drafts\./, "");
}

// --- Views ---
const postViews = (S: StructureBuilder) => [
  S.view.form(),
  S.view
    .component(SEOPane)
    .title("SEO")
    .options({
      keywords: "seo.focusKeyword",
      synonyms: "seo.focusKeyword",
      url: resolvePostPreviewUrl,
    }),
];

// --- Structure ---

export const studioStructure = (S: StructureBuilder) =>
  S.list()
    .title("Kaizen CMS")
    .items([
      // ======================================================
      // GLOBAL DRAFTS 
      // Route: /studio/structure/drafts
      // ======================================================
      S.listItem()
        .title("Drafts")
        .id("drafts")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Drafts")
            .apiVersion("2024-01-01")
            .filter('_type in ["post","page","staticPage"] && _originalId in path("drafts.**")')
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]),
        ),

      S.divider(),

      // ======================================================
      // GROUP 1: BLOGGING
      // ======================================================

      // All Posts
      S.documentTypeListItem("post")
        .title("All Posts")
        .id("all-posts")
        .icon(DocumentsIcon)
        .child(
          S.documentTypeList("post")
            .title("All Posts")
            .defaultOrdering([{ field: "publishedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("post")
                .views(postViews(S)),
            ),
        ),

      // Draft (Posts)
      S.listItem()
        .title("Draft Posts")
        .id("draft-posts")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Draft")
            .apiVersion("2024-01-01")
            .filter('_type == "post" && _originalId in path("drafts.**")')
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(documentId)
                .schemaType("post")
                .views(postViews(S)),
            ),
        ),

      // Scheduled Posts (published docs only)
      S.listItem()
        .title("Scheduled Posts")
        .id("scheduled-posts")
        .icon(CalendarIcon)
        .child(
          S.documentTypeList("post")
            .title("Scheduled Posts")
            .apiVersion("2024-01-01")
            .filter(
              '_type == "post" && defined(publishedAt) && dateTime(publishedAt) > dateTime(now())',
            )
            .defaultOrdering([{ field: "publishedAt", direction: "asc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("post")
                .views(postViews(S)),
            ),
        ),

      S.divider(),

      // ======================================================
      // GROUP 2: SITE STRUCTURE
      // ======================================================

      // All Pages
      S.documentTypeListItem("page")
        .title("All Pages")
        .id("all-pages")
        .icon(EarthGlobeIcon)
        .child(
          S.documentTypeList("page")
            .title("All Pages")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]),
        ),

      // Draft (Pages)
      S.listItem()
        .title("Draft Pages")
        .id("draft-pages")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Draft (Pages)")
            .apiVersion("2024-01-01")
            .filter('_type == "page" && _originalId in path("drafts.**")')
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document().documentId(documentId).schemaType("page"),
            ),
        ),

      S.listItem()
        .title("Static SEO Pages")
        .id("static-seo-pages")
        .icon(SearchIcon)
        .child(
          S.documentTypeList("staticPage")
            .title("Static SEO Pages")
            .defaultOrdering([{ field: "slug.current", direction: "asc" }]),
        ),

      S.divider(),

      // ======================================================
      // GROUP 3: DATA & SETTINGS
      // ======================================================

      S.documentTypeListItem("category")
        .title("Categories")
        .id("categories-list")
        .icon(TagIcon),

      S.documentTypeListItem("author")
        .title("Authors")
        .id("authors-list")
        .icon(UsersIcon),

      S.documentTypeListItem("redirect")
        .title("Redirects")
        .id("redirects-list")
        .icon(ArrowRightIcon),

      S.listItem()
        .title("Site Settings")
        .id("site-settings-list")
        .icon(CogIcon)
        .child(
          S.editor()
            .id("site-settings-editor")
            .schemaType("siteSettings")
            .documentId(SITE_SETTINGS_ID),
        ),

      S.documentTypeListItem(contextDocumentTypeName)
        .title("AI Context Editor")
        .id("ai-context-list"),
    ]);
