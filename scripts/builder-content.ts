import { readFile } from "node:fs/promises";
import { loadEnv } from "vite";
import {
  fetchContentCatalogue,
  normalizeCatalogue,
} from "../shared/builderContent";

/** Server-only adapter. Never import into editor React components. */
export async function getServerContentCatalogue(local = false) {
  if (process.env.BUILDER_CONTENT_FIXTURE) {
    if (!local)
      throw new Error(
        "A CMS test fixture cannot be used in a normal production build.",
      );
    return normalizeCatalogue(
      JSON.parse(await readFile(process.env.BUILDER_CONTENT_FIXTURE, "utf8")),
    );
  }
  const env = {
    ...loadEnv(process.env.NODE_ENV || "development", process.cwd(), ""),
    ...process.env,
  };
  return fetchContentCatalogue({
    projectId: env.PUBLIC_SANITY_PROJECT_ID || env.SANITY_PROJECT_ID,
    dataset: env.PUBLIC_SANITY_DATASET || env.SANITY_DATASET || "production",
    token: env.SANITY_API_TOKEN,
  });
}
