import { assist } from "@sanity/assist";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { media } from "sanity-plugin-media";
import { studioSessionPlugin } from "./src/lib/sanity/studioSessionPlugin";
import { resolvedProjectId, resolvedDataset, siteUrl } from "./sanity/lib/env";
import { schemaTypes } from "./sanity/schemas";
import { studioStructure } from "./sanity/structure";
import { singletonPlugin } from "./sanity/plugins/singleton";
import Dashboard from "./sanity/components/Dashboard";
import SeoDashboard from "./sanity/components/SeoDashboard";
import StudioNavbar from "./sanity/components/StudioNavbar";

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
    media(),
    studioSessionPlugin(),
    visionTool(),
    assist(),
    presentationTool({
      previewUrl: {
        origin: siteUrl,
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
        const slug =
          typeof document.slug === "object" &&
          document.slug !== null &&
          "current" in document.slug
            ? String(
                (document.slug as { current?: string }).current ?? "",
              ).trim()
            : "";
        if (slug) return `/preview/${slug}`;
      }

      return prev;
    },
  },
});
