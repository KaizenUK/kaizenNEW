const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const processEnv =
  typeof process !== "undefined" && process.env
    ? (process.env as Record<string, string | undefined>)
    : {};

function pick(...values: Array<string | undefined>) {
  return values.find((v) => typeof v === "string" && v.trim().length > 0);
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Set it in your .env (for local) or hosting environment.`,
    );
  }
  return value;
}

/**
 * FRONTEND (public) - safe in browser
 */
export const publicProjectId =
  pick(
    env.PUBLIC_SANITY_PROJECT_ID,
    env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    env.VITE_SANITY_PROJECT_ID,
    env.SANITY_PROJECT_ID,
    processEnv.PUBLIC_SANITY_PROJECT_ID,
    processEnv.NEXT_PUBLIC_SANITY_PROJECT_ID,
    processEnv.VITE_SANITY_PROJECT_ID,
    processEnv.SANITY_PROJECT_ID,
  ) ?? "";

export const publicDataset =
  pick(
    env.PUBLIC_SANITY_DATASET,
    env.NEXT_PUBLIC_SANITY_DATASET,
    env.VITE_SANITY_DATASET,
    env.SANITY_DATASET,
    processEnv.PUBLIC_SANITY_DATASET,
    processEnv.NEXT_PUBLIC_SANITY_DATASET,
    processEnv.VITE_SANITY_DATASET,
    processEnv.SANITY_DATASET,
  ) ?? "production";

export const apiVersion =
  pick(env.PUBLIC_SANITY_API_VERSION, processEnv.PUBLIC_SANITY_API_VERSION) ??
  "2024-01-01";

/**
 * STUDIO (browser-safe)
 * Use PUBLIC_STUDIO_DATASET so Studio UI components can hydrate safely.
 */
export const publicStudioDataset =
  pick(env.PUBLIC_STUDIO_DATASET, processEnv.PUBLIC_STUDIO_DATASET) ??
  publicDataset;

/**
 * STUDIO (server-only strict values)
 * These are for sanity.config.ts (runs server-side).
 */
export const studioProjectId = requireEnv(
  pick(processEnv.SANITY_STUDIO_PROJECT_ID, env.SANITY_STUDIO_PROJECT_ID) ??
    publicProjectId,
  "SANITY_STUDIO_PROJECT_ID (or PUBLIC_SANITY_PROJECT_ID fallback)",
);

export const studioDataset = requireEnv(
  pick(processEnv.SANITY_STUDIO_DATASET, env.SANITY_STUDIO_DATASET) ??
    pick(processEnv.PUBLIC_STUDIO_DATASET, env.PUBLIC_STUDIO_DATASET),
  "SANITY_STUDIO_DATASET (or PUBLIC_STUDIO_DATASET)",
);

/**
 * Backwards-compatible exports used by sanity.config.ts today.
 * (These are server-only strict.)
 */
export const resolvedProjectId = studioProjectId;
export const resolvedDataset = studioDataset;
