import { assist } from "@sanity/assist";
import { colorInput } from "@sanity/color-input";
import { EyeOpenIcon } from "@sanity/icons";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { media } from "sanity-plugin-media";
import { tags } from "sanity-plugin-tags-v4";

import { studioSessionPlugin } from "./src/lib/sanity/studioSessionPlugin";
import { studioProjectId, studioDataset } from "./sanity/lib/env";
import { schemaTypes } from "./sanity/schemas";
import { pageTemplates } from "./sanity/templates";
import { studioStructure } from "./sanity/structure";
import { singletonPlugin } from "./sanity/plugins/singleton";

import Dashboard from "./sanity/components/Dashboard";
import SeoTasksDashboard from "./sanity/components/SeoTasksDashboard";
import StudioNavbar from "./sanity/components/StudioNavbar";

import { OpenPreviewAction } from "./sanity/actions/OpenPreviewAction";

function normalizeOrigin(value: string): string {
  return String(value).replace(/\/+$/, "");
}

function toUrlOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return normalizeOrigin(value);
  }
}

function isLocalOrigin(value: string): boolean {
  const origin = toUrlOrigin(value);
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

const editorApiOrigin = (
  import.meta.env.VITE_EDITOR_API_ORIGIN || "https://kaizenweb.co.uk/editor-api"
).replace(/\/+$/, "");
const publicSiteOrigin = (
  import.meta.env.VITE_PUBLIC_SITE_ORIGIN || "https://kaizenweb.co.uk"
).replace(/\/+$/, "");
const studioOrigin = (
  import.meta.env.VITE_STUDIO_ORIGIN || "https://studio.kaizenweb.co.uk"
).replace(/\/+$/, "");
const editorApiHostOrigin = toUrlOrigin(editorApiOrigin);
const includeLocalDevOrigins =
  isLocalOrigin(editorApiOrigin) ||
  isLocalOrigin(publicSiteOrigin) ||
  isLocalOrigin(studioOrigin);
const presentationAllowOrigins = Array.from(
  new Set(
    [
      publicSiteOrigin,
      studioOrigin,
      editorApiHostOrigin,
      ...(includeLocalDevOrigins
        ? ["http://localhost:4321", "http://127.0.0.1:54321"]
        : []),
    ].map(normalizeOrigin),
  ),
);

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
        ? `/preview-blog/${encodeURIComponent(slug)}${
            docId ? `?id=${encodeURIComponent(docId)}` : ""
          }`
        : "/blog";

      const draftUrl = `${editorApiOrigin}/draft?path=${encodeURIComponent(previewPath)}`;
      window.location.href = `/studio/presentation?preview=${encodeURIComponent(
        draftUrl,
      )}`;
    },
  };
}

function buildDraftToggleUrl(disable = false): string {
  const redirectPath = "/blog";
  const disableSegment = disable ? "&disable=1" : "";
  return `${editorApiOrigin}/draft?redirectTo=${encodeURIComponent(redirectPath)}${disableSegment}`;
}

function buildPostPreviewPath(doc: Record<string, string> | null): string {
  const slug = normalizeSlugPathSegment(doc?.slug);
  const docId = normalizeDocumentId(doc?.id);
  return slug
    ? `/preview-blog/${encodeURIComponent(slug)}${
        docId ? `?id=${encodeURIComponent(docId)}` : ""
      }`
    : "/blog";
}

function buildPostPreviewUrl(doc: Record<string, string> | null): string {
  const previewPath = buildPostPreviewPath(doc);
  if (previewPath === "/blog") return `${publicSiteOrigin}/blog`;
  return `${editorApiOrigin}/draft?path=${encodeURIComponent(previewPath)}`;
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
      allowOrigins: presentationAllowOrigins,
      previewUrl: {
        origin: publicSiteOrigin,
        initial: "/blog",
        previewMode: {
          enable: buildDraftToggleUrl(false),
          disable: buildDraftToggleUrl(true),
        },
      },
      resolve: {
        locations: {
          post: {
            select: { title: "title", slug: "slug.current", id: "_id" },
            resolve: (doc: Record<string, string> | null) => ({
              locations: [
                {
                  title: doc?.title || "Post",
                  href: buildPostPreviewUrl(doc),
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
        if (slug) return `${publicSiteOrigin}/blog/${slug}`;
      }

      return prev;
    },
  },
});
