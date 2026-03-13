import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import path from "node:path";
import { PUBLIC_ROUTE_REDIRECTS } from "./shared/publicRoutePolicy.js";

function sanitizeBrokenTransformHooks() {
  const seen = new Set();

  const sanitizePluginList = (plugins, label) => {
    if (!Array.isArray(plugins)) {
      return;
    }

    for (const plugin of plugins) {
      if (!plugin || !plugin.transform || typeof plugin.transform !== "object") {
        continue;
      }

      if (typeof plugin.transform.handler === "function") {
        continue;
      }

      const key = `${label}:${plugin.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.warn(
          `[vite] Removed invalid transform hook from plugin "${plugin.name}" in ${label}.`,
        );
      }

      delete plugin.transform;
    }
  };

  return {
    name: "sanitize-broken-transform-hooks",
    configResolved(config) {
      sanitizePluginList(config.plugins, "root plugins");

      if (!config.environments || typeof config.environments !== "object") {
        return;
      }

      for (const [environmentName, environmentConfig] of Object.entries(
        config.environments,
      )) {
        sanitizePluginList(
          environmentConfig?.plugins,
          `environment "${environmentName}"`,
        );
      }
    },
  };
}

export default defineConfig({
  site: "https://kaizenweb.co.uk",
  output: "static",
  trailingSlash: "always",

  // Memory Management: Essential for small VPS stability
  build: {
    concurrency: 1,
  },

  redirects: PUBLIC_ROUTE_REDIRECTS,

  integrations: [react()],

  vite: {
    plugins: [sanitizeBrokenTransformHooks()],

    envPrefix: ["VITE_", "PUBLIC_", "NEXT_PUBLIC_"],

    build: {
      chunkSizeWarningLimit: 1000,
    },

    optimizeDeps: {
      include: [
        "sanity",
        "sanity/presentation",
        "@sanity/assist",
        "@sanity/vision",
        "sanity-plugin-media",
        "sanity-plugin-tags-v4",
        "@sanity/color-input",
        "react-ga4",
        "lucide-react",
        "jspdf",
        "@radix-ui/react-accordion",
        "clsx",
        "tailwind-merge",
      ],
    },

    resolve: {
      alias: [
        {
          find: "react/compiler-runtime",
          replacement: path.resolve("./src/lib/reactCompilerRuntimeShim.ts"),
        },
        {
          find: "react-compiler-runtime",
          replacement: path.resolve("./src/lib/reactCompilerRuntimeShim.ts"),
        },
      ],
      dedupe: ["react", "react-dom"],
    },
  },
});
