import {
  captureClientPublication,
  withClientLiveBaseline,
  clientHistoryCursor,
  CLIENT_HISTORY_SIZE,
} from "../../../shared/builderClientPublication.ts";
import {
  fetchContentCatalogue,
  hasContentBindings,
} from "../../../shared/builderContent.ts";
import type { Workspace } from "../../../shared/visualBuilder.ts";
import { projectDeliveryWarnings } from "../../../shared/builderDelivery.ts";

export const clientDestinationFields =
  "id,project_id,environment,origin,label,enabled,version,active_artifact_id,active_job_id";
const check = ({ data, error }: any) => {
  if (error) throw new Error(error.message);
  return data;
};
export const clientDestination = (row: any) => ({
  projectId: row.project_id,
  destinationId: row.id,
  environment: row.environment,
  origin: row.origin,
  label: row.label,
});
export const clientJob = (row: any, activeId?: string) => ({
  id: row.id,
  destination: row.destination,
  action: row.action,
  phase: row.phase,
  previousReleaseId: row.previous_artifact_id,
  artifactId: row.artifact_id,
  ...(row.rollback_of ? { rollbackOf: row.rollback_of } : {}),
  ...(row.error ? { error: row.error } : {}),
  log: row.log,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  active: activeId === row.id,
  ...(row.availability ? { availability: row.availability } : {}),
});
export async function clientLiveWorkspace(
  user: any,
  projectId: string,
  workspace: Workspace,
) {
  const destination = check(
    await user
      .from("builder_client_destinations")
      .select("id,active_job_id")
      .eq("project_id", projectId)
      .eq("environment", "production")
      .eq("enabled", true)
      .eq("domain_ready", true)
      .maybeSingle(),
  );
  let snapshot = null;
  if (destination?.active_job_id) {
    const row = check(
      await user
        .from("builder_client_jobs")
        .select("snapshot")
        .eq("project_id", projectId)
        .eq("destination_id", destination.id)
        .eq("id", destination.active_job_id)
        .single(),
    );
    snapshot = row.snapshot;
  }
  return withClientLiveBaseline(projectId, workspace, snapshot);
}
export async function clientPublicationAction({
  user,
  service,
  projectId,
  actor,
  input,
  state,
}: {
  user: any;
  service: any;
  projectId: string;
  actor: string;
  input: any;
  state?: { version: number; payload: Workspace };
}) {
  if (input.action === "client-release-list") {
    const result = check(
      await user.rpc("builder_client_history", {
        target: projectId,
        before_job: clientHistoryCursor(input.before),
      }),
    );
    const configured = result.destinations;
    const rows = result.rows.slice(0, CLIENT_HISTORY_SIZE);
    const present = (row: any) =>
      clientJob(
        row,
        configured.find((d: any) => d.id === row.destination_id && d.enabled)
          ?.active_job_id,
      );
    return {
      destinations: configured
        .filter((row: any) => row.enabled)
        .map(clientDestination),
      jobs: rows.map(present),
      currentJobs: result.currentRows.map(present),
      nextCursor:
        result.rows.length > CLIENT_HISTORY_SIZE
          ? rows[rows.length - 1].id
          : null,
    };
  }
  if (input.action === "client-release-review") {
    if (!state)
      throw new Error("Load the saved workspace before reviewing a release.");
    const destination = check(
      await user
        .from("builder_client_destinations")
        .select(clientDestinationFields)
        .eq("project_id", projectId)
        .eq("id", input.destinationId)
        .single(),
    );
    let snapshot = null;
    if (input.releaseAction === "publish") {
      const workspace = state.payload;
      let catalogue;
      if (
        workspace.pages.some((page) =>
          hasContentBindings(page.draft.data.content),
        ) ||
        workspace.site?.draft.components.some((component) =>
          hasContentBindings(component.blocks),
        )
      ) {
        const cms = workspace.settings?.value.cms;
        if (cms?.kind !== "sanity-public")
          throw new Error(
            "Configure this project's public Sanity connection before publishing connected content.",
          );
        catalogue = await fetchContentCatalogue({
          projectId: cms.projectId,
          dataset: cms.dataset,
        });
      }
      snapshot = captureClientPublication(projectId, workspace, catalogue);
    }
    const review = check(
      await service.rpc("builder_client_review", {
        request_id: crypto.randomUUID(),
        target: projectId,
        actor,
        destination_id: destination.id,
        expected_workspace_version: state.version,
        expected_destination_version: destination.version,
        release_action: input.releaseAction,
        candidate: snapshot,
        rollback_id: input.rollbackOf || null,
      }),
    );
    return {
      id: review.id,
      destination: clientDestination(destination),
      action: review.action,
      expiresAt: new Date(review.expires_at).getTime(),
      previousReleaseId: review.previous_artifact_id,
      warnings: review.snapshot
        ? projectDeliveryWarnings(
            review.snapshot.workspace,
            review.snapshot.catalogue,
            destination.origin,
          )
        : [],
      ...(review.rollback_of ? { rollbackOf: review.rollback_of } : {}),
      pages:
        review.snapshot?.workspace.pages.map((page: any) => ({
          id: page.id,
          title: page.draft.title,
          slug: page.draft.slug,
          version: page.version,
        })) || [],
    };
  }
  if (input.action === "client-release-start") {
    const job = check(
      await service.rpc("builder_client_start", {
        target: projectId,
        actor,
        review_id: input.reviewId,
      }),
    );
    const destination = check(
      await user
        .from("builder_client_destinations")
        .select("active_job_id")
        .eq("project_id", projectId)
        .eq("id", job.destination_id)
        .single(),
    );
    return clientJob(job, destination.active_job_id);
  }
  if (input.action === "client-release-recover")
    throw new Error(
      "Hosted recovery must be performed by the destination operator after verifying the worker has stopped. Its ownership is not reclaimed by the browser.",
    );
  throw new Error("Unsupported client publication action.");
}
