import React, { useState } from "react";
import { clone, newId, type Workspace } from "../../shared/visualBuilder";
import {
  initialRoutes,
  type BuilderRedirect,
} from "../../shared/builderRoutes";
import { localRedirectPaths } from "../../shared/builderRedirects.js";
import { localMode, storage } from "./storage";

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
    <section className="builder-redirects">
      <div className="builder-section-heading">
        <h1>URL redirects</h1>
        <button disabled={busy || dirty} onClick={onClose}>
          Back to pages
        </button>
      </div>
      <p>
        Send visitors from an old URL to its replacement. Changes remain drafts
        until you publish them.
      </p>
      <p>
        Use paths such as /old-offer/ and /new-offer/. Existing site sections
        and editor URLs are protected. Publish the destination page first.
        Tracking query parameters are preserved.
      </p>
      {error && (
        <p role="alert" className="builder-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
        <div className="builder-row">
          <button
            disabled={rules.length >= 200}
            onClick={() => {
              setRules([
                ...rules,
                { id: newId(), source: "", destination: "", status: 302 },
              ]);
              setReview(false);
            }}
          >
            Add redirect
          </button>
          <button className="builder-primary" disabled={!dirty} onClick={save}>
            Save redirect draft
          </button>
          <button
            disabled={!dirty}
            onClick={() => {
              setRules(clone(state.draft));
              setReview(false);
              setError("");
            }}
          >
            Discard unsaved changes
          </button>
          <button disabled={dirty || !changed} onClick={() => setReview(true)}>
            Review redirect publication
          </button>
          {!localMode && (
            <button disabled={dirty} onClick={onReleases}>
              View releases
            </button>
          )}
        </div>
        {dirty && <p>Unsaved changes. Save or discard them before leaving.</p>}
        <p>
          Temporary (302) is useful while testing. Browsers can remember
          permanent (301) redirects even after you change them.
        </p>
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
                aria-label={`Remove redirect ${index + 1}`}
                onClick={() => {
                  setRules(rules.filter((item) => item.id !== rule.id));
                  setReview(false);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {!rules.length && (
          <p>No draft redirects. Add one when you replace a page URL.</p>
        )}
        {review && (
          <section
            className="builder-redirect-review"
            aria-label="Review redirect publication"
          >
            <h2>Review redirect publication</h2>
            <p>
              {localMode
                ? "This changes only the local site."
                : "This queues a website release. Rules become published after its live checks pass."}
            </p>
            <ul>
              {differences.map((rule) => (
                <li key={`${rule.action}-${rule.id}`}>
                  {rule.action}: {rule.source} → {rule.destination} (
                  {rule.status})
                </li>
              ))}
            </ul>
            <div className="builder-row">
              <button className="builder-primary" onClick={publish}>
                Publish redirects
              </button>
              <button onClick={() => setReview(false)}>Cancel</button>
            </div>
          </section>
        )}
        <details>
          <summary>Published rules ({state.published.length})</summary>
          <ul>
            {state.published.map((rule) => (
              <li key={rule.id}>
                {rule.source} → {rule.destination} ({rule.status})
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Redirect history ({state.revisions.length})</summary>
          <p>
            Restore a saved version into the draft, then save and review before
            publishing.
          </p>
          {[...state.revisions].reverse().map((revision) => (
            <div className="builder-row" key={revision.id}>
              <span>
                {new Date(revision.createdAt).toLocaleString()} ·{" "}
                {revision.rules.length} rules
              </span>
              <button
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
      </fieldset>
    </section>
  );
}
