import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),

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
    plugins: [
      nodePolyfills({
        include: ["process", "util", "buffer", "stream"],
        globals: {
          process: true,
          global: true,
          Buffer: true,
        },
      }),
    ],
    
    build: {
      chunkSizeWarningLimit: 1000,
    },

    ssr: {
      // THE FIX: "true" forces all dependencies (including problematic legacy ones)
      // to be bundled and polyfilled during build time.
      noExternal: true,
    },

    optimizeDeps: {
      include: [
        "sanity",
        "sanity/presentation",
        "@sanity/assist",
        "@sanity/vision",
        "sanity-plugin-media",
        "sanity-plugin-tags-v4",
        "sanity-plugin-icon-picker",
        "@sanity/color-input",
        "react-ga4",
        "@sanity/visual-editing",
        "@sanity/client/stega",
        "lucide-react",
        "jspdf",
        "react-router-dom",
        "@radix-ui/react-accordion",
        "clsx",
        "tailwind-merge",
        "vite-plugin-node-polyfills/shims/global",
        "vite-plugin-node-polyfills/shims/process",
      ],
    },

    resolve: {
      alias: [
        { find: "@", replacement: path.resolve("./client") },
        { find: "@shared", replacement: path.resolve("./shared") },
        // Manual mapping for the util error
        { find: "util", replacement: "vite-plugin-node-polyfills/shims/util" },
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