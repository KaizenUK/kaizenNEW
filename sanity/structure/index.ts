import { contextDocumentTypeName } from "@sanity/assist";
import { SEOPane } from "sanity-plugin-seo-pane";
import type { StructureBuilder } from "sanity/structure";
import type { SanityDocument } from "sanity";
import { SITE_SETTINGS_ID } from "../schemas/documents/siteSettings";

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

export const studioStructure = (S: StructureBuilder) =>
  S.list()
    .title("Kaizen CMS")
    .items([
      S.listItem()
        .title("Site Settings")
        .id("site-settings")
        .child(
          S.editor()
            .id("site-settings-editor")
            .schemaType("siteSettings")
            .documentId(SITE_SETTINGS_ID),
        ),

      S.divider(),

      S.listItem()
        .title("Blog")
        .id("blog")
        .child(
          S.list()
            .title("Blog")
            .items([
              S.documentTypeListItem("post")
                .title("Posts")
                .child(
                  S.documentTypeList("post")
                    .title("Posts")
                    .defaultOrdering([
                      { field: "publishedAt", direction: "desc" },
                    ])
                    .child((documentId) =>
                      S.document()
                        .documentId(documentId)
                        .schemaType("post")
                        .views([
                          S.view.form(),
                          S.view
                            .component(SEOPane)
                            .title("SEO")
                            .options({
                              keywords: "seo.focusKeyword",
                              synonyms: "seo.focusKeyword",
                              url: resolvePostPreviewUrl,
                            }),
                        ]),
                    ),
                ),
              S.documentTypeListItem("category").title("Categories"),
              S.documentTypeListItem("author").title("Authors"),
              S.documentTypeListItem("teamMember").title("Team Members"),
            ]),
        ),

      S.listItem()
        .title("Pages")
        .id("page")
        .child(
          S.documentTypeList("page")
            .title("Pages")
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]),
        ),
      S.listItem()
        .title("Static SEO Pages")
        .id("staticPage")
        .child(
          S.documentTypeList("staticPage")
            .title("Static SEO Pages")
            .defaultOrdering([{ field: "slug.current", direction: "asc" }]),
        ),

      S.divider(),

      S.listItem()
        .title("Utilities")
        .id("utilities")
        .child(
          S.list()
            .title("Utilities")
            .items([
              S.documentTypeListItem("redirect").title("Redirects"),
              S.documentTypeListItem(contextDocumentTypeName).title(
                "AI Context",
              ),
            ]),
        ),
    ]);
