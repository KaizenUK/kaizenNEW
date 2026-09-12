/** Server configuration only; none of these values grants account or folder access. */
export const DEFAULT_COMPANION_ORIGINS = ["https://kaizenweb.co.uk"];
export const DEFAULT_EDITOR_ORIGINS = [
  "https://kaizenweb.co.uk",
  "http://localhost:3333",
];
export const DEFAULT_CONTACT_ORIGINS = [
  "https://kaizenweb.co.uk",
  "https://www.kaizenweb.co.uk",
];
const loopback = (host: string) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(host);

export function parseAllowedOrigins(
  configured: string | undefined,
  defaults: readonly string[],
  setting: string,
): string[] {
  const entries = configured === undefined ? defaults : configured.split(",");
  const origins = entries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        const url = new URL(entry);
        if (
          !/^https?:\/\//i.test(entry) ||
          /[\\\u0000-\u0020]/.test(entry) ||
          (url.protocol !== "https:" &&
            !(url.protocol === "http:" && loopback(url.hostname))) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash ||
          url.hostname.includes("*")
        )
          throw new Error();
        return url.origin;
      } catch {
        // Do not echo a malformed value: it could include pasted credentials.
        throw new Error(
          `${setting} must list complete HTTPS origins (or HTTP localhost origins), separated by commas. Leave out paths, credentials and wildcards.`,
        );
      }
    });
  return [...new Set(origins)];
}

export function companionAllowedOrigins(
  configured?: string,
  testOrigin?: string,
): string[] {
  const origins = parseAllowedOrigins(
    configured,
    DEFAULT_COMPANION_ORIGINS,
    "BUILDER_COMPANION_ORIGINS",
  );
  if (testOrigin) {
    let valid = false;
    try {
      const url = new URL(testOrigin);
      valid =
        url.origin === testOrigin &&
        url.protocol === "http:" &&
        loopback(url.hostname);
    } catch {
      /* Report only the setting name below. */
    }
    if (!valid)
      throw new Error(
        "The companion test origin must be a loopback HTTP origin.",
      );
    origins.push(testOrigin);
  }
  return [...new Set(origins)];
}
