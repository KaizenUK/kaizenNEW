import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";

const PAGESPEED_API_KEY = process.env.VITE_PAGESPEED_API_KEY || "";

export function createServer() {
  const app = express();

  app.disable("x-powered-by");

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // PageSpeed Insights API proxy
  app.get("/api/pagespeed", async (req, res) => {
    try {
      const url = req.query.url as string;

      if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      if (!PAGESPEED_API_KEY) {
        return res
          .status(500)
          .json({ error: "PageSpeed API key not configured" });
      }

      // Set no-cache headers to prevent 304 responses
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      });

      const response = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&strategy=MOBILE&key=${PAGESPEED_API_KEY}`,
      );

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({
          error: error.error?.message || "Failed to run PageSpeed audit",
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error running PageSpeed audit:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  return app;
}
