import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Search } from "lucide-react";
import { storage } from "./storage";
import type {
  SourceField,
  SourceInspection,
} from "../../shared/builderSourceEditing";
import type { RepositoryPlan } from "../../scripts/builder-repository";
import { useSourceEditingDraft } from "./useSourceEditingDraft";
import { useSourceSelection } from "./useSourceSelection";
import { builderStatuses } from "./builderStatus";
import { Notice, Pill } from "./shell";

/* The page's words shown as a content outline: read it like a page, click a line to change it. */

const OPEN_ALL_UP_TO = 6;
function kindLabel(field: SourceField): string {
  if (field.kind === "link") return "Link";
  if (field.kind === "image") return "Image";
  if (/^h[1-6]$|^(title|heading|headline)$/i.test(field.label))
    return "Heading";
  if (/^alt$/i.test(field.label)) return "Image description";
  if (/^(button|cta|label)$/i.test(field.label)) return "Button";
  return "Text";
}
const fileName = (file: string) => file.split("/").pop() || file;

export default function SourcePageEditor({
  root,
  route,
  onPlan,
  onDirty,
  onClose,
}: {
  root: string;
  route: string;
  onPlan: (plan: RepositoryPlan) => void;
  onDirty: () => void;
  onClose: () => void;
}) {
  const [inspection, setInspection] = useState<SourceInspection>();
  const mounted = useRef(false);
  const draft = useSourceEditingDraft(inspection);
  const selection = useSourceSelection(inspection);
  const { values, setValues, orders, setOrders } = draft;
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    mounted.current = true;
    setInspection(undefined);
    setBusy(true);
    setError("");
    storage
      .repository({ action: "repository-source-inspect", root, route })
      .then((model) => {
        if (current) setInspection(model);
      })
      .catch((error) => {
        if (current) setError(error.message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [root, route]);
  const changed = Object.keys(values).length + Object.keys(orders).length;
  const locked = busy || !draft.ready || Boolean(draft.stale);
  const needle = query.trim().toLowerCase();
  const visible = (inspection?.fields || []).filter(
    (field) =>
      (selection.ids === undefined || selection.ids.includes(field.id)) &&
      (!needle ||
        `${field.value} ${field.label} ${field.file}`
          .toLowerCase()
          .includes(needle)),
  );
  // A search or a pick from the preview leaves few matches, so open them straight away.
  const openAll =
    selection.ids !== undefined ||
    (needle !== "" && visible.length <= OPEN_ALL_UP_TO);
  const toggle = (id: string, open: boolean) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <section
      className="builder-card builder-project-card builder-source-editor"
      aria-label="Existing page content editor"
    >
      <div className="builder-row builder-block-head builder-block-head-row">
        <h2>Edit this page's text and links</h2>
        <button
          type="button"
          onClick={() => {
            if (!inspection || draft.stale || (!draft.ready && !changed)) {
              onClose();
              return;
            }
            void draft
              .flush()
              .then(onClose)
              .catch((e) => setError(e.message));
          }}
        >
          Close editor
        </button>
      </div>
      <p className="builder-hint">
        <code>{route}</code> · Click a line to change it. The design and code
        stay exactly as they are. When you are done, review your changes and
        apply them to the folder.
      </p>
      <div className="builder-row builder-source-status-row">
        {draft.status && (
          <p
            role="status"
            aria-label="Source editing draft"
            className="builder-source-status"
          >
            {draft.ready && (
              <Pill
                tone={
                  draft.saved && !draft.stale && !draft.error
                    ? builderStatuses.saved.tone
                    : builderStatuses.draft.tone
                }
              >
                {draft.saved && !draft.stale && !draft.error
                  ? builderStatuses.saved.label
                  : builderStatuses.draft.label}
              </Pill>
            )}
            <span>{draft.status}</span>
          </p>
        )}
        {(changed > 0 || draft.stale) && (
          <button
            type="button"
            className="builder-text-button"
            onClick={draft.download}
          >
            Download my unapplied edits
          </button>
        )}
      </div>
      {draft.error && (
        <Notice
          tone="error"
          action={
            <span className="builder-row">
              <button
                type="button"
                onClick={() => void draft.retry().catch(() => {})}
              >
                {draft.ready ? "Retry saving edits" : "Retry loading edits"}
              </button>
              <button type="button" onClick={draft.reload}>
                Discard my changes and reload
              </button>
            </span>
          }
        >
          {draft.error}
        </Notice>
      )}
      {draft.stale && (
        <div role="alert" className="builder-notice builder-notice-error">
          <div className="builder-source-stale">
            <p>
              You made these edits before the website's files changed. Copy
              anything you need from below, or download them, then discard them.
              Reviewing again uses the current files.
            </p>
            <details>
              <summary>Recover saved changes</summary>
              {Object.entries(draft.stale.values).map(([id, value]) => {
                const field = draft.stale!.inspection.fields.find(
                  (f) => f.id === id,
                );
                return (
                  <div key={id}>
                    <p>
                      {field?.file} · {field?.label}
                    </p>
                    <pre>{value}</pre>
                  </div>
                );
              })}
              <pre>{JSON.stringify(draft.stale.orders, null, 2)}</pre>
            </details>
            <button
              type="button"
              onClick={() =>
                void draft.discardStale().catch((e) => setError(e.message))
              }
            >
              Discard saved edits
            </button>
          </div>
        </div>
      )}
      {inspection && (
        <>
          <div className="builder-source-toolbar">
            <label className="builder-search-field builder-source-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                aria-label="Find page content"
                value={query}
                onChange={(e) => {
                  if (selection.ids !== undefined) selection.clear();
                  setQuery(e.target.value);
                }}
                placeholder="Find text, links or component names"
              />
            </label>
            <button
              type="button"
              disabled={locked}
              title="Opens the last preview build so you can click the text you want to change. Build a preview first."
              onClick={() => {
                setQuery("");
                void selection.open();
              }}
            >
              Pick text from the preview
            </button>
            {selection.ids !== undefined && (
              <button type="button" onClick={selection.clear}>
                Show all fields
              </button>
            )}
          </div>
          {selection.status && (
            <p
              role="status"
              aria-label="Rendered source selection"
              className="builder-hint"
            >
              {selection.status}
            </p>
          )}
          {selection.error && <Notice tone="error">{selection.error}</Notice>}
          <p className="builder-hint">
            {visible.length === inspection.fields.length
              ? `${inspection.fields.length} editable pieces of text across ${inspection.files.length} files.`
              : `${visible.length} of ${inspection.fields.length} editable pieces of text shown.`}
            {!openAll && " Click one to change it."}
          </p>
          <div className="builder-source-fields">
            {inspection.files.map(({ file }) => {
              const fields = visible.filter((field) => field.file === file);
              if (!fields.length) return null;
              const shared = file !== route;
              const edited = fields.filter(
                (f) => values[f.id] !== undefined,
              ).length;
              return (
                <details
                  key={file}
                  className="builder-source-file"
                  open={openAll || !shared || edited > 0}
                >
                  <summary className="builder-source-file-head">
                    <strong>{fileName(file)}</strong>
                    <small>
                      {fields.length} {fields.length === 1 ? "piece" : "pieces"}
                      {edited ? ` · ${edited} edited` : ""}
                    </small>
                    {shared && (
                      <Pill
                        tone="blue"
                        title="Changing this updates every page that uses it."
                      >
                        Shared with other pages
                      </Pill>
                    )}
                  </summary>
                  <ul className="builder-source-list">
                    {fields.map((field) => {
                      const current = values[field.id] ?? field.value;
                      const isChanged = values[field.id] !== undefined;
                      const open = openAll || openIds.has(field.id);
                      const kind = kindLabel(field);
                      return (
                        <li
                          key={field.id}
                          className={`builder-source-row${isChanged ? " is-changed" : ""}${open ? " is-open" : ""}`}
                        >
                          {open ? (
                            <div className="builder-source-row-editor">
                              <div className="builder-source-row-meta">
                                <span className="builder-source-kind">
                                  {kind}
                                </span>
                                <small>
                                  {field.label} · line {field.line}
                                </small>
                                {isChanged && <Pill tone="orange">Edited</Pill>}
                              </div>
                              <textarea
                                rows={Math.min(
                                  8,
                                  Math.max(
                                    field.kind === "text" ? 2 : 1,
                                    Math.ceil(current.length / 90),
                                  ),
                                )}
                                disabled={locked}
                                aria-label={`${file} ${field.label} line ${field.line}`}
                                value={current}
                                maxLength={20000}
                                onChange={(event) => {
                                  onDirty();
                                  setValues((current) => {
                                    const next = { ...current };
                                    if (event.target.value === field.value)
                                      delete next[field.id];
                                    else next[field.id] = event.target.value;
                                    return next;
                                  });
                                }}
                              />
                              <div className="builder-row">
                                {isChanged && (
                                  <button
                                    type="button"
                                    className="builder-text-button"
                                    disabled={locked}
                                    onClick={() => {
                                      onDirty();
                                      setValues((current) => {
                                        const next = { ...current };
                                        delete next[field.id];
                                        return next;
                                      });
                                    }}
                                  >
                                    Undo this change
                                  </button>
                                )}
                                {!openAll && (
                                  <button
                                    type="button"
                                    className="builder-text-button"
                                    onClick={() => toggle(field.id, false)}
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="builder-source-row-head"
                              aria-label={`Edit ${kind.toLowerCase()}: ${current.slice(0, 80)}`}
                              onClick={() => toggle(field.id, true)}
                            >
                              <span className="builder-source-kind">
                                {kind}
                              </span>
                              <span className="builder-source-preview">
                                {current || (
                                  <em className="builder-hint">(empty)</em>
                                )}
                              </span>
                              {isChanged && <Pill tone="orange">Edited</Pill>}
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
            {!visible.length && (
              <p className="builder-empty">No text matches your search.</p>
            )}
          </div>
          {inspection.groups.length > 0 && (
            <details className="builder-source-extra">
              <summary>Reorder sections</summary>
              <p className="builder-hint">
                Move a section up or down within its group. Save one group
                before rearranging another.
              </p>
              {inspection.groups.map((group) => (
                <details key={group.id} className="builder-source-group">
                  <summary>
                    {fileName(group.file)} · {group.label}
                  </summary>
                  <ul className="builder-source-list">
                    {(orders[group.id] || group.items.map((i) => i.id)).map(
                      (id, index, array) => {
                        const item = group.items.find((i) => i.id === id)!;
                        const move = (by: number) => {
                          onDirty();
                          setOrders((current) => {
                            const order = [...array];
                            [order[index], order[index + by]] = [
                              order[index + by],
                              order[index],
                            ];
                            const next = { ...current };
                            if (
                              order.every((id, i) => id === group.items[i].id)
                            )
                              delete next[group.id];
                            else next[group.id] = order;
                            return next;
                          });
                        };
                        return (
                          <li key={id} className="builder-source-section">
                            <span>{item.label}</span>
                            <button
                              type="button"
                              className="builder-icon-button builder-icon-button-square"
                              disabled={!index || locked}
                              aria-label={`Move ${item.label} up`}
                              onClick={() => move(-1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="builder-icon-button builder-icon-button-square"
                              disabled={index === array.length - 1 || locked}
                              aria-label={`Move ${item.label} down`}
                              onClick={() => move(1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </li>
                        );
                      },
                    )}
                  </ul>
                </details>
              ))}
            </details>
          )}
          {inspection.boundaries.length > 0 && (
            <details className="builder-source-extra">
              <summary>Text you can't change here, and why</summary>
              {inspection.boundaries.map((message, i) => (
                <p key={i} className="builder-hint">
                  {message}
                </p>
              ))}
            </details>
          )}
          <div className="builder-row builder-actions">
            <button
              type="button"
              className="builder-primary"
              disabled={locked || !changed}
              onClick={() => {
                setBusy(true);
                setError("");
                draft
                  .flush()
                  .then(() =>
                    storage.repository({
                      action: "repository-source-prepare",
                      edits: { inspection, values, orders },
                      draftVersion: draft.version.current,
                    }),
                  )
                  .then((plan) => {
                    if (mounted.current) onPlan(plan);
                  })
                  .catch((error) => {
                    if (mounted.current) setError(error.message);
                  })
                  .finally(() => {
                    if (mounted.current) setBusy(false);
                  });
              }}
            >
              Review my changes
            </button>
            {changed > 0 && (
              <span className="builder-hint">
                {changed} {changed === 1 ? "change" : "changes"} waiting to be
                reviewed.
              </span>
            )}
          </div>
        </>
      )}
      {busy && (
        <p role="status" className="builder-hint">
          {inspection ? "Preparing your changes…" : "Reading the page…"}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
