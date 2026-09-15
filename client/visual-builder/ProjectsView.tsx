import React, { useEffect, useRef, useState } from "react";
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
  const mounted = useRef(true);
  const activeMutations = useRef(0);
  const stoppedCopies = useRef(new Set<string>());
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
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!projects.some((project) => project.copy?.cancelling)) return;
    const timer = setInterval(() => {
      if (document.hidden || activeMutations.current) return;
      void listProjects()
        .then((next) => {
          if (mounted.current && !activeMutations.current) setProjects(next);
        })
        .catch(() => {
          /* Keep the last confirmed cleanup state. */
        });
    }, 10000);
    return () => clearInterval(timer);
  }, [projects]);
  async function mutate(input: unknown) {
    const request = input as { action?: string; id?: string };
    let currentCopyId =
      request.action === "duplicate-resume" ? request.id : undefined;
    if (request.action === "duplicate-cancel" && request.id)
      stoppedCopies.current.add(request.id);
    if (request.action === "duplicate-resume" && request.id)
      stoppedCopies.current.delete(request.id);
    activeMutations.current++;
    setBusy(true);
    setError("");
    try {
      let next: any = input;
      for (;;) {
        const result = (await projectRequest(next)) as BuilderProject;
        if (!mounted.current) return false;
        if (
          ["duplicate", "duplicate-resume"].includes(next?.action) &&
          result?.id
        )
          currentCopyId = result.id;
        if (
          !["duplicate", "duplicate-resume"].includes(next?.action) ||
          !result?.copy?.pending ||
          result.copy.cancelling ||
          stoppedCopies.current.has(result.id)
        )
          break;
        setProjects((current) => [
          ...current.filter((project) => project.id !== result.id),
          result,
        ]);
        next = { action: "duplicate-resume", id: result.id };
      }
      setProjects(await listProjects());
      setName("");
      return true;
    } catch (error) {
      const stopped =
        !!currentCopyId && stoppedCopies.current.has(currentCopyId);
      if (!stopped) setError((error as Error).message);
      // A lost response can still have created the durable copy. Show it so
      // that resuming never requires another project or an open old tab.
      try {
        setProjects(await listProjects());
      } catch {
        /* Keep the original failure. */
      }
      return stopped;
    } finally {
      activeMutations.current--;
      setBusy(activeMutations.current > 0);
    }
  }
  const visible = projects.filter(
    (p) => archived || !p.archived || p.copy?.cancelling,
  );
  return (
    <>
      <Head info="Kaizen Builder" title="Projects" help="projects" />
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
  mutate: (input: unknown) => Promise<boolean>;
}) {
  const [name, setName] = useState(project.name);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const copyRequest = useRef<{ id: string; name: string } | null>(null);
  const owner = !project.access || project.access.role === "owner";
  const current = project.id === activeProjectId;
  useEffect(() => {
    if (confirmCancel) confirmation.current?.focus();
  }, [confirmCancel]);
  useEffect(() => {
    if (!project.copy?.pending || project.copy.cancelling)
      setConfirmCancel(false);
  }, [project.copy?.pending, project.copy?.cancelling]);
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
          {project.archived && !project.copy?.cancelling && (
            <Pill tone="orange">Archived</Pill>
          )}
          {project.copy?.pending && (
            <Pill tone="orange">
              {project.copy.cancelling ? "Copy cancelled" : "Copy unfinished"}
            </Pill>
          )}
        </div>
      </div>
      {!project.copy?.cancelling && (
        <div className="builder-project-actions">
          {!project.archived && !project.copy?.pending && (
            <a
              className="builder-primary"
              href={`/builder/?project=${encodeURIComponent(project.id)}`}
            >
              Open project
            </a>
          )}
          {project.copy?.pending && !project.copy.cancelling && (
            <button
              type="button"
              className="builder-primary"
              disabled={busy || project.archived || !project.copy.canResume}
              onClick={() =>
                void mutate({ action: "duplicate-resume", id: project.id })
              }
            >
              Resume copy
            </button>
          )}
          {project.copy?.pending && !project.copy.cancelling && owner && (
            <button
              ref={cancelButton}
              type="button"
              disabled={cancelPending}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel copy
            </button>
          )}
          <button
            type="button"
            disabled={busy || project.copy?.pending}
            onClick={async () => {
              copyRequest.current ??= {
                id: crypto.randomUUID(),
                name: `${project.name.slice(0, 94)} copy`,
              };
              const done = await mutate({
                action: "duplicate",
                id: project.id,
                requestId: copyRequest.current.id,
                name: copyRequest.current.name,
              });
              if (done) copyRequest.current = null;
            }}
          >
            <CopyPlus size={16} />
            Duplicate
          </button>
          <button
            type="button"
            disabled={busy || !owner || project.copy?.cancelling}
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
      )}
      {confirmCancel && (
        <div
          ref={confirmation}
          tabIndex={-1}
          role="group"
          aria-label={`Cancel copy of ${project.name}`}
          className="builder-account-confirm"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !cancelPending) {
              event.preventDefault();
              setConfirmCancel(false);
              cancelButton.current?.focus();
            }
          }}
        >
          <p>
            Cancel <strong>{project.name}</strong>? Files created for this
            unfinished copy will be removed. The original website will be kept.
          </p>
          <div className="builder-project-actions">
            <button
              type="button"
              disabled={cancelPending}
              onClick={async () => {
                setCancelPending(true);
                const done = await mutate({
                  action: "duplicate-cancel",
                  id: project.id,
                  version: project.version,
                  confirm: true,
                });
                setCancelPending(false);
                if (done) setConfirmCancel(false);
              }}
            >
              Confirm cancellation
            </button>
            <button
              type="button"
              disabled={cancelPending}
              onClick={() => {
                setConfirmCancel(false);
                cancelButton.current?.focus();
              }}
            >
              Keep copying
            </button>
          </div>
        </div>
      )}
      {project.copy?.cancelling ? (
        <p className="builder-hint" role="status">
          Copy cancelled. Its files are being removed. Storage remains in use
          until cleanup finishes.
        </p>
      ) : (
        project.copy?.pending && (
          <p className="builder-hint" role="status">
            {project.copy.copied} of {project.copy.files} files copied. You can
            resume if you leave this page.
            {!project.copy.canResume &&
              " The account that started this copy must resume it."}
          </p>
        )
      )}
      {owner && !project.copy?.cancelling && (
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
      {project.access?.role === "owner" && !project.copy?.cancelling && (
        <ProjectMembers id={project.id} />
      )}
    </article>
  );
}
