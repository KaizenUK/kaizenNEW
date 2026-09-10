import {
  existingPageInventory,
  type PageInventory,
} from "../../shared/builderPageInventory";
import { getManagedRoutePaths, sanityClient } from "./sanity/client";
import { getStudioUrl } from "./site";

const sources = import.meta.glob<string>("../pages/**/*.astro", {
  query: "?raw",
  import: "default",
  eager: true,
});
export async function getBuilderPageInventory(): Promise<PageInventory> {
  let paths: string[] = [],
    cmsStatus: PageInventory["cmsStatus"] = sanityClient
      ? "available"
      : "not-configured";
  if (sanityClient) {
    try {
      paths = await getManagedRoutePaths({ signal: AbortSignal.timeout(5000) });
    } catch {
      cmsStatus = "unavailable";
    }
  }
  return {
    pages: existingPageInventory(sources, paths),
    generatedAt: new Date().toISOString(),
    cmsStatus,
    studioUrl: getStudioUrl(),
  };
}
