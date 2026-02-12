const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

export const projectId =
  env.PUBLIC_SANITY_PROJECT_ID ??
  env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  env.VITE_SANITY_PROJECT_ID ??
  env.SANITY_PROJECT_ID ??
  process.env.PUBLIC_SANITY_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  process.env.VITE_SANITY_PROJECT_ID ??
  process.env.SANITY_PROJECT_ID ??
  "";

export const dataset =
  env.PUBLIC_SANITY_DATASET ??
  env.NEXT_PUBLIC_SANITY_DATASET ??
  env.VITE_SANITY_DATASET ??
  env.SANITY_DATASET ??
  process.env.PUBLIC_SANITY_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  process.env.VITE_SANITY_DATASET ??
  process.env.SANITY_DATASET ??
  "production";

export const siteUrl = (
  env.PUBLIC_SITE_URL ??
  env.NEXT_PUBLIC_SITE_URL ??
  process.env.PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kaizenweb.co.uk"
).replace(/\/$/, "");

export const apiVersion = "2025-01-01";

export const resolvedProjectId = projectId || "missing-project-id";
export const resolvedDataset = dataset || "production";
