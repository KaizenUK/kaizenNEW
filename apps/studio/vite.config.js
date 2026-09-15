import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/studio/",
  plugins: [react()],
  // Only browser configuration is public. SANITY_API_TOKEN and SANITY_AUTH_TOKEN
  // must remain server-side even when the site and Studio share a build process.
  envPrefix: ["VITE_", "SANITY_STUDIO_", "PUBLIC_"],
  define: {
    "process.env": {},
    "process.platform": '"browser"',
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3333,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
