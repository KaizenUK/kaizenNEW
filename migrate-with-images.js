import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { parseStringPromise } from "xml2js";
import axios from "axios";
import pLimit from "p-limit";
import { createClient } from "@sanity/client";
import { htmlToBlocks } from "@portabletext/block-tools";
import { Schema } from "@sanity/schema";
import { JSDOM } from "jsdom";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "_" in value) return String(value._ ?? "");
  return "";
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function parseDate(item) {
  const candidates = [
    text(item.pubDate),
    text(item["wp:post_date_gmt"]),
    text(item["wp:post_date"]),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return new Date().toISOString();
}

function getThumbnailAttachmentId(item) {
  const postMeta = toArray(item["wp:postmeta"]);
  for (const meta of postMeta) {
    const key = text(meta["wp:meta_key"]);
    if (key !== "_thumbnail_id") continue;
    const value = text(meta["wp:meta_value"]).trim();
    if (value) return value;
  }
  return "";
}

function getPostMetaValue(item, targetKey) {
  const postMeta = toArray(item["wp:postmeta"]);
  for (const meta of postMeta) {
    const key = text(meta["wp:meta_key"]).trim();
    if (key !== targetKey) continue;
    return {
      found: true,
      value: text(meta["wp:meta_value"]),
    };
  }
  return {
    found: false,
    value: "",
  };
}

function getYoastSeo(item) {
  const yoastTitle = getPostMetaValue(item, "_yoast_wpseo_title");
  const yoastDescription = getPostMetaValue(item, "_yoast_wpseo_metadesc");

  const seo = {};
  if (yoastTitle.found) seo.metaTitle = yoastTitle.value;
  if (yoastDescription.found) seo.metaDescription = yoastDescription.value;

  return seo;
}

function createBlockContentType() {
  const schema = Schema.compile({
    name: "wpImportSchema",
    types: [
      {
        name: "post",
        type: "document",
        fields: [
          {
            name: "body",
            type: "array",
            of: [{ type: "block" }, { type: "codeBlock" }],
          },
        ],
      },
      {
        name: "codeBlock",
        type: "object",
        fields: [
          { name: "language", type: "string" },
          { name: "code", type: "text" },
        ],
      },
    ],
  });

  return schema.get("post").fields.find((field) => field.name === "body").type;
}

const blockContentType = createBlockContentType();

function htmlToPortableText(html) {
  const inputHtml = html?.trim() || "<p></p>";
  return htmlToBlocks(inputHtml, blockContentType, {
    parseHtml: (markup) => new JSDOM(markup).window.document,
    rules: [
      {
        deserialize(el, next, block) {
          if (!el || el.tagName?.toLowerCase() !== "pre") return undefined;
          const codeNode = el.querySelector("code");
          const languageClass = codeNode?.getAttribute("class") || "";
          const language = languageClass
            .replace(/^language-/, "")
            .split(/\s+/)
            .find(Boolean);
          const code = (codeNode?.textContent || el.textContent || "").trim();

          return block({
            _type: "codeBlock",
            language: language || "text",
            code,
          });
        },
      },
    ],
  });
}

function getEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

function createSanityWriteClient() {
  const projectId =
    getEnv("SANITY_PROJECT_ID") ||
    getEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") ||
    getEnv("PUBLIC_SANITY_PROJECT_ID");
  const dataset =
    getEnv("SANITY_DATASET") ||
    getEnv("NEXT_PUBLIC_SANITY_DATASET") ||
    getEnv("PUBLIC_SANITY_DATASET") ||
    "production";
  const token = getEnv("SANITY_API_TOKEN");

  if (!projectId) {
    throw new Error(
      "Missing SANITY_PROJECT_ID (or NEXT_PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_PROJECT_ID).",
    );
  }

  if (!token) {
    throw new Error("Missing SANITY_API_TOKEN for write + asset upload.");
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: "2025-01-01",
    token,
    useCdn: false,
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const xmlPath = args.find((arg) => !arg.startsWith("--")) || "wordpress.xml";
  return { xmlPath, dryRun };
}

async function loadWordpressItems(xmlPath) {
  const xml = await readFile(xmlPath, "utf8");
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
    explicitRoot: false,
  });
  return toArray(parsed?.channel?.item);
}

function buildImageMap(items) {
  const imageMap = new Map();
  for (const item of items) {
    const postType = text(item["wp:post_type"]);
    if (postType !== "attachment") continue;

    const id = text(item["wp:post_id"]).trim();
    const url = text(item["wp:attachment_url"]).trim();
    if (!id || !url) continue;

    imageMap.set(id, url);
  }
  return imageMap;
}

