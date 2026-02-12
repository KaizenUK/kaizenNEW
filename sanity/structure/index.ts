import { contextDocumentTypeName } from "@sanity/assist";
import { SEOPane } from "sanity-plugin-seo-pane";
import type { StructureBuilder } from "sanity/structure";
import type { SanityDocument } from "sanity";
import { SITE_SETTINGS_ID } from "../schemas/documents/siteSettings";
import { siteUrl } from "../lib/env";

function resolveSeoPaneSiteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return siteUrl;
}

const seoPaneSiteUrl = resolveSeoPaneSiteUrl();

function normalizeDocumentId(id: unknown): string {
  return String(id ?? "").replace(/^drafts\./, "").trim();
}

function resolvePostPreviewUrl(doc: SanityDocument): string {
  const slugValue =
    typeof doc.slug === "object" && doc.slug !== null && "current" in doc.slug
      ? String((doc.slug as { current?: string }).current ?? "").trim()
      : "";
  const docId = normalizeDocumentId((doc as { _id?: string })._id);

  if (!slugValue) return `${seoPaneSiteUrl}/blog`;

  const previewUrl = `${seoPaneSiteUrl}/preview/blog/${encodeURIComponent(slugValue)}`;
  return docId ? `${previewUrl}?id=${encodeURIComponent(docId)}` : previewUrl;
}

export const studioStructure = (S: StructureBuilder) =>
  S.list()
    .title("Kaizen CMS")
    .items([
      // ── Site Settings (singleton) ────────────────────────────────
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

      // ── Blog ─────────────────────────────────────────────────────
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
            ]),
        ),

      // ── Pages ────────────────────────────────────────────────────
      S.documentTypeListItem("page").title("Pages"),

      S.divider(),

      // ── Utilities ────────────────────────────────────────────────
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
