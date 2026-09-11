/** Public client-site configuration. Secrets and deployment credentials never belong in this format. */
export type ClientSettings = {
  schemaVersion: 1;
  siteUrl: string;
  formEndpoint: string;
  favicon?: { assetId: string };
  cms:
    | { kind: "none" }
    | { kind: "sanity-public"; projectId: string; dataset: string };
};
export type SettingsState = { version: number; value: ClientSettings };
export const defaultClientSettings = (): ClientSettings => ({
  schemaVersion: 1,
  siteUrl: "",
  formEndpoint: "",
  cms: { kind: "none" },
});
function publicUrl(value: unknown, originOnly = false): string {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    /[\u0000-\u0020\\]/.test(value)
  )
    throw new Error("Use a public URL without spaces or credentials.");
  if (!value) return "";
  if (!originOnly && /^\/(?!\/)/.test(value)) {
    const url = new URL(value, "https://site.invalid");
    if (
      url.search ||
      url.hash ||
      url.pathname.startsWith("/__builder") ||
      url.pathname.startsWith("/builder")
    )
      throw new Error(
        "Use the destination site's public form receiver path, without query parameters.",
      );
    return url.pathname;
  }
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (originOnly && url.pathname !== "/")
  )
    throw new Error(
      "Use an HTTPS URL without credentials or query parameters. The site URL must be an origin without a subfolder.",
    );
  return originOnly ? url.origin : url.href;
}
export function validateClientSettings(value: ClientSettings): ClientSettings {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    Object.keys(value).some(
      (key) =>
        ![
          "schemaVersion",
          "siteUrl",
          "formEndpoint",
          "favicon",
          "cms",
        ].includes(key),
    )
  )
    throw new Error(
      "Unsupported client settings. Do not store secrets in project settings.",
    );
  const siteUrl = publicUrl(value.siteUrl, true),
    formEndpoint = publicUrl(value.formEndpoint);
  if (!value.cms || !["none", "sanity-public"].includes(value.cms.kind))
    throw new Error("Choose an explicit CMS connection.");
  if (
    value.cms.kind === "sanity-public" &&
    (!/^[a-z0-9]{1,40}$/.test(value.cms.projectId) ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(value.cms.dataset))
  )
    throw new Error("Use a valid public Sanity project ID and dataset.");
  const cms =
    value.cms.kind === "none"
      ? { kind: "none" as const }
      : {
          kind: "sanity-public" as const,
          projectId: value.cms.projectId,
          dataset: value.cms.dataset,
        };
  if (Object.keys(value.cms).some((key) => !Object.keys(cms).includes(key)))
    throw new Error("CMS secrets cannot be saved in client settings.");
  if (
    value.favicon &&
    (!/^[a-f0-9-]{36}$/.test(value.favicon.assetId) ||
      Object.keys(value.favicon).some((key) => key !== "assetId"))
  )
    throw new Error("Choose a favicon from this project's asset library.");
  return {
    schemaVersion: 1,
    siteUrl,
    formEndpoint,
    cms,
    ...(value.favicon ? { favicon: { assetId: value.favicon.assetId } } : {}),
  };
}
export function validateSettingsState(state: SettingsState): SettingsState {
  if (
    !state ||
    !Number.isSafeInteger(state.version) ||
    state.version < 1 ||
    Object.keys(state).some((key) => !["version", "value"].includes(key))
  )
    throw new Error("Invalid client settings version.");
  return { version: state.version, value: validateClientSettings(state.value) };
}
export function saveClientSettings(
  current: SettingsState | undefined,
  version: number,
  value: ClientSettings,
): SettingsState {
  if (version !== (current?.version || 0))
    throw new Error(
      "Client settings changed in another window. Reload before saving.",
    );
  return { version: version + 1, value: validateClientSettings(value) };
}
export function disconnectedSettings(
  state?: SettingsState,
): SettingsState | undefined {
  return state
    ? {
        version: 1,
        value: {
          ...defaultClientSettings(),
          ...(state.value.favicon ? { favicon: state.value.favicon } : {}),
        },
      }
    : undefined;
}
