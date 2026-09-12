import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { clone, newId, type Workspace } from "../../shared/visualBuilder";
import {
  initialRoutes,
  type BuilderRedirect,
} from "../../shared/builderRoutes";
import { localRedirectPaths } from "../../shared/builderRedirects.js";
import { localMode, storage } from "./storage";
import { Card, Head, Notice, Pill } from "./shell";
import { ProjectName } from "./activeProject";

/* Old URL → new URL rules. Drafted here, published like everything else. */

export default function RedirectsPanel({
  workspace,
  onWorkspace,
  onClose,
  onReleases,
}: {
  workspace: Workspace;
  onWorkspace: (workspace: Workspace) => void;
  onClose: () => void;
  onReleases: () => void;
}) {
  const state = workspace.routes || initialRoutes();
  const [rules, setRules] = useState(() => clone(state.draft));
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(rules) !== JSON.stringify(state.draft);
  const changed =
    JSON.stringify(state.draft) !== JSON.stringify(state.published);
  const differences = [
    ...state.draft
      .filter(
        (rule) =>
          !state.published.some(
            (old) =>
              old.source === rule.source &&
              old.destination === rule.destination &&
              old.status === rule.status,
          ),
      )
      .map((rule) => ({
        ...rule,
        action: state.published.some((old) => old.source === rule.source)
          ? "Change"
          : "Add",
      })),
    ...state.published
      .filter(
        (rule) => !state.draft.some((next) => next.source === rule.source),
      )
      .map((rule) => ({ ...rule, action: "Remove" })),
  ];
  function update(id: string, patch: Partial<BuilderRedirect>) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
    setReview(false);
    setNotice("");
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const routes = await storage.saveRoutes(state.version, rules);
      onWorkspace({ ...workspace, routes });
      setRules(clone(routes.draft));
      setReview(false);
      setNotice(
        "Redirect draft saved. Visitors still use the published rules.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const result = await storage.publishRoutes(state.version);
      if (result.workspace) onWorkspace(result.workspace);
      setNotice(result.message);
      setReview(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Head
        info={<ProjectName />}
        title="Redirects"
        description="Send visitors from an old URL to its replacement. Rules stay in draft until you publish them."
        status={
          <Pill tone={dirty ? "orange" : changed ? "blue" : "green"}>
            {dirty
              ? "Unsaved changes"
              : changed
                ? "Draft differs from published"
                : "Published rules in use"}
          </Pill>
        }
      >
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => {
            setRules(clone(state.draft));
            setReview(false);
            setError("");
          }}
        >
          Discard unsaved changes
        </button>
        <button
          type="button"
          className="builder-primary"
          disabled={busy || !dirty}
          onClick={save}
        >
          Save redirect draft
        </button>
        <button
          type="button"
          disabled={busy || dirty || !changed}
          onClick={() => setReview(true)}
        >
          Review redirect publication
        </button>
        {!localMode && (
          <button type="button" disabled={busy || dirty} onClick={onReleases}>
            View releases
          </button>
        )}
        <button type="button" disabled={busy || dirty} onClick={onClose}>
          Back to pages
        </button>
      </Head>
      <div className="builder-page-body builder-redirects">
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        {dirty && (
          <Notice>Unsaved changes. Save or discard them before leaving.</Notice>
        )}
        <fieldset disabled={busy} className="builder-fieldset">
          <Card
            title="Draft rules"
            description="Use paths such as /old-offer/ and /new-offer/. Publish the destination page first. Existing site sections and editor URLs are protected, and tracking parameters in the query string are kept."
          >
            <datalist id="builder-redirect-destinations">
              {[...new Set<string>(localRedirectPaths(workspace.pages))].map(
                (value) => (
                  <option key={value} value={value} />
                ),
              )}
            </datalist>
            <div className="builder-redirect-rows">
              {rules.map((rule, index) => (
                <div className="builder-redirect-row" key={rule.id}>
                  <label>
                    Old URL {index + 1}
                    <input
                      aria-label={`Old URL ${index + 1}`}
                      value={rule.source}
                      placeholder="/old-offer/"
                      onChange={(event) =>
                        update(rule.id, { source: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Destination {index + 1}
                    <input
                      aria-label={`Destination ${index + 1}`}
                      list="builder-redirect-destinations"
                      value={rule.destination}
                      placeholder="/new-offer/"
                      onChange={(event) =>
                        update(rule.id, { destination: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Type {index + 1}
                    <select
                      aria-label={`Redirect type ${index + 1}`}
                      value={rule.status}
                      onChange={(event) =>
                        update(rule.id, {
                          status: Number(event.target.value) as 301 | 302,
                        })
                      }
                    >
                      <option value={302}>Temporary (302)</option>
                      <option value={301}>Permanent (301)</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="builder-icon-button builder-icon-button-danger"
                    aria-label={`Remove redirect ${index + 1}`}
                    title="Remove"
                    onClick={() => {
                      setRules(rules.filter((item) => item.id !== rule.id));
                      setReview(false);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {!rules.length && (
              <p className="builder-empty">
                No draft redirects yet. Add one when you change a page's URL.
              </p>
            )}
            <div className="builder-row builder-actions">
              <button
                type="button"
                disabled={rules.length >= 200}
                onClick={() => {
                  setRules([
                    ...rules,
                    { id: newId(), source: "", destination: "", status: 302 },
                  ]);
                  setReview(false);
                }}
              >
                <Plus size={16} /> Add redirect
              </button>
            </div>
            <p className="builder-hint">
              Temporary (302) is safer while testing. Browsers remember
              permanent (301) redirects even after you change them.
            </p>
          </Card>
          {review && (
            <Card
              className="builder-review"
              ariaLabel="Review redirect publication"
              title="Review redirect publication"
              description={
                localMode
                  ? "This changes only the local site."
                  : "This queues a website release. The rules become published once its live checks pass."
              }
            >
              <ul className="builder-review-list">
                {differences.map((rule) => (
                  <li key={`${rule.action}-${rule.id}`}>
                    {rule.action}: {rule.source} → {rule.destination} (
                    {rule.status})
                  </li>
                ))}
              </ul>
              <div className="builder-row builder-actions">
                <button
                  type="button"
                  className="builder-primary"
                  onClick={publish}
                >
                  Publish redirects
                </button>
                <button type="button" onClick={() => setReview(false)}>
                  Cancel
                </button>
              </div>
            </Card>
          )}
          <Card title="Published rules and history">
            <details>
              <summary>Published rules ({state.published.length})</summary>
              {state.published.length ? (
                <ul className="builder-review-list">
                  {state.published.map((rule) => (
                    <li key={rule.id}>
                      {rule.source} → {rule.destination} ({rule.status})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="builder-hint">No published redirects.</p>
              )}
            </details>
            <details>
              <summary>Redirect history ({state.revisions.length})</summary>
              <p className="builder-hint">
                Restore a saved version into the draft, then save and review
                before publishing.
              </p>
              {[...state.revisions].reverse().map((revision) => (
                <div className="builder-revision" key={revision.id}>
                  <span>
                    {new Date(revision.createdAt).toLocaleString()} ·{" "}
                    {revision.rules.length} rules
                  </span>
                  <button
                    type="button"
                    disabled={dirty}
                    onClick={() => {
                      setRules(clone(revision.rules));
                      setReview(false);
                      setNotice(
                        "History restored into the editor. Save the draft to keep it.",
                      );
                    }}
                  >
                    Restore redirect draft
                  </button>
                </div>
              ))}
            </details>
          </Card>
        </fieldset>
      </div>
    </>
  );
}
