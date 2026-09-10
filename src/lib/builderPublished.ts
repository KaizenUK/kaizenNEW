import { createClient } from "@supabase/supabase-js";
import { readLocalWorkspace } from "../../scripts/builder-local";
import {
  validateDocument,
  type PageDocument,
} from "../../shared/visualBuilder";
export async function getBuilderPublishedPages(): Promise<PageDocument[]> {
  const url =
    import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (
    (import.meta.env.VITE_BUILDER_CLOUD || process.env.VITE_BUILDER_CLOUD) ===
      "1" &&
    process.env.BUILDER_LOCAL_BUILD !== "1"
  ) {
    if (!url || !key)
      throw new Error(
        "Shared builder publishing is enabled but its Supabase URL/key are missing.",
      );
    const client = createClient(url, key);
    const pages: PageDocument[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("builder_publications")
        .select("document")
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          `Builder publications could not be loaded: ${error.message}`,
        );
      pages.push(...(data || []).map((p) => validateDocument(p.document)));
      if ((data || []).length < 500) return pages;
    }
  }
  if (import.meta.env.DEV || process.env.BUILDER_LOCAL_BUILD === "1")
    return (await readLocalWorkspace()).pages
      .filter((p) => p.published)
      .map((p) => validateDocument(p.published));
  return [];
}
