/** Project identity is independent of page IDs and browser preferences. No credentials belong here. */
export const PROJECT_FORMAT_VERSION = 1;
export const LEGACY_PROJECT_ID = "kaizen";
export type ProjectCapabilities = {
  hasInventory: boolean;
  legacyWorkspace: boolean;
  publishPath: "github" | "worker";
};
export const DEFAULT_PROJECT_CAPABILITIES: Readonly<ProjectCapabilities> = {
  hasInventory: false,
  legacyWorkspace: false,
  publishPath: "worker",
};
export const LEGACY_PROJECT_CAPABILITIES: Readonly<ProjectCapabilities> = {
  hasInventory: true,
  legacyWorkspace: true,
  publishPath: "github",
};
/** Missing hosted configuration must never silently select the original site's API. */
export function projectCapabilities(value: unknown): ProjectCapabilities {
  const input = value as Partial<ProjectCapabilities> | null;
  if (
    !input ||
    typeof input.hasInventory !== "boolean" ||
    typeof input.legacyWorkspace !== "boolean" ||
    !["github", "worker"].includes(input.publishPath || "") ||
    (input.publishPath === "github") !== input.legacyWorkspace
  )
    throw new Error(
      "This project’s settings are missing or invalid. Ask the owner to check the project setup.",
    );
  return {
    hasInventory: input.hasInventory,
    legacyWorkspace: input.legacyWorkspace,
    publishPath: input.publishPath as ProjectCapabilities["publishPath"],
  };
}
export type BuilderProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  version: number;
  capabilities: ProjectCapabilities;
  destination: {
    kind:
      | "unconfigured"
      | "legacy-local"
      | "legacy-hosted"
      | "client-configured";
    label: string;
  };
  access?: { role: "owner" | "editor"; canPublish: boolean };
  /** Publishing is paused by an operator review; content is kept. */
  suspension?: { state: "suspended" | "taken_down"; since: string };
  copy?: {
    pending: boolean;
    cancelling?: boolean;
    canResume: boolean;
    files: number;
    copied: number;
  };
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
