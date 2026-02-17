import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Completely disables vite-plugin-node-polyfills during SSR builds so that
// Node built-ins (util, stream, buffer, etc.) resolve natively. Without this,
// the plugin's resolveId/load hooks can redirect them to browser stubs that
// lack APIs like util.inherits or stream/web, crashing the server.
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
    resolveId(id, importer, resolveOptions) {
      if (resolveOptions?.ssr) return undefined;
      return typeof plugin.resolveId === "function"
        ? plugin.resolveId.call(this, id, importer, resolveOptions)
        : undefined;
    },
    load(id, loadOptions) {
      if (loadOptions?.ssr) return undefined;
      return typeof plugin.load === "function"
        ? plugin.load.call(this, id, loadOptions)
        : undefined;
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
      // Only bundle packages that need Vite transformation for SSR.
      // Everything else stays external and resolves from node_modules at
      // runtime (VPS runs pnpm install before pm2 start).
      noExternal: [
        "react-helmet-async",
        "react-router",
        "react-router-dom",
      ],
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
        "vite-plugin-node-polyfills/shims/global",
        "vite-plugin-node-polyfills/shims/process",
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