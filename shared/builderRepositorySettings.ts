import type { RepositorySaveTarget } from "./builderRepositorySave";

/** Owner-only connection metadata. Private keys and credential paths never belong in this response. */
export type RepositorySettingsValue = {
  repositoryUrl: string;
  branch: string;
  saveToWebsite?: RepositorySaveTarget;
};
export type RepositorySettingsState = {
  version: number;
  repository?: RepositorySettingsValue;
  connected: boolean;
  key: { configured: boolean; fingerprint?: string };
};
export const repositorySetupActions = new Set([
  "repository-settings-read",
  "repository-settings-save",
  "repository-settings-key",
  "repository-settings-connect",
]);
