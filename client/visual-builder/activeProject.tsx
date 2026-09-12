import React, { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { BuilderProject } from "../../shared/builderProjects";
import { activeProjectId, listProjects } from "./projectStorage";

/* One shared read of the project list, so every screen can say which project it belongs to. */

let cache: Promise<BuilderProject[]> | undefined;
function projects(): Promise<BuilderProject[]> {
  if (!cache)
    cache = listProjects().catch((error) => {
      cache = undefined;
      throw error;
    });
  return cache;
}
if (typeof window !== "undefined")
  window.addEventListener("builder-projects-changed", () => {
    cache = undefined;
  });

export function useActiveProject(): {
  project?: BuilderProject;
  error: string;
  loading: boolean;
} {
  const [state, setState] = useState<{
    project?: BuilderProject;
    error: string;
    loading: boolean;
  }>({ error: "", loading: true });
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      void projects()
        .then((items) => {
          if (mounted)
            setState({
              project: items.find((p) => p.id === activeProjectId),
              error: "",
              loading: false,
            });
        })
        .catch((error) => {
          if (mounted)
            setState({
              project: undefined,
              error: (error as Error).message,
              loading: false,
            });
        });
    refresh();
    window.addEventListener("builder-projects-changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("builder-projects-changed", refresh);
    };
  }, []);
  return state;
}

/** The current project's name, for page heads. */
export function ProjectName({
  fallback = "Kaizen Builder",
}: {
  fallback?: string;
}) {
  const { project, loading } = useActiveProject();
  return <>{project?.name || (loading ? "…" : fallback)}</>;
}

export function ProjectIdentity({
  variant = "sidebar",
  current = false,
  onSwitch,
}: {
  variant?: "sidebar" | "header";
  current?: boolean;
  onSwitch?: () => void;
}) {
  const { project, error, loading } = useActiveProject();
  const name =
    project?.name || (loading ? "Loading project…" : "Project unavailable");
  if (variant === "header")
    return (
      <span
        className="builder-project-chip"
        title={
          project
            ? `${project.name} · ${project.destination.label}`
            : error || undefined
        }
      >
        {name}
      </span>
    );
  return (
    <div className="builder-project-identity" title={error || undefined}>
      <small className="builder-project-eyebrow">Project</small>
      <strong>{name}</strong>
      {project ? (
        <small>{project.destination.label}</small>
      ) : error ? (
        <small>Project details could not be loaded. Reload to try again.</small>
      ) : null}
      {project?.archived && (
        <small className="builder-project-warning">
          Archived · restore it from All projects to edit
        </small>
      )}
      {project?.access && (
        <small>
          {project.access.role === "owner" ? "Owner" : "Editor"} ·{" "}
          {project.access.canPublish ? "can publish" : "cannot publish"}
        </small>
      )}
      {onSwitch && (
        <button
          type="button"
          className="builder-project-switch"
          aria-current={current ? "page" : undefined}
          onClick={onSwitch}
        >
          <ArrowLeftRight size={14} aria-hidden="true" /> All projects
        </button>
      )}
    </div>
  );
}
