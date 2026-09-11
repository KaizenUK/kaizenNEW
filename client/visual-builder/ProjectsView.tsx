import React, { useEffect, useState } from "react";
import { CopyPlus, FolderOpen, Archive, Plus } from "lucide-react";
import type { BuilderProject } from "../../shared/builderProjects";
import ProjectMembers from "./ProjectMembers";
import {
  activeProjectId,
  listProjects,
  projectRequest,
} from "./projectStorage";

export function ProjectIdentity() {
  const [project, setProject] = useState<BuilderProject>();
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      void listProjects()
        .then((items) => {
          if (mounted) {
            setProject(items.find((p) => p.id === activeProjectId));
            setError("");
          }
        })
        .catch((error) => {
          if (mounted) {
            setProject(undefined);
            setError(error.message);
          }
        });
    refresh();
    window.addEventListener("builder-projects-changed", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("builder-projects-changed", refresh);
    };
  }, []);
  return (
    <div className="builder-project-identity">
      <strong>
        {project?.name || (error ? "Project unavailable" : "Loading project…")}
      </strong>
      <small>
        {project?.destination.label || error || "Checking destination…"}
      </small>
      {project?.archived && (
        <small>Archived — restore in Projects to edit</small>
      )}
      {project?.access && (
        <small>
          {project.access.role} ·{" "}
          {project.access.canPublish ? "May publish" : "Cannot publish"}
        </small>
      )}
    </div>
  );
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [archived, setArchived] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setProjects(await listProjects());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function mutate(input: unknown) {
    setBusy(true);
    setError("");
    try {
      await projectRequest(input);
      setProjects(await listProjects());
      setName("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="builder-panel-body">
      <div className="builder-section-heading">
        <div>
          <h1>Client projects</h1>
          <p>
            Each project owns its pages, assets, styles and history. Opening a
            project starts a separate editing session.
          </p>
        </div>
      </div>
      <form
        className="builder-card builder-project-create"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate({ action: "create", name });
        }}
      >
        <label>
          Project name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Client or website name"
          />
        </label>
        <button className="builder-primary" disabled={busy || !name.trim()}>
          <Plus size={18} />
          Create project
        </button>
      </form>
      <label className="builder-project-filter">
        <input
          type="checkbox"
          checked={archived}
          onChange={(event) => setArchived(event.target.checked)}
        />
        Show archived projects
      </label>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {busy && <p role="status">Loading projects…</p>}
      <div className="builder-project-grid">
        {projects
          .filter((p) => archived || !p.archived)
          .map((project) => (
            <ProjectCard
              key={`${project.id}-${project.version}`}
              project={project}
              busy={busy}
              mutate={mutate}
            />
          ))}
      </div>
      {!busy && !projects.length && !error && (
        <p>Create your first client project to start building.</p>
      )}
      <p>
        The original Kaizen workspace is registered in place, preserving its
        files. A duplicate keeps pages, publications, assets and history, and
        starts without service connections, a deployment destination or private
        preview links.
      </p>
    </div>
  );
}
function ProjectCard({
  project,
  busy,
  mutate,
}: {
  project: BuilderProject;
  busy: boolean;
  mutate: (input: unknown) => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const owner = !project.access || project.access.role === "owner";
  return (
    <article
      className="builder-card builder-project-card"
      aria-label={project.name}
    >
      <FolderOpen size={28} />
      <h2>{project.name}</h2>
      <p>{project.destination.label}</p>
      {project.id === activeProjectId && <strong>Active project</strong>}
      {project.archived && <p>Archived</p>}
      {owner && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mutate({
              action: "rename",
              id: project.id,
              version: project.version,
              name,
            });
          }}
        >
          <label>
            Project name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button disabled={busy || name === project.name}>Rename</button>
        </form>
      )}
      <div className="builder-project-actions">
        {!project.archived && (
          <a
            className="builder-primary"
            href={`/builder/?project=${encodeURIComponent(project.id)}`}
          >
            Open project
          </a>
        )}
        <button
          disabled={busy}
          onClick={() =>
            void mutate({
              action: "duplicate",
              id: project.id,
              name: `${project.name.slice(0, 94)} copy`,
            })
          }
        >
          <CopyPlus size={16} />
          Duplicate
        </button>
        <button
          disabled={busy || !owner}
          onClick={() =>
            void mutate({
              action: "archive",
              id: project.id,
              version: project.version,
              archived: !project.archived,
            })
          }
        >
          <Archive size={16} />
          {project.archived ? "Restore project" : "Archive"}
        </button>
      </div>
      {project.access?.role === "owner" && <ProjectMembers id={project.id} />}
    </article>
  );
}
