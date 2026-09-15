import HelpLink from "./HelpLink";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { companionConnection } from "./companionConnection";
import { repositoryConnection } from "./repositoryConnection";
import { activeProjectId, listProjects } from "./projectStorage";
import { cloud } from "./storage";
import type { CompanionIdentity } from "../../shared/builderCompanion";
import RepositoryPanel from "./RepositoryPanel";
import { Card, Notice, Pill } from "./shell";

export default function HostedRepository({
  existingPath,
}: {
  existingPath?: string;
}) {
  const connection = useSyncExternalStore(
    repositoryConnection.subscribe,
    repositoryConnection.snapshot,
    repositoryConnection.snapshot,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    repositoryConnection.start();
  }, []);
  if (repositoryConnection.mode === "companion")
    return <LocalRepository existingPath={existingPath} />;
  return (
    <RepositoryPanel
      hosted
      existingPath={
        connection.status === "connected" ? existingPath : undefined
      }
      remoteRoot={connection.root}
      repositoryEnabled={connection.status === "connected"}
      intro={
        <Card
          title={
            <>
              Hosted helper{" "}
              <Pill tone={connection.status === "connected" ? "green" : "grey"}>
                {connection.status === "connected"
                  ? "Connected"
                  : connection.status === "connecting"
                    ? "Connecting"
                    : "Not connected"}
              </Pill>
            </>
          }
        >
          {connection.root && (
            <p className="builder-hint">Website folder: {connection.root}</p>
          )}
          <div className="builder-row builder-actions">
            <button
              type="button"
              disabled={connection.status === "connecting"}
              onClick={() => {
                setError("");
                void repositoryConnection
                  .reconnect()
                  .catch((error) => setError(error.message));
              }}
            >
              {connection.status === "connected"
                ? "Refresh connection"
                : "Connect hosted helper"}
            </button>
            <a
              href={`/builder/?project=${encodeURIComponent(activeProjectId)}&view=repository&helper=local`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Use a helper on this computer
            </a>
          </div>
          {(error || connection.error) && (
            <Notice tone="error">{error || connection.error}</Notice>
          )}
        </Card>
      }
    />
  );
}

/* Explicit developer path, in a separate project tab. */
function LocalRepository({ existingPath }: { existingPath?: string }) {
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
  const connected = connection.status === "connected";
  return (
    <RepositoryPanel
      existingPath={connection.root ? existingPath : undefined}
      remoteOrigin={connection.origin}
      remoteRoot={connection.root}
      repositoryEnabled={Boolean(connection.root)}
      intro={
        <Card
          className="builder-companion-card"
          title={
            <>
              Connect to this computer{" "}
              <Pill
                tone={
                  connected
                    ? "green"
                    : connection.status === "connecting"
                      ? "blue"
                      : "grey"
                }
              >
                {connected
                  ? "Connected"
                  : connection.status === "connecting"
                    ? "Waiting for approval"
                    : "Not connected"}
              </Pill>
            </>
          }
        >
          <p className="builder-hint">
            <a
              href={`/builder/?project=${encodeURIComponent(activeProjectId)}&view=repository`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Use the hosted helper in another tab
            </a>
          </p>
          <HelpLink topic="helper" />
          {identity && (
            <p className="builder-hint">
              Connecting <strong>{identity.projectName}</strong> from{" "}
              {identity.origin}.
            </p>
          )}
          <div className="builder-inline-form">
            <label>
              Helper address
              <input
                value={address}
                disabled={connection.status !== "disconnected"}
                onChange={(event) => setAddress(event.target.value)}
              />
            </label>
            {connection.status === "disconnected" ? (
              <button
                type="button"
                className="builder-primary"
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
                Connect helper
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => companionConnection.focus()}
                >
                  Show helper window
                </button>
                <button
                  type="button"
                  onClick={() =>
                    companionConnection.disconnect(
                      "Disconnected. Unsaved edits stay in this tab; connect again to save them.",
                    )
                  }
                >
                  Stop sharing this folder
                </button>
              </>
            )}
          </div>
          <p role="status" className="builder-hint">
            {connected
              ? `Connected to ${connection.root}`
              : connection.status === "connecting"
                ? "Waiting for you to allow access in the helper window…"
                : "Helper not connected."}
          </p>
          {(error || connection.error) && (
            <Notice tone="error">{error || connection.error}</Notice>
          )}
        </Card>
      }
    />
  );
}
