import React, { useEffect, useRef, useState } from "react";
import {
  companionIdentity,
  type CompanionIdentity,
} from "../../shared/builderCompanion";
import { localMode } from "./storage";
import { Brand } from "./shell";
import "./builder.css";

async function localRequest(url: string, input: unknown, keepalive = false) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kaizen-Builder": "1" },
    body: JSON.stringify(input),
    keepalive,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Local companion request failed.");
  return result;
}
export default function CompanionWindow() {
  const [identity, setIdentity] = useState<CompanionIdentity>();
  const [root, setRoot] = useState("");
  const [newFolder, setNewFolder] = useState(false);
  const [lockedRoot, setLockedRoot] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState("");
  const [finished, setFinished] = useState(false);
  const generation = useRef(0);
  const enabled = useRef(false);
  const inFlight = useRef(0);
  const peer = useRef<
    | {
        origin: string;
        channel: string;
        identity?: CompanionIdentity;
        lastSeen: number;
      }
    | undefined
  >(undefined);
  const session = useRef<
    | { token: string; projectId: string; root: string; expiresAt: number }
    | undefined
  >(undefined);
  const live = useRef(true);
  function send(data: Record<string, unknown>) {
    if (peer.current)
      window.opener?.postMessage(
        { ...data, channel: peer.current.channel },
        peer.current.origin,
      );
  }
  function disconnect(
    message = "Disconnected. Reconnect from the hosted builder to continue.",
  ) {
    generation.current++;
    enabled.current = false;
    const current = session.current;
    session.current = undefined;
    if (current)
      void localRequest(
        "/__builder-companion",
        { action: "disconnect", token: current.token },
        true,
      ).catch(() => {});
    send({ type: "kaizen-companion-disconnected", error: message });
    if (live.current) {
      setConnected(false);
      setFinished(true);
      setError(message);
    }
  }
  useEffect(() => {
    if (!localMode) return;
    live.current = true;
    const startingGeneration = generation.current;
    const params = new URLSearchParams(location.hash.slice(1));
    const origin = params.get("origin"),
      channel = params.get("channel");
    if (
      !origin ||
      !channel ||
      !/^[a-f0-9-]{36}$/.test(channel) ||
      !window.opener
    ) {
      setError(
        "Open this window using Connect local checkout in the hosted builder.",
      );
      return;
    }
    let ready = false;
    const receive = async (event: MessageEvent) => {
      if (
        !ready ||
        !enabled.current ||
        event.source !== window.opener ||
        event.origin !== origin ||
        event.data?.channel !== channel
      )
        return;
      const data = event.data;
      peer.current!.lastSeen = Date.now();
      if (data.type === "kaizen-companion-init") {
        try {
          const next = companionIdentity(data.identity);
          if (next.origin !== origin)
            throw new Error("The requesting builder origin does not match.");
          if (
            peer.current!.identity &&
            JSON.stringify(peer.current!.identity) !== JSON.stringify(next)
          )
            throw new Error(
              "The requesting project changed. Open a new connection.",
            );
          if (peer.current!.identity) return;
          peer.current!.identity = next;
          setIdentity(next);
          if (typeof data.requiredRoot === "string" && data.requiredRoot) {
            setRoot(data.requiredRoot);
            setLockedRoot(true);
          }
        } catch (e) {
          disconnect(e.message);
        }
      } else if (data.type === "kaizen-companion-disconnect") disconnect();
      else if (data.type === "kaizen-companion-request") {
        const current = session.current;
        if (!current || !/^[a-f0-9-]{36}$/.test(data.id || "")) return;
        if (inFlight.current >= 8) {
          send({
            type: "kaizen-companion-result",
            id: data.id,
            error: "Wait for the pending local operations to finish.",
          });
          return;
        }
        inFlight.current++;
        try {
          if (JSON.stringify(data.input).length > 51 * 1024 * 1024)
            throw new Error(
              "The local request exceeds the connection size limit.",
            );
          setActivity("Working on the approved repository…");
          const result = await localRequest(
            `/__builder-local?project=${encodeURIComponent(current.projectId)}`,
            { connection: current.token, request: data.input },
          );
          if (session.current === current) {
            send({ type: "kaizen-companion-result", id: data.id, result });
            setActivity("Local operation finished.");
          }
        } catch (e) {
          if (session.current === current) {
            send({
              type: "kaizen-companion-result",
              id: data.id,
              error: e.message,
            });
            setActivity(
              "Local operation needs attention in the hosted builder.",
            );
          }
        } finally {
          inFlight.current--;
        }
      }
    };
    window.addEventListener("message", receive);
    const unload = () => disconnect();
    window.addEventListener("pagehide", unload);
    void fetch("/__builder-companion")
      .then(async (response) => {
        const info = await response.json();
        if (!live.current || generation.current !== startingGeneration) return;
        if (!response.ok || !info.origins?.includes(origin))
          throw new Error(
            "This builder origin is not approved by the local companion.",
          );
        peer.current = { origin, channel, lastSeen: Date.now() };
        setRoot(info.root);
        ready = true;
        enabled.current = true;
        send({ type: "kaizen-companion-ready" });
      })
      .catch((e) => {
        if (live.current) setError(e.message);
      });
    const timer = setInterval(() => {
      if (!peer.current) return;
      if (
        !window.opener ||
        window.opener.closed ||
        Date.now() - peer.current.lastSeen > 180000 ||
        (session.current && session.current.expiresAt <= Date.now())
      ) {
        disconnect(
          "Hosted builder closed, stopped responding or the connection expired.",
        );
        ready = false;
        clearInterval(timer);
      } else send({ type: "kaizen-companion-ping" });
    }, 10000);
    return () => {
      live.current = false;
      disconnect();
      clearInterval(timer);
      window.removeEventListener("message", receive);
      window.removeEventListener("pagehide", unload);
    };
  }, []);
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card builder-companion-card">
        <Brand />
        <h1>Local checkout connection</h1>
        {!localMode ? (
          <p>
            Start Kaizen locally with pnpm dev, then connect from the hosted
            builder.
          </p>
        ) : (
          <>
            {identity && (
              <>
                <p>
                  <strong>{identity.projectName}</strong>
                </p>
                <p>{identity.origin}</p>
                <small>
                  Account {identity.accountId} · Project {identity.projectId}
                </small>
                <p>
                  This window grants that builder tab access to the selected
                  folder for two hours. Source drafts stay on this computer.
                  File changes and builds still require their review steps. Keep
                  this window open while editing.
                </p>
                <form
                  className="builder-login"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (busy || connected || finished) return;
                    setBusy(true);
                    setError("");
                    const attempt = generation.current;
                    try {
                      const result = await localRequest(
                        "/__builder-companion",
                        { action: "connect", identity, root, newFolder },
                      );
                      if (!live.current || generation.current !== attempt) {
                        void localRequest(
                          "/__builder-companion",
                          { action: "disconnect", token: result.token },
                          true,
                        ).catch(() => {});
                        return;
                      }
                      session.current = result;
                      setRoot(result.root);
                      setLockedRoot(true);
                      setConnected(true);
                      send({
                        type: "kaizen-companion-connected",
                        root: result.root,
                        expiresAt: result.expiresAt,
                      });
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Approved repository folder
                    <input
                      required
                      value={root}
                      disabled={connected || busy || lockedRoot}
                      onChange={(event) => setRoot(event.target.value)}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={newFolder}
                      disabled={connected || busy || finished}
                      onChange={(event) => setNewFolder(event.target.checked)}
                    />{" "}
                    New folder for restoring a native backup
                  </label>
                  {!connected && !finished && (
                    <button className="builder-primary" disabled={busy}>
                      {busy ? "Connecting…" : "Connect selected folder"}
                    </button>
                  )}
                </form>
              </>
            )}
            {connected && (
              <>
                <p role="status">
                  Connected. Review and edit in the hosted builder.
                </p>
                <button onClick={() => disconnect()}>
                  Disconnect local access
                </button>
                <p>
                  Requests already accepted may finish. Review their result
                  before retrying.
                </p>
              </>
            )}
            {activity && <p role="status">{activity}</p>}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
