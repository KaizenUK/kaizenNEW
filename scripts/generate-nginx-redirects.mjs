import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@sanity/client";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { mergeRedirectConfiguration } from "../shared/builderRedirects.js";

loadEnv({ quiet: true });
const output = path.resolve("dist");
async function builderRules() {
  if (process.env.BUILDER_RELEASE_SNAPSHOT_FILE) {
    const snapshot = JSON.parse(
      await fs.readFile(process.env.BUILDER_RELEASE_SNAPSHOT_FILE, "utf8"),
    );
    if (snapshot.schemaVersion !== 1)
      throw new Error("Unsupported frozen redirect snapshot");
    return snapshot.redirects || [];
  }
  if (process.env.BUILDER_LOCAL_BUILD === "1") {
    const file = path.resolve(
      process.env.BUILDER_LOCAL_DIRECTORY || ".kaizen-builder",
      "workspace.json",
    );
    try {
      return (
        JSON.parse(await fs.readFile(file, "utf8")).routes?.published || []
      );
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  if (process.env.VITE_BUILDER_CLOUD !== "1") return [];
  const client = createSupabase(
    process.env.VITE_SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || "",
  );
  const { data, error } = await client
    .from("builder_public_redirects")
    .select("rules")
    .eq("id", "site")
    .single();
  if (error)
    throw new Error(
      `Published builder redirects could not be read: ${error.message}`,
    );
  return data.rules;
}
async function cmsRules() {
  const projectId =
    process.env.PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID;
  const dataset =
    process.env.PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET;
  if (!projectId || !dataset) return [];
  return createClient({
    projectId,
    dataset,
    token: process.env.SANITY_API_TOKEN,
    apiVersion: "2025-01-01",
    useCdn: false,
    perspective: "published",
  }).fetch('*[_type == "redirect"]{source,destination,isPermanent}');
}
async function paths(directory, prefix = "") {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(
        ...(await paths(path.join(directory, entry.name), relative + "/")),
      );
    else if (entry.isFile())
      result.push("/" + relative.replace(/index\.html$/, ""));
  }
  return result;
}
try {
  const [builder, cms, available] = await Promise.all([
    builderRules(),
    cmsRules(),
    paths(output),
  ]);
  const generated = mergeRedirectConfiguration(builder, cms, available);
  await fs.writeFile(
    path.join(output, "redirects.generated.conf"),
    [
      "# Generated redirects; include inside the server block.",
      ...generated.rules,
      "",
    ].join("\n"),
  );
  // This metadata is retained outside the served site by the release stager.
  await fs.writeFile(
    path.join(output, "redirects.generated.json"),
    JSON.stringify({ schemaVersion: 1, checks: generated.checks }),
  );
  console.log(
    `Generated ${generated.rules.length} redirect rules and ${generated.checks.length} live redirect checks.`,
  );
} catch (error) {
  console.error("Redirect generation failed:", error.message);
  process.exitCode = 1;
}
