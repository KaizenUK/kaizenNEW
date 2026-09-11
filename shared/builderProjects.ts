/** Project identity is independent of page IDs and browser preferences. No credentials belong here. */
export const PROJECT_FORMAT_VERSION = 1;
export const LEGACY_PROJECT_ID = "kaizen";
export type BuilderProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  version: number;
  destination: {
    kind: "unconfigured" | "legacy-local" | "legacy-hosted" | "client-configured";
    label: string;
  };
  access?: { role: "owner" | "editor"; canPublish: boolean };
};
export function validProjectId(id: string): boolean {
  return (
    id === LEGACY_PROJECT_ID ||
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      id,
    )
  );
}
export function projectName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 100 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error("Use a project name between 1 and 100 characters.");
  return value.trim();
}
