import type { BuilderProject } from "../../shared/builderProjects";
import { LEGACY_PROJECT_ID } from "../../shared/builderProjects";
import { getSupabaseClient } from "../lib/supabase";

// Fixed for this document's lifetime. Opening another project navigates, disposing
// the editor and its pending import/autosave controllers before starting another.
export const activeProjectId =
  typeof location === "undefined"
    ? LEGACY_PROJECT_ID
    : new URLSearchParams(location.search).get("project") || LEGACY_PROJECT_ID;
export function projectUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}project=${encodeURIComponent(activeProjectId)}`;
}
export async function projectRequest(input?: unknown): Promise<any> {
  if (import.meta.env.VITE_BUILDER_CLOUD === "1") {
    const client = getSupabaseClient();
    if (!client) throw new Error("The hosted builder is not configured.");
    const { data, error } = await client.functions.invoke("builder-projects", {
      body: input || { action: "list" },
    });
    if (error) {
      let message = error.message;
      try {
        message = (await error.context?.clone().json())?.error || message;
      } catch {
        /* Keep transport error. */
      }
      throw new Error(message);
    }
    if (
      input &&
      !["list", "members"].includes((input as { action: string }).action) &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("builder-projects-changed"));
    return data;
  }
  const response = await fetch(
    "/__builder-projects",
    input
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kaizen-Builder": "1",
          },
          body: JSON.stringify(input),
        }
      : {},
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Projects could not be loaded.");
  if (input && typeof window !== "undefined")
    window.dispatchEvent(new Event("builder-projects-changed"));
  return result;
}
export const listProjects = (): Promise<BuilderProject[]> => projectRequest();
