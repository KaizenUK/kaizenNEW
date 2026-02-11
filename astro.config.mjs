import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import path from "node:path";

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
    build: {
      modulePreload: false,
    },
    ssr: {
      noExternal: ["react-helmet-async"],
    },
    resolve: {
      alias: {
        "@": path.resolve("./client"),
        "@shared": path.resolve("./shared"),
        "react-router-dom": path.resolve(
          "./node_modules/react-router-dom/dist/index.mjs",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
  },
});
