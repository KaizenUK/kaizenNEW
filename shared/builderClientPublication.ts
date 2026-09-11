import { clone, type Workspace } from "./visualBuilder.ts";
import { validateBackupWorkspace } from "./builderBackup.ts";
import { LEGACY_PROJECT_ID, validProjectId } from "./builderProjects.ts";
import type { ContentCatalogue } from "./visualBuilder.ts";

export type ClientDestination = {
  projectId: string;
  destinationId: string;
  environment: "staging" | "production";
  origin: string;
  label: string;
};
export type ClientPublicationSnapshot = {
  schemaVersion: 1;
  projectId: string;
  capturedAt: string;
  workspace: Workspace;
  catalogue?: ContentCatalogue;
};
export type ClientPublicationPhase =
  | "queued"
  | "building"
  | "activating"
  | "verifying"
  | "live"
  | "failed"
  | "rolled_back"
  | "recovery_required";
export type ClientPublicationJob = {
  id: string;
  destination: ClientDestination;
  action: "publish" | "rollback" | "unpublish";
  phase: ClientPublicationPhase;
  createdAt: string;
  updatedAt: string;
  previousReleaseId: string | null;
  artifactId: string;
  rollbackOf?: string;
  error?: string;
  log: string;
  active: boolean;
  recoveryAvailable?: boolean;
};
export type ClientPublicationReview = {
  id: string;
  destination: ClientDestination;
  action: ClientPublicationJob["action"];
  expiresAt: number;
  previousReleaseId: string | null;
  pages: { id: string; title: string; slug: string; version: number }[];
  rollbackOf?: string;
};
export const CLIENT_HISTORY_SIZE = 50;
export const pendingClientRelease = (job: ClientPublicationJob) =>
  [
    "queued",
    "building",
    "activating",
    "verifying",
    "recovery_required",
  ].includes(job.phase);
export function clientHistoryCursor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    )
  )
    throw new Error(
      "Invalid release history cursor. Open the latest releases.",
    );
  return value;
}
export function clientHistoryPage(
  jobs: ClientPublicationJob[],
  before?: unknown,
) {
  const cursor = clientHistoryCursor(before);
  const sorted = [...jobs].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  const index = cursor ? sorted.findIndex((job) => job.id === cursor) : -1;
  if (cursor && index < 0)
    throw new Error(
      "Invalid release history cursor. Open the latest releases.",
    );
  const page = sorted.slice(index + 1, index + 1 + CLIENT_HISTORY_SIZE);
  return {
    jobs: page,
    currentJobs: sorted.filter(
      (job) => job.active || pendingClientRelease(job),
    ),
    nextCursor:
      sorted.length > index + 1 + page.length ? page[page.length - 1].id : null,
  };
}
function clientProject(projectId: string) {
  if (!validProjectId(projectId) || projectId === LEGACY_PROJECT_ID)
    throw new Error(
      "Choose a client project. The original Kaizen release workflow is separate.",
    );
}
/** Stable draft input, excluding publication pointers which may change independently. */
export function clientDraftInput(workspace: Workspace): string {
  const value = {
    pages: workspace.pages.map((page) => ({
      id: page.id,
      version: page.version,
      draft: page.draft,
      revisions: page.revisions,
    })),
    assets: workspace.assets,
    saved: workspace.saved,
    site: workspace.site && {
      version: workspace.site.version,
      draft: workspace.site.draft,
    },
    routes: workspace.routes && {
      version: workspace.routes.version,
      draft: workspace.routes.draft,
    },
    settings: workspace.settings,
  };
  const stable = (input: any): any =>
    Array.isArray(input)
      ? input.map(stable)
      : input && typeof input === "object"
        ? Object.fromEntries(
            Object.keys(input)
              .sort()
              .map((key) => [key, stable(input[key])]),
          )
        : input;
  return JSON.stringify(stable(value));
}
export function captureClientPublication(
  projectId: string,
  workspace: Workspace,
  catalogue?: ContentCatalogue,
): ClientPublicationSnapshot {
  clientProject(projectId);
  const validated = validateBackupWorkspace(workspace);
  if (!validated.pages.length)
    throw new Error("Create a page before publishing this project.");
  return clone({
    schemaVersion: 1,
    projectId,
    capturedAt: new Date().toISOString(),
    workspace: validated,
    ...(catalogue ? { catalogue } : {}),
  });
}
/** Display a verified production baseline without changing draft versions, edits or history. */
export function withClientLiveBaseline(
  projectId: string,
  draft: Workspace,
  baseline: ClientPublicationSnapshot | null,
): Workspace {
  clientProject(projectId);
  if (
    baseline &&
    (baseline.schemaVersion !== 1 || baseline.projectId !== projectId)
  )
    throw new Error("The live baseline belongs to a different client project.");
  const workspace = clone(draft);
  const published = new Map(
    baseline?.workspace.pages.map((page) => [page.id, page.draft]) || [],
  );
  workspace.pages = workspace.pages.map((page) => ({
    ...page,
    published: clone(published.get(page.id) || null),
    ...(published.has(page.id)
      ? { publishedAt: baseline!.capturedAt }
      : { publishedAt: undefined }),
  }));
  if (workspace.site)
    workspace.site.published = clone(baseline?.workspace.site?.draft || null);
  if (workspace.routes)
    workspace.routes.published = clone(baseline?.workspace.routes?.draft || []);
  return workspace;
}
