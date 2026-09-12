import React, { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CopyPlus,
  FolderOpen,
  Plus,
} from "lucide-react";
import type { BuilderProject } from "../../shared/builderProjects";
import ProjectMembers from "./ProjectMembers";
import {
  activeProjectId,
  listProjects,
  projectRequest,
} from "./projectStorage";
import { Head, Notice, Pill } from "./shell";

export { ProjectIdentity } from "./activeProject";

/* The project dashboard: one card per client website. */

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
  const visible = projects.filter((p) => archived || !p.archived);
  return (
    <>
      <Head
        info="Kaizen Builder"
        title="Projects"
        description="Each project is one client website, with its own pages, assets, styles and history. Open a project to work on it."
      />
      <div className="builder-page-body">
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
        <div className="builder-toolbar">
          <label className="builder-project-filter">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            Show archived projects
          </label>
          {busy && (
            <span role="status" className="builder-hint">
              {projects.length ? "Working…" : "Loading projects…"}
            </span>
          )}
        </div>
        {error && (
          <Notice
            tone="error"
            action={
              <button type="button" onClick={() => void refresh()}>
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        )}
        <div className="builder-project-grid">
          {visible.map((project) => (
            <ProjectCard
              key={`${project.id}-${project.version}`}
              project={project}
              busy={busy}
              mutate={mutate}
            />
          ))}
        </div>
        {!busy && !projects.length && !error && (
          <Notice>Create your first project to start building.</Notice>
        )}
        <p className="builder-hint builder-hint-block">
          The original Kaizen workspace stays registered in place and keeps its
          files. A duplicate copies pages, publications, assets and history, and
          starts with no service connections, publishing destination or private
          preview links.
        </p>
      </div>
    </>
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
  const current = project.id === activeProjectId;
  return (
    <article
      className="builder-card builder-project-card"
      aria-label={project.name}
    >
      <div className="builder-project-card-head">
        <span className="builder-project-icon" aria-hidden="true">
          <FolderOpen size={22} />
        </span>
        <div className="builder-project-card-title">
          <h2>{project.name}</h2>
          <p>{project.destination.label}</p>
        </div>
        <div className="builder-project-card-pills">
          {current && <Pill tone="primary">Current project</Pill>}
          {project.archived && <Pill tone="orange">Archived</Pill>}
        </div>
      </div>
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
          type="button"
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
          type="button"
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
          {project.archived ? (
            <>
              <ArchiveRestore size={16} />
              Restore project
            </>
          ) : (
            <>
              <Archive size={16} />
              Archive
            </>
          )}
        </button>
      </div>
      {owner && (
        <form
          className="builder-project-rename"
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
      {project.access?.role === "owner" && <ProjectMembers id={project.id} />}
    </article>
  );
}
