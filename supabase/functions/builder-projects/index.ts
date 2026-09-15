import { checkFunctionLimit } from "../_shared/functionLimits.ts";
import { bootstrapAccount } from "../_shared/builderSignup.ts";
import { domainProjectAction } from "../_shared/builderDomains.ts";
import { runProjectCopy } from "../_shared/builderProjectCopies.ts";
import { registerVerifiedAsset } from "../_shared/builderRegisterAssets.ts";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { recordClientDiagnostic } from "../_shared/clientDiagnostics.ts";
import { getCorsHeaders, isOriginAllowed } from "../_shared/editorAuth.ts";
import { fetchContentCatalogue } from "../../../shared/builderContent.ts";
import {
  validProjectId,
  projectName,
  projectCapabilities,
} from "../../../shared/builderProjects.ts";
import {
  applyProjectDraftAction,
  assertProjectAssetReferences,
  projectAssetUrl,
} from "../../../shared/builderProjectOperations.ts";
import {
  createPrivatePreview,
  previewSummary,
  isPreviewId,
} from "../../../shared/builderPreviews.ts";
import type { Workspace } from "../../../shared/visualBuilder.ts";
import {
  clientDestinationFields,
  clientPublicationAction,
  clientLiveWorkspace,
} from "../_shared/clientPublication.ts";

