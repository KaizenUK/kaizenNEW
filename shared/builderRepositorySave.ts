/** Server-authorized Git saves and separately observed deployment state. No private credentials. */
export type RepositorySaveTarget = {
  environment: "staging";
  url: string;
  workflow?: string;
};
export type RepositorySaveStatus = {
  planId: string;
  projectId: string;
  phase: "applied" | "committed" | "saved" | "recovery_required";
  files: string[];
  branch: string;
  destinationUrl: string;
  commit?: string;
  message: string;
  error?: string;
  release?: {
    state:
      | "waiting"
      | "queued"
      | "building"
      | "succeeded"
      | "failed"
      | "unavailable";
    message: string;
    url?: string;
  };
};
