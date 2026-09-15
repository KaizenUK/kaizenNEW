import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { cloud } from "./storage";
import { Brand } from "./shell";
import {
  firstProjectRedirect,
  isBuilderAccountStart,
} from "../../shared/builderSignup";

class FirstProjectError extends Error {}

export default function BuilderFirstProjectGate({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(false),
    sequence = useRef(0),
    working = useRef(false);
  async function run() {
    if (working.current) return;
    const revision = ++sequence.current;
    working.current = true;
    setBusy(true);
    setError("");
    const current = () => live.current && revision === sequence.current;
    try {
      const session = await cloud!.auth.getSession();
      if (session.error || session.data.session?.user.id !== accountId)
        throw new FirstProjectError(
          "Your signed-in account changed. Reload the Builder.",
        );
      const result = await cloud!.functions.invoke("builder-projects", {
        body: { action: "bootstrap" },
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      });
      const after = await cloud!.auth.getSession();
      if (!current()) return;
      if (after.error || after.data.session?.user.id !== accountId)
        throw new FirstProjectError(
          "Your signed-in account changed. Reload the Builder.",
        );
      if (result.error) {
        let message =
          "Your first project could not be confirmed. Retry to check; this will not create a second project.";
        try {
          const body = await result.error.context?.clone().json();
          if (typeof body?.error === "string" && body.error.length <= 512)
            message = body.error;
        } catch {
          /* Keep the recoverable unknown-outcome message. */
        }
        throw new FirstProjectError(message);
      }
      if (!isBuilderAccountStart(result.data))
        throw new FirstProjectError(
          "Your first project could not be confirmed. Retry to check its status.",
        );
      const redirect = firstProjectRedirect(location.href, result.data);
      if (redirect) location.replace(redirect);
      else setReady(true);
    } catch (failure) {
      if (current())
        setError(
          failure instanceof FirstProjectError
            ? failure.message
            : "Your first project could not be confirmed. Retry to check its status.",
        );
    } finally {
      if (revision === sequence.current) {
        working.current = false;
        if (live.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    live.current = true;
    const revision = ++sequence.current;
    queueMicrotask(() => {
      if (live.current && revision === sequence.current) void run();
    });
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, [accountId]);
  if (ready) return children;
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card">
        <Brand />
        <h1>Opening your projects</h1>
        <p>
          For a new account, we create your first website after you confirm your
          email and accept the documents. Existing projects stay as they are.
        </p>
        {busy && <p role="status">Checking your projects…</p>}
        {error && <p role="alert">{error}</p>}
        <div className="builder-login">
          <button
            className="builder-primary"
            disabled={busy}
            onClick={() => void run()}
          >
            Retry
          </button>
          <button onClick={() => location.reload()}>Reload Builder</button>
          <button
            onClick={async () => {
              sequence.current++;
              working.current = true;
              setBusy(true);
              const result = await cloud!.auth
                .signOut({ scope: "local" })
                .catch(() => ({ error: true }));
              if (live.current && result.error) {
                setError("Your sign-out could not be confirmed. Try again.");
                working.current = false;
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
