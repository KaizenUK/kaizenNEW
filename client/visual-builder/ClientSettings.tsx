import React, { useState } from "react";
import {
  defaultClientSettings,
  type ClientSettings as Settings,
} from "../../shared/builderSettings";
import type { Workspace } from "../../shared/visualBuilder";
import { storage } from "./storage";

export default function ClientSettings({
  workspace,
  onChange,
}: {
  workspace: Workspace;
  onChange: (value: Workspace) => void;
}) {
  const [draft, setDraft] = useState<Settings>(
    () => workspace.settings?.value || defaultClientSettings(),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="builder-panel-body builder-repository">
      <h1>Client settings</h1>
      <p>
        Public settings for this project's exports and integrations. Saving
        settings does not publish a site.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const settings = await storage.saveSettings(
              workspace.settings?.version || 0,
              draft,
            );
            onChange({ ...workspace, settings });
            setDraft(settings.value);
            setMessage(
              "Client settings saved. Export or integrate again to apply them to the website.",
            );
          });
        }}
      >
        <fieldset disabled={busy} className="builder-card builder-project-card">
          <legend>Website and forms</legend>
          <label>
            Website URL
            <input
              type="url"
              placeholder="https://client.example"
              value={draft.siteUrl}
              onChange={(event) =>
                setDraft({ ...draft, siteUrl: event.target.value })
              }
            />
          </label>
          <p>
            Use the public HTTPS origin, without a subfolder. Exports use it for
            canonical URLs and the sitemap. An empty URL omits the sitemap and
            lists this in the handoff.
          </p>
          <label>
            Favicon
            <select
              value={draft.favicon?.assetId || ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  favicon: event.target.value
                    ? { assetId: event.target.value }
                    : undefined,
                })
              }
            >
              <option value="">No favicon</option>
              {workspace.assets
                .filter((asset) => ["image", "icon"].includes(asset.kind))
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Public form receiver
            <input
              placeholder="https://forms.client.example/enquiries or /api/contact"
              value={draft.formEndpoint}
              onChange={(event) =>
                setDraft({ ...draft, formEndpoint: event.target.value })
              }
            />
          </label>
          <p>
            The receiver must implement CONTACT-FORMS.md from the export and
            accept the website's origin. Leave empty to disable form delivery. A
            stored enquiry does not prove an email notification was delivered.
            Never enter API keys here.
          </p>
          <label>
            CMS connection
            <select
              value={draft.cms.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  cms:
                    event.target.value === "none"
                      ? { kind: "none" }
                      : {
                          kind: "sanity-public",
                          projectId: "",
                          dataset: "production",
                        },
                })
              }
            >
              <option value="none">No CMS connection</option>
              <option value="sanity-public">Public Sanity dataset</option>
            </select>
          </label>
          {draft.cms.kind === "sanity-public" && (
            <>
              <label>
                Sanity project ID
                <input
                  value={draft.cms.projectId}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      cms: {
                        ...(draft.cms as Extract<
                          Settings["cms"],
                          { kind: "sanity-public" }
                        >),
                        projectId: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Sanity dataset
                <input
                  value={draft.cms.dataset}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      cms: {
                        ...(draft.cms as Extract<
                          Settings["cms"],
                          { kind: "sanity-public" }
                        >),
                        dataset: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <p>
                Uses published documents from a public dataset with the
                documented Kaizen post/category schema. Private datasets require
                a server integration. Website exports contain a content snapshot
                and make no live CMS calls.
              </p>
            </>
          )}
          <button type="submit">Save client settings</button>
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const catalogue = await storage.loadContent();
                setMessage(
                  `Saved CMS connection loaded ${catalogue.posts.length} published posts.`,
                );
              })
            }
          >
            Test saved CMS connection
          </button>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
