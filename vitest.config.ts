import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    // PGlite/database suites are memory-heavy; keep local and CI runs bounded.
    maxWorkers: 2,
    // The developer export bundles real CSS text; do not replace it with Vitest's CSS stub.
    css: { include: [/visual-builder[\\/]page\.css/] },
    environment: "node",
    globals: true,
    include: ["client/**/*.spec.{ts,tsx}"],
  },
});
