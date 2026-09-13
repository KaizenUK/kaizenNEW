import type { RepositorySaveStatus } from "./builderRepositorySave";

export type RepositoryPublishTarget = {
  environment: "production";
  branch: string;
  url: string;
  workflow?: string;
};
export type RepositoryPublishReview = {
  id: string;
  projectId: string;
  commit: string;
  productionBase: string;
  stagingUrl: string;
  productionUrl: string;
  stagingReleaseId: string;
  files: string[];
  expiresAt: number;
};
export type RepositoryPublishStatus = {
  review: RepositoryPublishReview;
  phase: "reviewed" | "uncertain" | "sent";
  message: string;
  error?: string;
  release?: RepositorySaveStatus["release"];
  delivery?: "waiting" | "reported" | "unavailable";
};
export const repositoryPublishActions = new Set([
  "repository-publish-review",
  "repository-publish",
  "repository-publish-status",
]);