function getPostItems(items) {
  return items.filter((item) => {
    const postType = text(item["wp:post_type"]);
    const status = text(item["wp:status"]);
    if (postType !== "post") return false;
    if (status === "trash" || status === "auto-draft") return false;
    return true;
  });
}

function createPostDoc(item, index, imageAssetRef) {
  const title = text(item.title) || `Untitled Post ${index + 1}`;
  const rawHtml = text(item["content:encoded"]);
  const wpSlug = text(item["wp:post_name"]).trim();
  const fallbackSlug = slugify(title) || `post-${index + 1}`;
  const slug = wpSlug || fallbackSlug;
  const postId = text(item["wp:post_id"]).trim();
  const contentHash = createHash("sha1")
    .update(`${title}:${slug}:${rawHtml}`)
    .digest("hex")
    .slice(0, 16);
  const documentId = postId ? `wp-post-${postId}` : `wp-post-${contentHash}`;

  const imageField = imageAssetRef
    ? {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: imageAssetRef,
        },
      }
    : undefined;
  const seo = getYoastSeo(item);
  const hasSeo = Object.keys(seo).length > 0;

  return {
    _id: documentId,
    _type: "post",
    title,
    body: htmlToPortableText(rawHtml),
    publishedAt: parseDate(item),
    slug: {
      _type: "slug",
      current: slug,
    },
    ...(hasSeo ? { seo } : {}),
    ...(imageField ? { mainImage: imageField, coverImage: imageField } : {}),
  };
}

async function downloadAndUploadImage(client, imageUrl, sourceId) {
  const response = await axios.get(imageUrl, {
    responseType: "stream",
    timeout: 30_000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "kaizen-wordpress-migrator/1.0",
    },
  });

  const cleanName = imageUrl.split("?")[0];
  const filename = basename(cleanName) || `wp-image-${sourceId}.jpg`;

  const asset = await client.assets.upload("image", response.data, {
    filename,
    source: {
      id: sourceId,
      name: "wordpress-import",
    },
  });

  return asset._id;
}

async function main() {
  const { xmlPath, dryRun } = parseArgs();
  const client = createSanityWriteClient();
  const items = await loadWordpressItems(xmlPath);

  // Step 1: map attachment id -> attachment url
  const imageMap = buildImageMap(items);

  // Step 2: collect real blog posts
  const posts = getPostItems(items);
  const uploadLimit = pLimit(3);
  const uploadedAssetsByAttachmentId = new Map();

  let uploadedImages = 0;
  let postsWithFeaturedImage = 0;
  let postsWithSeoData = 0;
  let postsWritten = 0;

  const docs = await Promise.all(
    posts.map(async (post, index) => {
      const thumbnailId = getThumbnailAttachmentId(post);
      const imageUrl = thumbnailId ? imageMap.get(thumbnailId) : "";
      let imageAssetRef = "";

      // Step 3: match and upload thumbnail if available
      if (thumbnailId && imageUrl) {
        postsWithFeaturedImage += 1;

        if (!uploadedAssetsByAttachmentId.has(thumbnailId)) {
          const uploadPromise = uploadLimit(async () => {
            if (dryRun) return `dry-run-asset-${thumbnailId}`;
            const assetId = await downloadAndUploadImage(
              client,
              imageUrl,
              `wp-attachment-${thumbnailId}`,
            );
            uploadedImages += 1;
            return assetId;
          });
          uploadedAssetsByAttachmentId.set(thumbnailId, uploadPromise);
        }

        imageAssetRef = await uploadedAssetsByAttachmentId.get(thumbnailId);
      }

      const doc = createPostDoc(post, index, imageAssetRef);
      if (doc.seo && Object.keys(doc.seo).length > 0) {
        postsWithSeoData += 1;
      }
      return doc;
    }),
  );

  if (!dryRun) {
    for (const doc of docs) {
      await client.createOrReplace(doc);
      postsWritten += 1;
    }
  }

  const summary = {
    xmlPath,
    totalItems: items.length,
    attachmentCount: imageMap.size,
    postCount: posts.length,
    postsWithFeaturedImage,
    postsWithSeoData,
    uploadedImages,
    postsWritten: dryRun ? 0 : postsWritten,
    dryRun,
  };

  console.log("Migration completed.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
