/** Versioned documents stay available at these public URLs. Updating the words
 * requires a new version and matching database registration, never auto-consent. */
export const BUILDER_LEGAL = {
  version: "2026-09-14",
  termsHash: "ef1737304c088cc28d645b0c1e78e0ceffbf6a55b927d85589baf5cfac8dce41",
  privacyHash:
    "66d1f0ceac877e87351ae703af32aa67415eb069b7fd3e204c8b1a58706dc85d",
  termsUrl: "/builder/legal/2026-09-14/terms/",
  privacyUrl: "/builder/legal/2026-09-14/privacy/",
} as const;
export type BuilderLegalState = {
  version: string;
  termsHash: string;
  privacyHash: string;
  termsUrl: string;
  privacyUrl: string;
  acceptedAt: string | null;
};
export function isBuilderLegalState(
  value: unknown,
): value is BuilderLegalState {
  if (!value || typeof value !== "object") return false;
  const item = value as BuilderLegalState;
  return (
    /^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/.test(item.version) &&
    /^[a-f0-9]{64}$/.test(item.termsHash) &&
    /^[a-f0-9]{64}$/.test(item.privacyHash) &&
    item.termsUrl === `/builder/legal/${item.version}/terms/` &&
    item.privacyUrl === `/builder/legal/${item.version}/privacy/` &&
    (item.acceptedAt === null ||
      (typeof item.acceptedAt === "string" &&
        Number.isFinite(Date.parse(item.acceptedAt))))
  );
}
export function currentLegalDocuments(item: BuilderLegalState): boolean {
  return (
    item.version === BUILDER_LEGAL.version &&
    item.termsHash === BUILDER_LEGAL.termsHash &&
    item.privacyHash === BUILDER_LEGAL.privacyHash
  );
}
