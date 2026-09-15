import type { BuilderProject } from "../../shared/builderProjects";
import type { ClientPublicationJob } from "../../shared/builderClientPublication";
import type { PageDocument, Workspace } from "../../shared/visualBuilder";

export type FirstRunProgress = {
  schemaVersion: 1;
  enrolled: true;
  dismissed: boolean;
  preview?: { pageId: string; digest: string };
};
export const firstRunKey = (account: string, project: string) =>
  `kaizen-builder-first-run:${encodeURIComponent(account)}:${encodeURIComponent(project)}`;

export function readFirstRun(
  value: string | null,
): FirstRunProgress | undefined {
  try {
    const data = JSON.parse(value || "null");
    if (
      data?.schemaVersion !== 1 ||
      data.enrolled !== true ||
      typeof data.dismissed !== "boolean"
    )
      return;
    const preview = data.preview;
    return {
      schemaVersion: 1,
      enrolled: true,
      dismissed: data.dismissed,
      ...(typeof preview?.pageId === "string" &&
      /^[a-f0-9]{64}$/.test(preview?.digest)
        ? { preview: { pageId: preview.pageId, digest: preview.digest } }
        : {}),
    };
  } catch {
    return;
  }
}

export function firstRunEligible(
  project?: BuilderProject,
  hasWebsiteFolder = false,
) {
  return Boolean(
    project &&
    !project.archived &&
    !project.capabilities.legacyWorkspace &&
    !project.capabilities.hasInventory &&
    project.capabilities.publishPath === "worker" &&
    !hasWebsiteFolder,
  );
}

export function newProjectWorkspace(workspace: Workspace) {
  return workspace.pages.length === 0 && (workspace.site?.version || 0) === 0;
}

/** Remember a fingerprint, never page contents or private asset addresses. */
export async function previewDigest(
  document: PageDocument,
  workspace: Workspace,
) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      document,
      site: workspace.site?.draft || null,
      assets: workspace.assets
        .map(({ id, hash }) => ({ id, hash }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function firstRunSteps(
  project: BuilderProject,
  workspace: Workspace,
  previewMatches: boolean,
  jobs: ClientPublicationJob[],
) {
  return [
    {
      id: "name",
      label: "Name your site",
      complete: Boolean(project.name.trim()),
    },
    {
      id: "design",
      label: "Choose a site design",
      complete: (workspace.site?.version || 0) > 0,
    },
    { id: "page", label: "Add a page", complete: workspace.pages.length > 0 },
    {
      id: "preview",
      label: "Preview it",
      complete: workspace.pages.length > 0 && previewMatches,
    },
    {
      id: "publish",
      label: "Publish",
      complete: jobs.some(
        (job) =>
          job.destination.projectId === project.id &&
          job.active &&
          job.phase === "live" &&
          job.action !== "unpublish",
      ),
    },
  ] as const;
}
export type FirstRunStep = ReturnType<typeof firstRunSteps>[number]["id"];
