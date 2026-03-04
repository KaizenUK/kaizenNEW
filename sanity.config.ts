import { assist } from "@sanity/assist";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { media } from "sanity-plugin-media";
import { tags } from "sanity-plugin-tags-v4";
import { colorInput } from "@sanity/color-input";
import { studioSessionPlugin } from "./src/lib/sanity/studioSessionPlugin";
import { studioProjectId, studioDataset } from "./sanity/lib/env";
import { schemaTypes } from "./sanity/schemas";
import { pageTemplates } from "./sanity/templates";
import { studioStructure } from "./sanity/structure";
import { singletonPlugin } from "./sanity/plugins/singleton";
import Dashboard from "./sanity/components/Dashboard";
import SeoDashboard from "./sanity/components/SeoDashboard";
import SeoTasksDashboard from "./sanity/components/SeoTasksDashboard";
import StudioNavbar from "./sanity/components/StudioNavbar";
import { OpenPreviewAction } from "./sanity/actions/OpenPreviewAction";
import { EyeOpenIcon } from "@sanity/icons";

function normalizeDocumentId(value: unknown): string {
  return String(value ?? "").replace(/^drafts\./, "").trim();
}

function normalizeSlugPathSegment(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

// Custom Action to launch Presentation Mode
function InVisionAction(props: any) {
  const { type, draft, published } = props;
  const doc = draft || published;
  if (type !== "post") return null;

  return {
    label: "In-Vision",
    icon: EyeOpenIcon,
    onHandle: () => {
      if (!doc) return;
      const slug = normalizeSlugPathSegment(doc.slug?.current);
      const docId = normalizeDocumentId(doc._id);
      const previewPath = slug
        ? `/preview/blog/${encodeURIComponent(slug)}${
            docId ? `?id=${encodeURIComponent(docId)}` : ""
          }`
        : "/blog";

      window.location.href = `/studio/presentation?preview=${encodeURIComponent(
        previewPath,
      )}`;
    },
  };
}

export default defineConfig({
  name: "default",
  title: "Kaizen CMS",
  projectId: studioProjectId,
  dataset: studioDataset,
  basePath: "/studio",

  api: {
    apiVersion: "2024-01-01",
    useCdn: false,
    perspective: "previewDrafts",
  },

  studio: {
    components: {
      navbar: StudioNavbar,
    },
  },

  plugins: [
    structureTool({ structure: studioStructure }),
    media(),
    studioSessionPlugin(),
    visionTool({ defaultApiVersion: "2024-01-01" }),
    assist(),
    tags({}),
    colorInput(),
    presentationTool({
      previewUrl: {
        initial: "/blog",
        previewMode: {
          enable: "/api/draft?redirectTo=/blog",
          disable: "/api/draft?disable=1&redirectTo=/blog",
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
                ? `/preview/blog/${encodeURIComponent(slug)}${
                    docId ? `?id=${encodeURIComponent(docId)}` : ""
                  }`
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
        },
      },
    }),
    singletonPlugin,
    {
      name: "disable-ai-assist-inspector-route",
      document: {
        inspectors: (prev) =>
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
      name: "seoTasks",
      title: "SEO Tasks",
      component: SeoTasksDashboard,
    },
    {
      name: "seo",
      title: "Analytics",
      component: SeoDashboard,
    },
    ...prev,
  ],

  schema: {
    types: schemaTypes,
    templates: (prev) => [...prev, ...pageTemplates],
  },

  document: {
    actions: (prev: any[], context: { schemaType: string }) => {
      if (context.schemaType === "post") {
        return [...prev, InVisionAction, OpenPreviewAction];
      }
      return prev;
    },
    productionUrl: async (prev, { document }) => {
      const type = document._type;

      if (type === "post") {
        const slug =
          typeof document.slug === "object" &&
          document.slug !== null &&
          "current" in document.slug
            ? String((document.slug as { current?: string }).current ?? "").trim()
            : "";
        if (slug) return `/preview/blog/${slug}`;
      }

      return prev;
    },
  },
});