const check = ({ data, error }: any) => {
  if (error) throw new Error(error.message);
  return data;
};
const projectRecord = (row: any, member: any) => ({
  id: row.id,
  name: row.name,
  archived: row.archived,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  destination: row.destination,
  capabilities: projectCapabilities(row.capabilities),
  access: { role: member.role, canPublish: member.can_publish },
  ...(row.copy ? { copy: row.copy } : {}),
});

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);
  headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, apikey, x-client-info",
  );
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  const json = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), { status, headers });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!isOriginAllowed(request))
    return json(403, { error: "Forbidden origin" });
  if (request.method !== "POST")
    return json(405, { error: "Method not allowed" });
  const token = /^Bearer ([^\s]{1,8192})$/i.exec(
    request.headers.get("Authorization") || "",
  )?.[1];
  if (!token) return json(401, { error: "Sign in to open this project." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const globalLimit = await checkFunctionLimit(
    service,
    "builder-projects",
    headers,
  );
  if (globalLimit) return globalLimit;
  const { data: auth, error: authError } = await service.auth.getUser(token);
  if (authError || !auth.user)
    return json(401, { error: "Your session expired. Sign in again." });
  const userLimit = await checkFunctionLimit(
    service,
    "builder-projects",
    headers,
    auth.user.id,
  );
  if (userLimit) return userLimit;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  try {
    const reader = request.body?.getReader();
    if (!reader) return json(400, { error: "A project action is required." });
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 52 * 1024 * 1024) {
        await reader.cancel();
        return json(413, { error: "Project request is too large." });
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const input = JSON.parse(new TextDecoder().decode(bytes));
    const action = input.action || "list";
    if (action === "bootstrap") {
      const result = await bootstrapAccount(service, auth.user.id);
      return json(result.status, result.body);
    }
    async function list() {
      const rows = check(await user.from("builder_projects").select("*"));
      const memberships = check(
        await user
          .from("builder_project_members")
          .select("*")
          .eq("user_id", auth.user!.id),
      );
      const destinations = check(
        await user
          .from("builder_client_destinations")
          .select(clientDestinationFields),
      );
      const copies = check(
        await service.rpc("builder_project_copy_summaries", {
          actor: auth.user!.id,
        }),
      );
      return rows.map((row: any) =>
        projectRecord(
          {
            ...row,
            copy: copies.find((copy: any) => copy.projectId === row.id),
            ...(destinations.some(
              (d: any) => d.project_id === row.id && d.enabled,
            )
              ? {
                  destination: {
                    kind: "client-configured",
                    label: destinations
                      .filter((d: any) => d.project_id === row.id && d.enabled)
                      .map((d: any) => `${d.environment}: ${d.origin}`)
                      .join(" · "),
                  },
                }
              : {}),
          },
          memberships.find((m: any) => m.project_id === row.id),
        ),
      );
    }
    if (action === "list") return json(200, await list());
    if (action === "create") {
      const id = check(
        await user.rpc("builder_create_project", {
          project_name: projectName(input.name),
        }),
      );
      return json(
        200,
        (await list()).find((project: any) => project.id === id),
      );
    }
    const target = input.projectId || input.id;
    if (typeof target !== "string" || !validProjectId(target))
      return json(400, { error: "Invalid project ID." });
    if (action === "duplicate-cancel") {
      if (
        input.confirm !== true ||
        !Number.isInteger(input.version) ||
        input.version < 1
      )
        return json(400, {
          error: "Confirm cancellation of this unfinished copy.",
        });
      // The private routine checks current ownership itself. After verified
      // purge, its small request receipt makes a lost-response retry idempotent.
      return json(
        200,
        check(
          await service.rpc("builder_project_copy_cancel", {
            target,
            actor: auth.user.id,
            expected_version: input.version,
          }),
        ),
      );
    }
    if (action === "record-error") {
      const result = await recordClientDiagnostic(
        service,
        target,
        auth.user.id,
        input.report,
      );
      return json(result.status, result.body);
    }
    // Other operations, including reads/download registration/previews, start with
    // an actual RLS-backed membership lookup using the verified user's JWT.
    const membership = check(
      await user
        .from("builder_project_members")
        .select("role,can_publish")
        .eq("project_id", target)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
    );
    const project =
      membership &&
      check(
        await user
          .from("builder_projects")
          .select("*")
          .eq("id", target)
          .maybeSingle(),
      );
    if (!project || !membership)
      return json(403, { error: "Project membership required." });
    if (
      ["domain-state", "domain-add", "domain-verify", "domain-remove"].includes(
        action,
      )
    ) {
      if (
        action !== "domain-state" &&
        (membership.role !== "owner" || !membership.can_publish)
      ) {
        return json(403, {
          error:
            "A website owner with publishing permission must manage its domain.",
        });
      }
      const result = await domainProjectAction({
        service,
        projectId: target,
        actor: auth.user.id,
        input,
        configuration: Deno.env.get("BUILDER_DOMAIN_CONFIG"),
      });
      return json(result.status, result.body);
    }
    if (action === "project-billing" || action === "take-billing") {
      if (action === "take-billing") {
        if (membership.role !== "owner" || input.confirm !== true)
          return json(403, {
            error: "A website owner must confirm using their own plan.",
          });
        check(
          await service.rpc("builder_take_project_billing", {
            target,
            actor: auth.user.id,
          }),
        );
      }
      return json(
        200,
        check(
          await service.rpc("builder_project_billing_summary", {
            target,
            actor: auth.user.id,
          }),
        ),
      );
    }
    if (action === "rename" || action === "archive") {
      check(
        await user.rpc("builder_update_project", {
          target,
          expected_version: input.version,
          ...(action === "rename"
            ? { project_name: projectName(input.name) }
            : { archive: input.archived }),
        }),
      );
      return json(
        200,
        (await list()).find((p: any) => p.id === target),
      );
    }
    if (action === "members")
      return json(
        200,
        check(await user.rpc("builder_member_directory", { target })),
      );
    if (action === "set-member") {
      check(
        await user.rpc("builder_set_project_member", {
          target,
          member_id: input.userId,
          member_role: input.role,
          publish_permission: input.canPublish === true,
        }),
      );
      return json(200, { ok: true });
    }
    if (action === "duplicate" || action === "duplicate-resume") {
      const id = await runProjectCopy({
        service,
        user,
        actor: auth.user.id,
        token,
        project,
        input,
        origin: Deno.env.get("BUILDER_UPLOAD_ORIGIN"),
      });
      return json(
        200,
        (await list()).find((p: any) => p.id === id),
      );
    }
    if (action === "register-asset") {
      return json(
        200,
        await registerVerifiedAsset({
          service,
          actor: auth.user.id,
          projectId: target,
          asset: input.asset,
          storageUrl: url,
        }),
      );
    }
    if (projectCapabilities(project.capabilities).legacyWorkspace)
      return json(409, {
        error: "The original site uses the preserved Kaizen workspace API.",
      });
    const readActions = [
      "load",
      "client-release-list",
      "content",
      "preview-list",
      "preview-read",
      "asset-read",
    ];
    if (!readActions.includes(action) && project.archived)
      return json(409, {
        error: "Restore this archived project before editing.",
      });
    if (
      ["publish", "publish-site", "publish-routes", "release-action"].includes(
        action,
      )
    ) {
      if (!membership.can_publish)
        return json(403, {
          error: "You do not have permission to publish this project.",
        });
      return json(409, {
        error:
          "Configure and verify this project's deployment destination before publishing. Kaizen's live site is not a default destination.",
      });
    }
    // History polling does not need to transfer the full draft/assets payload.
    if (action === "client-release-list")
      return json(
        200,
        await clientPublicationAction({
          user,
          service,
          projectId: target,
          actor: auth.user.id,
          input,
        }),
      );
    const state = check(
      await user
        .from("builder_project_workspaces")
        .select("version,payload")
        .eq("project_id", target)
        .single(),
    );
    const workspace = state.payload as Workspace;
    if (action === "load")
      return json(200, await clientLiveWorkspace(user, target, workspace));
    if (action.startsWith("client-release-")) {
      if (action !== "client-release-list" && !membership.can_publish)
        return json(403, {
          error: "You do not have permission to publish this project.",
        });
      return json(
        200,
        await clientPublicationAction({
          user,
          service,
          projectId: target,
          actor: auth.user.id,
          input,
          state,
        }),
      );
    }
    if (action === "content") {
      const cms = workspace.settings?.value.cms;
      if (cms?.kind !== "sanity-public")
        throw new Error(
          "Configure this project's public Sanity connection in Client settings first.",
        );
      return json(
        200,
        await fetchContentCatalogue({
          projectId: cms.projectId,
          dataset: cms.dataset,
        }),
      );
    }
    if (action === "asset-read")
      return json(
        200,
        workspace.assets.find((asset) => asset.id === input.assetId) || null,
      );
    if (action === "preview-list" || action === "preview-read") {
      if (action === "preview-read" && !isPreviewId(input.previewId))
        throw new Error("Invalid preview ID.");
      const rows = check(
        await user
          .from("builder_project_previews")
          .select("id,payload")
          .eq("project_id", target),
      );
      if (action === "preview-list")
        return json(
          200,
          rows.map((row: any) => previewSummary(row.payload)),
        );
      const preview = rows.find(
        (row: any) => row.id === input.previewId,
      )?.payload;
      if (!preview)
        return json(404, {
          error: "This preview is expired, revoked or unavailable.",
        });
      return json(200, preview);
    }
    if (action === "preview-create" || action === "preview-revoke") {
      if (!isPreviewId(input.previewId)) throw new Error("Invalid preview ID.");
      const snapshot =
        action === "preview-create"
          ? createPrivatePreview(input.previewId, input.document, input.hours)
          : null;
      if (snapshot)
        assertProjectAssetReferences(
          {
            ...workspace,
            pages: [
              {
                id: input.previewId,
                version: 1,
                draft: snapshot.document,
                published: null,
                revisions: [],
                updatedAt: snapshot.createdAt,
              },
            ],
          },
          target,
        );
      const saved = check(
        await service.rpc("builder_project_preview_write", {
          target,
          actor: auth.user.id,
          preview_id: input.previewId,
          snapshot,
          revoke: action === "preview-revoke",
        }),
      );
      return json(200, saved ? previewSummary(saved) : null);
    }
    if (
      action === "create-starter" &&
      projectCapabilities(project.capabilities).hasInventory
    )
      throw new Error("Create a starter in a new builder project.");
    const result = applyProjectDraftAction(workspace, input);
    assertProjectAssetReferences(result.workspace, target);
    check(
      await service.rpc("builder_commit_project_workspace", {
        target,
        actor: auth.user.id,
        expected_version: state.version,
        workspace: result.workspace,
      }),
    );
    return json(200, result.result);
  } catch (error) {
    return json(409, {
      error:
        error instanceof Error
          ? error.message
          : "The project operation could not be completed.",
    });
  }
});
