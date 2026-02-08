import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
const IMMUTABLE_ONE_YEAR = "public, max-age=31536000, immutable";
const HTML_NO_CACHE = "public, max-age=0, must-revalidate";

const immutableRootAssets = new Set([
  "logo.svg",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-96x96.png",
  "web-app-manifest-192x192.png",
  "web-app-manifest-512x512.png",
]);

const setStaticCacheHeaders: express.RequestHandler = (req, res, next) => {
  const fileName = path.basename(req.path);
  const ext = path.extname(fileName).toLowerCase();

  // Vite fingerprinted assets: safe to cache long-term.
  if (req.path.startsWith("/assets/")) {
    res.setHeader("Cache-Control", IMMUTABLE_ONE_YEAR);
    return next();
  }

  // Root-level static branding/app icon files are also version-stable.
  if (immutableRootAssets.has(fileName)) {
    res.setHeader("Cache-Control", IMMUTABLE_ONE_YEAR);
    return next();
  }

  // HTML should always revalidate.
  if (ext === ".html" || req.path === "/" || req.path === "/index.html") {
    res.setHeader("Cache-Control", HTML_NO_CACHE);
    return next();
  }

  return next();
};

// Serve static files
app.use(setStaticCacheHeaders);
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.setHeader("Cache-Control", HTML_NO_CACHE);
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
