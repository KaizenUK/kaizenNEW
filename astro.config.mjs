import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import path from "node:path";

export default defineConfig({
  output: "static",

  // Memory Management: Essential for small VPS stability
  build: {
    concurrency: 1,
  },

  redirects: {
    "/services/web-design-liverpool": "/web-design-liverpool",
    "/web-design-liverpool-city-centre": "/web-design-liverpool",
    "/services/digital-transformation": "/digital-transformation",
    "/product-owner": "/contract-product-owner",
  },

  integrations: [react()],

  vite: {
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
        "react-router-dom",
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
        {
          find: /^react-router-dom$/,
          replacement: path.resolve("./node_modules/react-router-dom/dist/index.mjs"),
        },
        {
          find: /^react-router$/,
          replacement: path.resolve("./node_modules/react-router/dist/development/index.mjs"),
        },
      ],
      dedupe: ["react", "react-dom"],
    },
  },
});
