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
        include: ["util", "buffer", "process"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    define: {
      "process.env": {},
    },
    ssr: {
      noExternal: [
        "react-helmet-async",
        "react-router",
        "react-router-dom",
      ],
    },
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve("./client") },
        { find: "@shared", replacement: path.resolve("./shared") },
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
