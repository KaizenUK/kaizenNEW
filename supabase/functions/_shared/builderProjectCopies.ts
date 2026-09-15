import type { Workspace, Asset } from "../../../shared/visualBuilder.ts";
import {
  projectCapabilities,
  projectName,
  validProjectId,
} from "../../../shared/builderProjects.ts";
import { disconnectedSettings } from "../../../shared/builderSettings.ts";
import {
  assertProjectAssetReferences,
  projectAssetUrl,
} from "../../../shared/builderProjectOperations.ts";
import {
  copyFileThroughUploadService,
  copyUploadOrigin,
} from "./builderCopyUploads.ts";

const check = ({ data, error }: any) => {
  if (error) throw new Error(error.message);
  return data;
};
function checkedAssets(workspace: Workspace) {
  if (
    !workspace ||
    !Array.isArray(workspace.assets) ||
    new Set(workspace.assets.map((asset) => asset.id)).size !==
      workspace.assets.length
  )
    throw new Error("The source website has invalid file metadata.");
  for (const asset of workspace.assets) {
    if (
      !validProjectId(asset.id) ||
      asset.id === "kaizen" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > 50 * 1024 ** 2 ||
      !/^[a-f0-9]{64}$/.test(asset.hash) ||
      typeof asset.mime !== "string" ||
      !asset.mime ||
      asset.mime.length > 255 ||
      /[\x00-\x1f\x7f]/.test(asset.mime) ||
      !["image", "icon", "font", "licence", "code", "design", "other"].includes(
        asset.kind,
      )
    )
      throw new Error("The source website has invalid file metadata.");
  }
  return workspace.assets;
}
function copyWorkspace(source: Workspace, target: string): Workspace {
  const replacements = new Map(
    checkedAssets(source).map((asset) => [
      asset.url,
      projectAssetUrl(target, asset.id),
    ]),
  );
  const rewrite = (value: any): any =>
    typeof value === "string"
      ? replacements.get(value) || value
      : Array.isArray(value)
        ? value.map(rewrite)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, item]) => [key, rewrite(item)]),
            )
          : value;
  const workspace = rewrite(source);
  if (workspace.settings)
    workspace.settings = disconnectedSettings(workspace.settings);
  assertProjectAssetReferences(workspace, target);
  return workspace;
}

/** Each invocation transfers at most three files; retries reuse the same frozen copy. */
export async function runProjectCopy(options: {
  service: any;
  user: any;
  actor: string;
  token: string;
  origin: string | undefined;
  project: any;
  input: any;
}) {
  const { service, user, actor, token, project, input } = options;
  const origin = copyUploadOrigin(options.origin);
  let copy: any;
  if (input.action === "duplicate-resume") {
    copy = check(
      await service.rpc("builder_project_copy_resume", {
        target: project.id,
        actor,
      }),
    );
  } else {
    const id = input.requestId || crypto.randomUUID();
    if (!validProjectId(id) || id === "kaizen")
      throw new Error("Invalid website copy request.");
    const source: Workspace = projectCapabilities(project.capabilities)
      .legacyWorkspace
      ? check(await user.rpc("builder_backup_workspace"))
      : check(
          await user
            .from("builder_project_workspaces")
            .select("payload")
            .eq("project_id", project.id)
            .single(),
        ).payload;
    const workspace = copyWorkspace(source, id);
    copy = check(
      await service.rpc("builder_project_copy_begin", {
        source: project.id,
        actor,
        request_id: id,
        project_name: projectName(input.name),
        workspace,
      }),
    );
  }
  if (
    !copy ||
    copy.actor_id !== actor ||
    !validProjectId(copy.project_id) ||
    copy.project_id === "kaizen" ||
    !validProjectId(copy.source_project_id) ||
    typeof copy.source_legacy !== "boolean" ||
    !["pending", "complete"].includes(copy.status) ||
    !Array.isArray(copy.storedAssets)
  )
    throw new Error("The website copy needs its saved state checked.");
  if (copy.status === "complete") return copy.project_id;
  const remaining: Asset[] = checkedAssets(copy.workspace).filter(
    (asset) => !copy.storedAssets.includes(asset.id),
  );
  for (const asset of remaining.slice(0, 3)) {
    const sourceBucket = copy.source_legacy
      ? ["image", "icon", "font"].includes(asset.kind)
        ? "builder-media"
        : "builder-source"
      : "builder-project-files";
    // Uses the current caller's JWT/RLS for source reads, even when resuming.
    const file: Blob = check(
      await user.storage
        .from(sourceBucket)
        .download(
          copy.source_legacy
            ? asset.id
            : `${copy.source_project_id}/${asset.id}`,
        ),
    );
    if (file.size !== asset.size)
      throw new Error(
        "A source file changed. The copy has been kept for review.",
      );
    await copyFileThroughUploadService({
      origin,
      token,
      projectId: copy.project_id,
      asset,
      bytes: await file.arrayBuffer(),
    });
  }
  if (remaining.length <= 3)
    check(
      await service.rpc("builder_project_copy_finish", {
        target: copy.project_id,
        actor,
      }),
    );
  return copy.project_id;
}
