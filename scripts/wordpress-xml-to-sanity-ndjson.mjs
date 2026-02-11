import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { parseStringPromise } from "xml2js";
import { htmlToBlocks } from "@portabletext/block-tools";
import { JSDOM } from "jsdom";
import { Schema } from "@sanity/schema";

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function textFromNode(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    if ("_" in node && typeof node._ === "string") return node._;
  }
  return "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function parsePublishedAt(item) {
  const pubDate = textFromNode(item.pubDate);
  const postDateGmt = textFromNode(item["wp:post_date_gmt"]);
  const postDate = textFromNode(item["wp:post_date"]);
  const candidates = [pubDate, postDateGmt, postDate].filter(Boolean);

  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

const sanitySchema = Schema.compile({
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

const blockContentType = sanitySchema
  .get("post")
  .fields.find((field) => field.name === "body").type;

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

function buildSanityDoc(item, index) {
  const title = textFromNode(item.title) || `Untitled Post ${index + 1}`;
  const rawHtml = textFromNode(item["content:encoded"]);
  const wpSlug = textFromNode(item["wp:post_name"]);
  const fallbackSlug = slugify(title) || `post-${index + 1}`;
  const slug = wpSlug || fallbackSlug;
  const postId = textFromNode(item["wp:post_id"]);
  const contentHash = createHash("sha1")
    .update(`${title}:${slug}:${rawHtml}`)
    .digest("hex")
    .slice(0, 16);
  const documentId = postId ? `wp-post-${postId}` : `wp-post-${contentHash}`;

  return {
    _id: documentId,
    _type: "post",
    title,
    body: htmlToPortableText(rawHtml),
    publishedAt: parsePublishedAt(item),
    slug: {
      _type: "slug",
      current: slug,
    },
  };
}

function getCandidateInputPaths() {
  return [
    "wordpresswebsite.WordPress.2026-02-11.xml",
    "wordpresswebs.te.WordPress.2026-02-11.xml",
    "wordpresswebsite.WordPress.xml",
  ];
}

async function resolveInputPath(argPath) {
  if (argPath) return argPath;

  for (const candidate of getCandidateInputPaths()) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      // keep trying
    }
  }

  throw new Error(
    "No input XML file found. Pass the path as the first argument, for example: node scripts/wordpress-xml-to-sanity-ndjson.mjs C:\\path\\to\\wordpress.xml",
  );
}

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3] || "sanity-data.ndjson";
  const inputPath = await resolveInputPath(inputArg);

  const xml = await readFile(inputPath, "utf8");
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
    explicitRoot: false,
  });

  const items = toArray(parsed?.channel?.item);
  const postItems = items.filter((item) => {
    const postType = textFromNode(item["wp:post_type"]);
    const status = textFromNode(item["wp:status"]);
    if (postType !== "post") return false;
    if (status === "trash" || status === "auto-draft") return false;
    return true;
  });

  const docs = postItems.map(buildSanityDoc);
  const ndjson = docs.map((doc) => JSON.stringify(doc)).join("\n");

  await writeFile(outputArg, `${ndjson}\n`, "utf8");

  const summary = {
    input: path.resolve(inputPath),
    output: path.resolve(outputArg),
    totalItems: items.length,
    convertedPosts: docs.length,
  };

  console.log("WordPress XML converted to Sanity NDJSON.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
