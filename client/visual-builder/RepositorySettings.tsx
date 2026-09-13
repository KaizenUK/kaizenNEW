import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RepositorySettingsState } from "../../shared/builderRepositorySettings";
import { repositoryConnection } from "./repositoryConnection";
import { storage } from "./storage";
import { useActiveProject } from "./activeProject";
import { Card, Notice, Pill } from "./shell";

export default function RepositorySettings() {
  const { project } = useActiveProject();
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  if (
    repositoryConnection.mode !== "hosted" ||
    project?.access?.role !== "owner"
  )
    return null;
  return (
    <Setup
      key={`${project.id}:${"accountId" in connection ? connection.accountId || "setup" : "setup"}`}
      connecting={connection.status === "connecting"}
    />
  );
}
function Setup({ connecting }: { connecting: boolean }) {
  const [state, setState] = useState<RepositorySettingsState>();
  const [repositoryUrl, setRepositoryUrl] = useState(""),
    [branch, setBranch] = useState("");
  const [publicKey, setPublicKey] = useState(""),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const loaded = useRef(false);
  const install = (next: RepositorySettingsState) => {
    setState(next);
    setRepositoryUrl(next.repository?.repositoryUrl || "");
    setBranch(next.repository?.branch || "");
    loaded.current = true;
  };
  useEffect(() => {
    if (connecting || loaded.current) return;
    let current = true;
    void storage
      .repository({ action: "repository-settings-read" })
      .then((next) => {
        if (current) {
          install(next);
          setError("");
        }
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    return () => {
      current = false;
    };
  }, [connecting]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const changed =
    repositoryUrl !== (state?.repository?.repositoryUrl || "") ||
    branch !== (state?.repository?.branch || "");
  const github = /^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/.exec(
    state?.repository?.repositoryUrl || "",
  );
  return (
    <section
      aria-label="Website repository"
      className="builder-repository-settings"
    >
      <Card
        title={
          <>
            Website repository{" "}
            <Pill tone={state?.connected ? "green" : "grey"}>
              {state?.connected ? "Connected" : "Setup needed"}
            </Pill>
          </>
        }
        description="Connect the original website to its hosted helper. Only project owners can change this setup. Saving settings does not push or publish the website."
      >
        <button
          type="button"
          disabled={busy || connecting}
          onClick={() =>
            void run(async () => {
              install(
                await storage.repository({
                  action: "repository-settings-read",
                }),
              );
              setPublicKey("");
              setMessage("Repository setup refreshed.");
            })
          }
        >
          Reload repository setup
        </button>
        {state && (
          <>
            <form
              className="builder-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const next = await storage.repository({
                    action: "repository-settings-save",
                    version: state.version,
                    repository: {
                      repositoryUrl: repositoryUrl.trim(),
                      branch: branch.trim(),
                    },
                  });
                  install(next);
                  setPublicKey("");
                  setMessage(
                    next.connected
                      ? "Repository settings saved."
                      : "Repository settings saved. Add the deploy key, then check the website folder.",
                  );
                });
              }}
            >
              <fieldset
                disabled={busy || connecting}
                className="builder-fieldset builder-form"
              >
                <label>
                  Repository SSH address
                  <input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="git@github.com:owner/website.git"
                    value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                  />
                </label>
                <label>
                  Website branch
                  <input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="stage"
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                  />
                </label>
                <p className="builder-hint">
                  Use the branch intended for website editing. Changing a
                  connected repository or branch keeps its previous folder and
                  requires a fresh connection. Pending work must be saved first.
                </p>
                <button
                  className="builder-primary"
                  type="submit"
                  disabled={!changed}
                >
                  Save repository settings
                </button>
              </fieldset>
            </form>
            <div className="builder-repository-key">
              <h3>Deploy key</h3>
              <p>
                {state.key.configured
                  ? "This project has a deploy key. Its private half stays on the server."
                  : "Create a key for this project, then add its public half to the repository's deploy keys."}
              </p>
              {state.key.fingerprint && (
                <p className="builder-hint">
                  Key fingerprint: <code>{state.key.fingerprint}</code>
                </p>
              )}
              {!state.connected && (
                <>
                  {state.key.configured && !publicKey && (
                    <p className="builder-hint">
                      The public key was shown when it was created. If you did
                      not keep it, replace this setup key and add the new public
                      key to the repository.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={
                      busy || connecting || changed || !state.repository
                    }
                    onClick={() =>
                      void run(async () => {
                        const next = await storage.repository({
                          action: "repository-settings-key",
                          version: state.version,
                        });
                        install(next);
                        setPublicKey(next.publicKey);
                        setMessage(
                          "Deploy key created. Copy the public key below before leaving this screen.",
                        );
                      })
                    }
                  >
                    {state.key.configured
                      ? "Replace setup key"
                      : "Create deploy key"}
                  </button>
                </>
              )}
              {publicKey && (
                <div className="builder-form">
                  <label>
                    Public deploy key
                    <textarea
                      readOnly
                      rows={4}
                      value={publicKey}
                      spellCheck={false}
                    />
                  </label>
                  <p>
                    Copy this key now. It is shown only here after creation. For
                    Save to website, enable write access when adding it to the
                    repository's deploy keys.
                  </p>
                  <div className="builder-row">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await navigator.clipboard.writeText(publicKey);
                          setMessage("Public deploy key copied.");
                        })
                      }
                    >
                      Copy public key
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPublicKey("");
                        setMessage(
                          "Public key hidden. Check the website folder after adding the key to the Git host.",
                        );
                      }}
                    >
                      I've added this key
                    </button>
                    {github && (
                      <a
                        href={`https://github.com/${github[1]}/${github[2]}/settings/keys`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open repository deploy keys
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="builder-row builder-actions">
              <button
                type="button"
                className="builder-primary"
                disabled={
                  busy || connecting || changed || !state.key.configured
                }
                onClick={() =>
                  void run(async () => {
                    install(
                      await storage.repository({
                        action: "repository-settings-connect",
                        version: state.version,
                      }),
                    );
                    setPublicKey("");
                    await repositoryConnection.reconnect();
                    setMessage(
                      "Website folder connected. Open Pages to edit the original website.",
                    );
                  })
                }
              >
                Check website folder
              </button>
              {state.repository?.saveToWebsite ? (
                <a
                  href={state.repository.saveToWebsite.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open staging
                </a>
              ) : (
                <p className="builder-hint">
                  Save to website needs the operator to approve this repository,
                  branch and staging deployment.
                </p>
              )}
            </div>
          </>
        )}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </Card>
    </section>
  );
}
