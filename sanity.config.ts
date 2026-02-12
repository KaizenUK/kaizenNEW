import { dashboardTool } from "@sanity/dashboard";
import { assist } from "@sanity/assist";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { teamMembersPlugin } from "@multidots/sanity-plugin-team-members";
import { media } from "sanity-plugin-media";
import { documentListWidget } from "sanity-plugin-dashboard-widget-document-list";
import { tags } from "sanity-plugin-tags-v4";
import { studioSessionPlugin } from "./src/lib/sanity/studioSessionPlugin";
import { resolvedProjectId, resolvedDataset } from "./sanity/lib/env";
import { toDocumentListWidgets } from "./sanity/lib/seoTaskWidgets";
import { schemaTypes } from "./sanity/schemas";
import { studioStructure } from "./sanity/structure";
import { singletonPlugin } from "./sanity/plugins/singleton";
import Dashboard from "./sanity/components/Dashboard";
import SeoDashboard from "./sanity/components/SeoDashboard";
import StudioNavbar from "./sanity/components/StudioNavbar";

function normalizeDocumentId(value: unknown): string {
  return String(value ?? "").replace(/^drafts\./, "").trim();
}

function normalizeSlugPathSegment(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeRoutePath(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "/";
  if (raw === "/") return "/";

  const normalized = raw.replace(/^\/+/, "").replace(/\/+$/, "");
  return normalized ? `/${normalized}` : "/";
}

export default defineConfig({
  name: "default",
  title: "Kaizen CMS",
  projectId: resolvedProjectId,
  dataset: resolvedDataset,
  basePath: "/studio",

  studio: {
    components: {
      navbar: StudioNavbar,
    },
  },

  plugins: [
    structureTool({ structure: studioStructure }),
    dashboardTool({
      name: "seoTasks",
      title: "SEO Tasks",
      widgets: toDocumentListWidgets().map((widget) =>
        documentListWidget(widget),
      ),
    }),
    media(),
    studioSessionPlugin(),
    visionTool(),
    assist(),
    tags({}),
    teamMembersPlugin(),
    presentationTool({
      previewUrl: {
        initial: "/",
        previewMode: {
          enable: "/api/draft",
          disable: "/api/draft?disable=1",
        },
      },
      resolve: {
        locations: {
          post: {
            select: { title: "title", slug: "slug.current", id: "_id" },
            resolve: (doc: Record<string, string> | null) => {
              const slug = normalizeSlugPathSegment(doc?.slug);
              const docId = normalizeDocumentId(doc?.id);
              const href = slug
                ? `/preview/blog/${encodeURIComponent(slug)}${docId ? `?id=${encodeURIComponent(docId)}` : ""}`
                : "/blog";

              return {
                locations: [
                  {
                    title: doc?.title || "Post",
                    href,
                  },
                ],
              };
            },
          },
          page: {
            select: { title: "title", slug: "slug.current" },
            resolve: (doc: Record<string, string> | null) => {
              const slug = normalizeSlugPathSegment(doc?.slug);
              return {
                locations: [
                  {
                    title: doc?.title || "Page",
                    href: slug ? `/${encodeURIComponent(slug)}` : "/",
                  },
                ],
              };
            },
          },
          staticPage: {
            select: { title: "title", route: "slug.current" },
            resolve: (doc: Record<string, string> | null) => ({
              locations: [
                {
                  title: doc?.title || "Static SEO Page",
                  href: normalizeRoutePath(doc?.route),
                },
              ],
            }),
          },
        },
      },
    }),
    singletonPlugin,
    {
      name: "disable-ai-assist-inspector-route",
      document: {
        inspectors: (prev: Array<{ name?: string }>) =>
          prev.filter((inspector) => inspector.name !== "ai-assistance"),
      },
    },
  ],

  tools: (prev) => [
    {
      name: "home",
      title: "Home",
      component: Dashboard,
    },
    {
      name: "seo",
      title: "SEO",
      component: SeoDashboard,
    },
    ...prev,
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    productionUrl: async (prev, { document }) => {
      const type = document._type;

      if (type === "post") {
        const slug =
          typeof document.slug === "object" &&
          document.slug !== null &&
          "current" in document.slug
            ? String(
                (document.slug as { current?: string }).current ?? "",
              ).trim()
            : "";
        if (slug) return `/preview/blog/${slug}`;
      }

      if (type === "page") {
        const slug = normalizeSlugPathSegment(
          typeof document.slug === "object" &&
            document.slug !== null &&
            "current" in document.slug
            ? String(
                (document.slug as { current?: string }).current ?? "",
              ).trim()
            : "",
        );
        if (slug) return `/${slug}`;
      }

      if (type === "staticPage") {
        const route = normalizeRoutePath(
          typeof document.slug === "object" &&
            document.slug !== null &&
            "current" in document.slug
            ? String(
                (document.slug as { current?: string }).current ?? "",
              ).trim()
            : "",
        );
        return route;
      }

      return prev;
    },
  },
});
