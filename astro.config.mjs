import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Prevents node-polyfills from injecting browser stubs (e.g. stream→stream-browserify)
// into the SSR bundle, which breaks sub-path imports like stream/web.
function clientOnlyNodePolyfills(options) {
  const plugin = nodePolyfills(options);
  return {
    ...plugin,
    config(config, env) {
      if (env?.isSsrBuild) return null;
      return typeof plugin.config === "function"
        ? plugin.config(config, env)
        : plugin.config;
    },
  };
}

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
      clientOnlyNodePolyfills({
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
      // Only bundle packages that have ESM/CJS issues as externals.
      // Previously `noExternal: true` which bundled ALL of node_modules,
      // forcing Rollup to hold the entire dep graph in memory (~6GB).
      noExternal: [
        "react-helmet-async",
        "react-router",
        "react-router-dom",
        "@sanity/visual-editing",
      ],
      // Keep Node built-ins external so sub-path imports (e.g. stream/web)
      // and util.inherits resolve natively rather than hitting browser stubs.
      external: ["util", "process", "stream"],
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