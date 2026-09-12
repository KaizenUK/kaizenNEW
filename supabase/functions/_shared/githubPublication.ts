import {
  projectCapabilities,
  validProjectId,
} from "../../../shared/builderProjects.ts";

export class PublicationAccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The GitHub worker uses the single preserved workspace. Never route a client to it. */
export async function requireGithubPublication(
  service: any,
  projectId: unknown,
  actor: string,
) {
  if (typeof projectId !== "string" || !validProjectId(projectId))
    throw new PublicationAccessError(
      400,
      "Choose a valid project before publishing.",
    );
  const { data: member, error: memberError } = await service
    .from("builder_project_members")
    .select("can_publish")
    .eq("project_id", projectId)
    .eq("user_id", actor)
    .maybeSingle();
  if (memberError || !member?.can_publish)
    throw new PublicationAccessError(
      403,
      "Project publish permission required.",
    );
  const { data: project, error } = await service
    .from("builder_projects")
    .select("id,archived,capabilities")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !project || project.archived)
    throw new PublicationAccessError(
      403,
      "Restore the project and check your access before publishing.",
    );
  let capabilities;
  try {
    capabilities = projectCapabilities(project.capabilities);
  } catch {
    throw new PublicationAccessError(
      409,
      "Check this project's publication settings before publishing.",
    );
  }
  if (capabilities.publishPath !== "github" || !capabilities.legacyWorkspace)
    throw new PublicationAccessError(
      409,
      "Use this project's configured destination in Releases.",
    );
  return project;
}
