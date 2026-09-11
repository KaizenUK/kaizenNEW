import React, { useEffect, useRef, useState } from "react";
import { storage } from "./storage";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import type { RepositoryPlan } from "../../scripts/builder-repository";
import { useSourceEditingDraft } from "./useSourceEditingDraft";
import { useSourceSelection } from "./useSourceSelection";

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
  return (
    <section
      className="builder-card builder-project-card builder-source-editor"
      aria-label="Existing page content editor"
    >
      <div className="builder-row">
        <h2>Edit existing page</h2>
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
          Close source editor
        </button>
      </div>
      <p>{route}</p>
      <p>
        Edit the page's original content and section order. Its components,
        styling and interactive code stay in the repository. Review the proposed
        files, apply them, then build and preview before publishing.
      </p>
      {draft.status && (
        <p role="status" aria-label="Source editing draft">
          {draft.status}
        </p>
      )}
      {draft.error && (
        <div role="alert">
          <p>{draft.error}</p>
          <button onClick={() => void draft.retry().catch(() => {})}>
            {draft.ready ? "Retry saving edits" : "Retry loading edits"}
          </button>
          <button onClick={draft.reload}>
            Discard this window's changes and reload
          </button>
        </div>
      )}
      {(changed > 0 || draft.stale) && (
        <button onClick={draft.download}>
          Download unapplied source edits
        </button>
      )}
      {draft.stale && (
        <div role="alert">
          <p>
            These edits were saved against older source files. Recover the
            values below or download them before discarding this editing draft.
            A new file proposal requires the current source.
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
            onClick={() =>
              void draft.discardStale().catch((e) => setError(e.message))
            }
          >
            Discard saved editing draft
          </button>
        </div>
      )}
      {inspection && (
        <>
          <p>
            {inspection.fields.length} content fields across{" "}
            {inspection.files.length} source files.
          </p>
          <details>
            <summary>Shared content and dynamic data</summary>
            {inspection.boundaries.map((message, i) => (
              <p key={i}>{message}</p>
            ))}
          </details>
          <button
            disabled={busy || !draft.ready || Boolean(draft.stale)}
            onClick={() => {
              setQuery("");
              void selection.open();
            }}
          >
            Select content in built page
          </button>
          <p>
            Build this repository first using Build &amp; local preview below.
            The selector shows the last built source; apply edits and rebuild to
            update it.
          </p>
          {selection.status && (
            <p role="status" aria-label="Rendered source selection">
              {selection.status}
            </p>
          )}
          {selection.error && <p role="alert">{selection.error}</p>}
          {selection.ids !== undefined && (
            <button onClick={selection.clear}>Show all source fields</button>
          )}
          <label>
            Find page content
            <input
              type="search"
              value={query}
              onChange={(e) => {
                if (selection.ids !== undefined) selection.clear();
                setQuery(e.target.value);
              }}
              placeholder="Search text, links or component names"
            />
          </label>
          <div className="builder-source-fields">
            {inspection.files.map(({ file }) => {
              const fields = inspection.fields.filter(
                (field) =>
                  field.file === file &&
                  (selection.ids === undefined ||
                    selection.ids.includes(field.id)) &&
                  `${field.value} ${field.label} ${field.file}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              );
              if (!fields.length) return null;
              return (
                <details
                  key={file}
                  open={
                    selection.ids !== undefined ||
                    Boolean(query) ||
                    file === route
                  }
                >
                  <summary>
                    {file.split("/").pop()} · {fields.length} fields
                  </summary>
                  {file !== route && (
                    <p className="builder-hint">
                      Shared source: this affects every page using this
                      component.
                    </p>
                  )}
                  {fields.map((field) => (
                    <label key={field.id}>
                      {field.label} · line {field.line}
                      <textarea
                        rows={field.kind === "text" ? 2 : 1}
                        disabled={busy || !draft.ready || Boolean(draft.stale)}
                        aria-label={`${file} ${field.label} line ${field.line}`}
                        value={values[field.id] ?? field.value}
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
                    </label>
                  ))}
                </details>
              );
            })}
          </div>
          <details>
            <summary>Arrange original sections</summary>
            <p>
              Move sections within their existing container. Save one nested
              level before rearranging another.
            </p>
            {inspection.groups.map((group) => (
              <details key={group.id}>
                <summary>
                  {group.file.split("/").pop()} · {group.label}
                </summary>
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
                        if (order.every((id, i) => id === group.items[i].id))
                          delete next[group.id];
                        else next[group.id] = order;
                        return next;
                      });
                    };
                    return (
                      <div key={id} className="builder-source-section">
                        <span>{item.label}</span>
                        <button
                          type="button"
                          disabled={
                            !index ||
                            busy ||
                            !draft.ready ||
                            Boolean(draft.stale)
                          }
                          aria-label={`Move ${item.label} up`}
                          onClick={() => move(-1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={
                            index === array.length - 1 ||
                            busy ||
                            !draft.ready ||
                            Boolean(draft.stale)
                          }
                          aria-label={`Move ${item.label} down`}
                          onClick={() => move(1)}
                        >
                          ↓
                        </button>
                      </div>
                    );
                  },
                )}
              </details>
            ))}
          </details>
          <button
            type="button"
            className="builder-primary"
            disabled={busy || !changed || !draft.ready || Boolean(draft.stale)}
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
            Review existing-page changes
          </button>
        </>
      )}
      {busy && (
        <p role="status">
          {inspection
            ? "Preparing source changes…"
            : "Reading original source…"}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
