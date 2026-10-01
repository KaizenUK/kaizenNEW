// Copies only the SEO title and description from the Sanity seed files onto
// the existing Sanity pages. Unlike sync-seo-to-sanity.mjs it never creates or
// deletes documents and never replaces the rest of a page's SEO settings
// (share image, canonical URL, noindex).
//
// Preview (default):  pnpm sync:seo:fields
// Write the changes:  pnpm sync:seo:fields -- --apply
//
// Signs in with your Sanity CLI login (run `pnpm exec sanity login` once,
// which opens the browser). SANITY_API_TOKEN in .env is used instead if set.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env"), quiet: true });

const apply = process.argv.includes("--apply");
const projectId =
  process.env.PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "";
const dataset =
  process.env.PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_API_TOKEN || "";
const apiVersion = "2025-01-01";

async function sanityClient() {
  if (token) {
    if (!projectId)
      throw new Error("Set PUBLIC_SANITY_PROJECT_ID in .env to use a token.");
    return createClient({ projectId, dataset, token, apiVersion, useCdn: false });
  }
  try {
    const { getCliClient } = await import("sanity/cli");
    return getCliClient({ apiVersion }).withConfig({ useCdn: false });
  } catch {
    throw new Error(
      "No Sanity login found. Run `pnpm exec sanity login` once, then `pnpm sync:seo:fields`.",
    );
  }
}

async function loadSeeds(filePath) {
  const raw = await readFile(path.join(process.cwd(), filePath), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const client = await sanityClient();
const seeds = [
  ...(await loadSeeds("apps/studio/sanity/seeds/page-route-starters.ndjson")),
  ...(await loadSeeds("apps/studio/sanity/seed/static-pages.ndjson")),
];

const changes = [];
for (const seed of seeds) {
  const slug = String(seed?.slug?.current || "").trim();
  const metaTitle = seed?.seo?.metaTitle;
  const metaDescription = seed?.seo?.metaDescription;
  if (!slug || !metaTitle || !metaDescription) continue;
  // Published and draft copies both get the change, so publishing a draft
  // later cannot bring the old wording back.
  const docs = await client.fetch(
    `*[_type == $type && (_id in [$id, "drafts." + $id] || slug.current == $slug)]{
      _id,
      "metaTitle": seo.metaTitle,
      "metaDescription": seo.metaDescription
    }`,
    { type: seed._type, id: seed._id, slug },
  );
  if (!docs.length) {
    console.log(`skip   ${seed._type} ${slug}: not in Sanity (nothing created)`);
    continue;
  }
  for (const doc of docs) {
    if (doc.metaTitle === metaTitle && doc.metaDescription === metaDescription)
      continue;
    changes.push({ id: doc._id, slug, from: doc, metaTitle, metaDescription });
  }
}

for (const change of changes) {
  console.log(`\n${change.id} (${change.slug})`);
  console.log(`  title:       ${change.from.metaTitle ?? "(none)"}\n           -> ${change.metaTitle}`);
  console.log(`  description: ${change.from.metaDescription ?? "(none)"}\n           -> ${change.metaDescription}`);
}

if (!changes.length) {
  console.log("Sanity already matches the seed files. Nothing to change.");
} else if (!apply) {
  console.log(`\n${changes.length} document(s) would change. Run again with --apply to write them.`);
} else {
  const transaction = client.transaction();
  for (const change of changes)
    transaction.patch(change.id, (patch) =>
      patch.setIfMissing({ seo: {} }).set({
        "seo.metaTitle": change.metaTitle,
        "seo.metaDescription": change.metaDescription,
      }),
    );
  await transaction.commit();
  console.log(`\nUpdated ${changes.length} document(s). The site picks them up on its next build.`);
}
