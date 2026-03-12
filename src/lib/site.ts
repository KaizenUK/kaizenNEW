const DEFAULT_SITE_URL = "https://kaizenweb.co.uk";
const DEFAULT_STUDIO_URL = "https://studio.kaizenweb.co.uk/studio";

function readEnv(key: string): string | undefined {
  const metaEnv = (import.meta.env ?? {}) as Record<string, unknown>;
  const metaValue = metaEnv[key];
  if (typeof metaValue === "string" && metaValue.trim()) {
    return metaValue.trim();
  }

  if (typeof process !== "undefined") {
    const processValue = process.env?.[key];
    if (typeof processValue === "string" && processValue.trim()) {
      return processValue.trim();
    }
  }

  return undefined;
}

export function getSiteOrigin(): string {
  return (readEnv("PUBLIC_SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function getStudioUrl(): string {
  return (readEnv("PUBLIC_STUDIO_URL") ?? DEFAULT_STUDIO_URL).replace(
    /\/+$/,
    "",
  );
}

export function normalizeSitePath(pathname: string): string {
  const rawPath = String(pathname ?? "").split(/[?#]/, 1)[0]?.trim() || "";
  if (!rawPath || rawPath === "/") return "/";

  const trimmedPath = rawPath.replace(/^\/+|\/+$/g, "");
  return trimmedPath ? `/${trimmedPath}/` : "/";
}

export function getLocalSitePath(input: string | null | undefined): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("/")) {
    return normalizeSitePath(raw);
  }

  if (!/^https?:\/\//i.test(raw)) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.origin !== getSiteOrigin()) {
      return null;
    }

    return normalizeSitePath(url.pathname);
  } catch {
    return null;
  }
}

export function resolveCanonicalUrl(
  canonical: string | null | undefined,
  fallbackPath: string,
): string {
  const localPath = getLocalSitePath(canonical);
  if (localPath) {
    return `${getSiteOrigin()}${localPath}`;
  }

  const rawCanonical = String(canonical ?? "").trim();
  if (rawCanonical) {
    return rawCanonical;
  }

  return `${getSiteOrigin()}${normalizeSitePath(fallbackPath)}`;
}

export function isCanonicalForPath(
  pathname: string,
  canonical: string | null | undefined,
): boolean {
  const rawCanonical = String(canonical ?? "").trim();
  if (!rawCanonical) {
    return true;
  }

  const localPath = getLocalSitePath(rawCanonical);
  if (!localPath) {
    return false;
  }

  return localPath === normalizeSitePath(pathname);
}
