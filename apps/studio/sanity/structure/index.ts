import { contextDocumentTypeName } from "@sanity/assist";
import type { StructureBuilder } from "sanity/structure";
import type { SanityDocument } from "sanity";
import { SITE_SETTINGS_ID } from "../schemas/documents/siteSettings";
import {
  ACTIVE_PUBLIC_PAGE_SLUGS,
  ACTIVE_STATIC_SEO_ROUTES,
} from "../../../../shared/publicRoutePolicy.js";
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

  const previewUrl = `/preview-blog/${encodeURIComponent(slugValue)}`;
  return docId ? `${previewUrl}?id=${encodeURIComponent(docId)}` : previewUrl;
}

function cleanDocumentId(documentId: string): string {
  return documentId.replace(/^drafts\./, "");
}

// --- Views ---
// Keep it simple for now: ONLY the form view.
// (If/when you re-add SEO, add it back here once the plugin versions match your React/Sanity setup.)
const postViews = (S: StructureBuilder) => [S.view.form()];
const ACTIVE_PAGE_SLUGS = [...ACTIVE_PUBLIC_PAGE_SLUGS];
const ACTIVE_STATIC_ROUTES = [...ACTIVE_STATIC_SEO_ROUTES];

// --- Structure ---

export const studioStructure = (S: StructureBuilder) =>
  S.list()
    .title("Kaizen CMS")
    .items([
      // ======================================================
      // GLOBAL DRAFTS
      // ======================================================
      S.listItem()
        .title("Drafts")
        .id("drafts")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Drafts")
            .apiVersion("2024-01-01")
            .filter(
              '(_type == "post" || (_type == "page" && slug.current in $allowedPageSlugs) || (_type == "staticPage" && slug.current in $allowedStaticRoutes)) && _originalId in path("drafts.**")',
            )
            .params({
              allowedPageSlugs: ACTIVE_PAGE_SLUGS,
              allowedStaticRoutes: ACTIVE_STATIC_ROUTES,
            })
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            // IMPORTANT: force schemaType for the document pane
            .child((documentId) =>
              S.document()
                .documentId(documentId)
                .schemaType(
                  // Best-effort: schemaType is derived by Sanity in the list,
                  // but we still need *a* schemaType for the document node.
                  // If this ever misroutes, split drafts into separate lists by type.
                  "post",
                ),
            ),
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

      // Draft Posts
      S.listItem()
        .title("Draft Posts")
        .id("draft-posts")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Draft Posts")
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
          S.documentList()
            .title("All Pages")
            .apiVersion("2024-01-01")
            .filter('_type == "page" && slug.current in $allowedPageSlugs')
            .params({ allowedPageSlugs: ACTIVE_PAGE_SLUGS })
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("page"),
            ),
        ),

      // Draft Pages
      S.listItem()
        .title("Draft Pages")
        .id("draft-pages")
        .icon(EditIcon)
        .child(
          S.documentList()
            .title("Draft Pages")
            .apiVersion("2024-01-01")
            .filter(
              '_type == "page" && _originalId in path("drafts.**") && slug.current in $allowedPageSlugs',
            )
            .params({ allowedPageSlugs: ACTIVE_PAGE_SLUGS })
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document().documentId(documentId).schemaType("page"),
            ),
        ),

      // Static SEO Pages
      S.listItem()
        .title("Static SEO Pages")
        .id("static-seo-pages")
        .icon(SearchIcon)
        .child(
          S.documentList()
            .title("Static SEO Pages")
            .apiVersion("2024-01-01")
            .filter('_type == "staticPage" && slug.current in $allowedStaticRoutes')
            .params({ allowedStaticRoutes: ACTIVE_STATIC_ROUTES })
            .defaultOrdering([{ field: "slug.current", direction: "asc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("staticPage"),
            ),
        ),

      S.divider(),

      // ======================================================
      // GROUP 3: DATA & SETTINGS
      // ======================================================

      S.documentTypeListItem("category")
        .title("Categories")
        .id("categories-list")
        .icon(TagIcon)
        .child(
          S.documentTypeList("category")
            .title("Categories")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("category"),
            ),
        ),

      S.documentTypeListItem("author")
        .title("Authors")
        .id("authors-list")
        .icon(UsersIcon)
        .child(
          S.documentTypeList("author")
            .title("Authors")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("author"),
            ),
        ),

      S.documentTypeListItem("redirect")
        .title("Redirects")
        .id("redirects-list")
        .icon(ArrowRightIcon)
        .child(
          S.documentTypeList("redirect")
            .title("Redirects")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType("redirect"),
            ),
        ),

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
        .id("ai-context-list")
        .child(
          S.documentTypeList(contextDocumentTypeName)
            .title("AI Context Editor")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
            .child((documentId) =>
              S.document()
                .documentId(cleanDocumentId(documentId))
                .schemaType(contextDocumentTypeName),
            ),
        ),
    ]);
