import React, { useState } from "react";
import {
  defaultClientSettings,
  type ClientSettings as Settings,
} from "../../shared/builderSettings";
import type { Workspace } from "../../shared/visualBuilder";
import { storage } from "./storage";
import { Card, Head, Notice } from "./shell";
import { ProjectName } from "./activeProject";

/* Public details for this client's website: nothing here is a secret, and saving never publishes. */

export default function ClientSettings({
  workspace,
  onChange,
  children,
  viewSettings,
}: {
  workspace: Workspace;
  onChange: (value: Workspace) => void;
  children?: React.ReactNode;
  viewSettings?: React.ReactNode;
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
  const sanity = draft.cms.kind === "sanity-public" ? draft.cms : undefined;
  const updateSanity = (patch: { projectId?: string; dataset?: string }) =>
    setDraft({
      ...draft,
      cms: {
        kind: "sanity-public",
        projectId: sanity?.projectId || "",
        dataset: sanity?.dataset || "production",
        ...patch,
      },
    });
  return (
    <>
      <Head info={<ProjectName />} title="Settings" help="settings" />
      {viewSettings && <div className="builder-page-body">{viewSettings}</div>}
      <form
        className="builder-page-body"
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
              "Settings saved. Export or integrate again to apply them to the website.",
            );
          });
        }}
      >
        <fieldset disabled={busy} className="builder-fieldset">
          <Card title="Website">
            <div className="builder-form">
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
            </div>
          </Card>
          <Card title="Contact forms">
            <div className="builder-form">
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
            </div>
          </Card>
          <Card title="Content (CMS)">
            <div className="builder-form">
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
              {sanity && (
                <>
                  <label>
                    Sanity project ID
                    <input
                      value={sanity.projectId}
                      onChange={(event) =>
                        updateSanity({ projectId: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Sanity dataset
                    <input
                      value={sanity.dataset}
                      onChange={(event) =>
                        updateSanity({ dataset: event.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </Card>
          <div className="builder-row builder-actions">
            <button type="submit" className="builder-primary">
              Save settings
            </button>
            {sanity && (
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    const catalogue = await storage.loadContent();
                    setMessage(
                      `The saved CMS connection loaded ${catalogue.posts.length} published posts.`,
                    );
                  })
                }
              >
                Test CMS connection
              </button>
            )}
          </div>
        </fieldset>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {children}
      </form>
    </>
  );
}
