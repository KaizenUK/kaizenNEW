import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

import {
  ACTIVE_STATIC_SEO_ROUTES,
  RETIRED_PUBLIC_PAGE_SLUGS,
} from "../shared/publicRoutePolicy.js";

loadEnv({ path: path.join(process.cwd(), ".env") });

const projectId =
  process.env.PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "";
const dataset =
  process.env.PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_API_TOKEN || "";

if (!projectId || !dataset || !token) {
  console.error(
    "Missing Sanity environment. Required: PUBLIC_SANITY_PROJECT_ID/SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET/SANITY_DATASET, SANITY_API_TOKEN.",
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2025-01-01",
  useCdn: false,
});

function parseNdjson(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadSeeds(filePath) {
  const absolutePath = path.join(process.cwd(), filePath);
  const raw = await readFile(absolutePath, "utf8");
  return parseNdjson(raw);
}

async function upsertPageSeed(seed) {
  const slug = String(seed?.slug?.current || "").trim();
  const existing = await client.fetch(
    `*[_type == "page" && (_id in [$id, "drafts." + $id] || slug.current == $slug)][0]{_id}`,
    { id: seed._id, slug },
  );

  if (existing?._id) {
    await client.patch(existing._id).set({
      title: seed.title,
      slug: seed.slug,
      seo: seed.seo,
    }).commit();
    return { action: "patched", id: existing._id, slug };
  }

  await client.create(seed);
  return { action: "created", id: seed._id, slug };
}

async function upsertStaticSeed(seed) {
  const slug = String(seed?.slug?.current || "").trim();
  const existing = await client.fetch(
    `*[_type == "staticPage" && (_id in [$id, "drafts." + $id] || slug.current == $slug)][0]{_id}`,
    { id: seed._id, slug },
  );

  if (existing?._id) {
    await client.patch(existing._id).set({
      title: seed.title,
      slug: seed.slug,
      seo: seed.seo,
    }).commit();
    return { action: "patched", id: existing._id, slug };
  }

  await client.create(seed);
  return { action: "created", id: seed._id, slug };
}

async function deleteByQuery(query, params) {
  const docs = await client.fetch(query, params);
  const deleted = [];

  for (const doc of docs) {
    await client.delete(doc._id);
    deleted.push({
      id: doc._id,
      slug: doc.slug,
      title: doc.title,
    });
  }

  return deleted;
}

const [pageSeeds, staticSeeds] = await Promise.all([
  loadSeeds("apps/studio/sanity/seeds/page-route-starters.ndjson"),
  loadSeeds("apps/studio/sanity/seed/static-pages.ndjson"),
]);

const pageResults = [];
for (const seed of pageSeeds) {
  pageResults.push(await upsertPageSeed(seed));
}

const staticResults = [];
for (const seed of staticSeeds) {
  staticResults.push(await upsertStaticSeed(seed));
}

const retiredPagesDeleted = await deleteByQuery(
  `*[_type == "page" && defined(slug.current) && slug.current in $retiredSlugs]{
    _id,
    title,
    "slug": slug.current
  }`,
  { retiredSlugs: RETIRED_PUBLIC_PAGE_SLUGS },
);

const staleStaticPagesDeleted = await deleteByQuery(
  `*[_type == "staticPage" && defined(slug.current) && !(slug.current in $allowedRoutes)]{
    _id,
    title,
    "slug": slug.current
  }`,
  { allowedRoutes: ACTIVE_STATIC_SEO_ROUTES },
);

console.log(
  JSON.stringify(
    {
      pages: pageResults,
      staticPages: staticResults,
      retiredPagesDeleted,
      staleStaticPagesDeleted,
    },
    null,
    2,
  ),
);
