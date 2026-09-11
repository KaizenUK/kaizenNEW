import React, { useEffect, useState, useSyncExternalStore } from "react";
import { companionConnection } from "./companionConnection";
import { activeProjectId, listProjects } from "./projectStorage";
import { cloud } from "./storage";
import type { CompanionIdentity } from "../../shared/builderCompanion";
import RepositoryPanel from "./RepositoryPanel";

export default function HostedRepository({
  existingPath,
}: {
  existingPath?: string;
}) {
  const connection = useSyncExternalStore(
    companionConnection.subscribe,
    companionConnection.snapshot,
    companionConnection.snapshot,
  );
  const [identity, setIdentity] = useState<CompanionIdentity>();
  const [address, setAddress] = useState("http://127.0.0.1:4321");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void Promise.all([cloud.auth.getSession(), listProjects()])
      .then(([session, projects]) => {
        const project = projects.find((p) => p.id === activeProjectId);
        if (!session.data.session || !project || project.archived)
          throw new Error(
            "Sign in and open an available project before connecting.",
          );
        if (live)
          setIdentity({
            origin: location.origin,
            accountId: session.data.session.user.id,
            projectId: activeProjectId,
            projectName: project.name,
          });
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      if (!session)
        companionConnection.disconnect("Signed out. Local connection ended.");
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <>
      <section className="builder-panel-body">
        <div className="builder-card builder-project-card builder-companion-card">
          <h1>Connect local checkout</h1>
          <p>
            Start <code>pnpm dev</code> in your Kaizen checkout. Enter its
            localhost address below, then approve the project and folder in the
            companion window. Keep that window open while editing here.
          </p>
          <p>
            Source drafts are stored on your computer, separately for this
            hosted account and project. Saved builder pages stay in the hosted
            workspace. File proposals, builds, GitHub Desktop commits and
            publication are separate actions.
          </p>
          {identity && (
            <p>
              <strong>{identity.projectName}</strong> · {identity.origin}
            </p>
          )}
          <label>
            Local companion address
            <input
              value={address}
              disabled={connection.status !== "disconnected"}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          {connection.status === "disconnected" ? (
            <button
              disabled={!identity}
              onClick={() => {
                setError("");
                try {
                  companionConnection.connect(address, identity!);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Connect local checkout
            </button>
          ) : (
            <>
              <button onClick={() => companionConnection.focus()}>
                Show companion window
              </button>
              <button
                onClick={() =>
                  companionConnection.disconnect(
                    "Disconnected. Open source edits stay in this tab; reconnect to save them.",
                  )
                }
              >
                Disconnect local access
              </button>
            </>
          )}
          <p role="status">
            {connection.status === "connected"
              ? `Connected to ${connection.root}`
              : connection.status === "connecting"
                ? "Waiting for approval in the local companion window…"
                : "Local companion disconnected."}
          </p>
          {connection.root && (
            <p>
              Reconnect to the same folder to retain open editing state. To use
              another folder,{" "}
              <a
                href={`/builder/?project=${encodeURIComponent(activeProjectId)}&view=repository`}
                target="_blank"
                rel="noopener noreferrer"
              >
                open a separate builder tab
              </a>
              . Approve a new, empty folder there when restoring a native
              backup.
            </p>
          )}
          {(error || connection.error) && (
            <p role="alert">{error || connection.error}</p>
          )}
        </div>
      </section>
      <RepositoryPanel
        existingPath={connection.root ? existingPath : undefined}
        remoteOrigin={connection.origin}
        remoteRoot={connection.root}
        repositoryEnabled={Boolean(connection.root)}
      />
    </>
  );
}
