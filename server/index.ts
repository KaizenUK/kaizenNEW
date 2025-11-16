import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";

const BUILDER_API_KEY = process.env.VITE_BUILDER_API_KEY || "";

export function createServer() {
  const app = express();

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

  // Admin API route for creating blog posts
  app.post("/api/admin/builder-blog-posts", async (req, res) => {
    try {
      if (!BUILDER_API_KEY) {
        return res
          .status(500)
          .json({ error: "Builder API key not configured" });
      }

      const { title, slug, excerpt, publishedDate, tags, body } = req.body;

      // Basic validation
      if (!title && !slug) {
        return res
          .status(400)
          .json({ error: "Please provide at least a title or slug." });
      }

      // Create the Builder content
      const response = await fetch(
        "https://builder.io/api/v1/content/blog-post",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BUILDER_API_KEY}`,
          },
          body: JSON.stringify({
            data: {
              title: title || "Untitled",
              slug: slug || "",
              excerpt: excerpt || "",
              publishedDate:
                publishedDate || new Date().toISOString().split("T")[0],
              tags: Array.isArray(tags) ? tags : [],
              body: body || "",
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({
          error: error.message || "Failed to create post in Builder",
        });
      }

      const createdPost = await response.json();
      res.json({ success: true, data: createdPost });
    } catch (error) {
      console.error("Error creating blog post:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // Admin API route for updating blog posts
  app.patch("/api/admin/builder-blog-posts/:id", async (req, res) => {
    try {
      if (!BUILDER_API_KEY) {
        return res
          .status(500)
          .json({ error: "Builder API key not configured" });
      }

      const { id } = req.params;
      const { title, slug, excerpt, publishedDate, tags, body } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Post ID is required" });
      }

      // Update the Builder content
      const response = await fetch(
        `https://builder.io/api/v1/content/blog-post/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BUILDER_API_KEY}`,
          },
          body: JSON.stringify({
            data: {
              title,
              slug,
              excerpt,
              publishedDate,
              tags,
              body,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({
          error: error.message || "Failed to update post in Builder",
        });
      }

      const updatedPost = await response.json();
      res.json({ success: true, data: updatedPost });
    } catch (error) {
      console.error("Error updating blog post:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  return app;
}
