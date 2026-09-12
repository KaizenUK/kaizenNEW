import React, { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloud, localMode } from "./storage";
import { Brand } from "./shell";

/** Authentication gates mounting the workspace; project access is enforced by RLS/API. */
export default function BuilderAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(localMode);
  const [session, setSession] = useState<Session | null>(null);
  const [settingPassword, setSettingPassword] = useState(
    () =>
      typeof location !== "undefined" &&
      (new URLSearchParams(location.search).get("password") === "setup" ||
        /(?:^#|&)type=(?:invite|recovery)(?:&|$)/.test(location.hash)),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (localMode || !cloud) return;
    let mounted = true;
    const accept = (next: Session | null) => {
      if (!mounted) return;
      setSession(next);
      setReady(true);
      if (next?.user.user_metadata?.builder_password_set === false)
        setSettingPassword(true);
    };
    cloud.auth
      .getSession()
      .then(({ data, error }) => {
        accept(data.session);
        if (mounted && error) setError(error.message);
      })
      .catch(() => {
        if (mounted) {
          setReady(true);
          setError(
            "Sign-in could not be checked. Please reload and try again.",
          );
        }
      });
    const { data } = cloud.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setSettingPassword(true);
      accept(next);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (localMode || !cloud) return children;
  if (ready && session && !settingPassword) return children;
  const setup = Boolean(session && settingPassword);
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card">
        <Brand />
        {!ready ? (
          <p role="status">Checking your sign-in…</p>
        ) : (
          <form
            className="builder-login"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              setNotice("");
              try {
                if (setup) {
                  if (password.length < 12)
                    throw new Error(
                      "Use at least 12 characters for your password.",
                    );
                  if (password !== confirmation)
                    throw new Error("The passwords do not match.");
                  const result = await cloud.auth.updateUser({
                    password,
                    data: { builder_password_set: true },
                  });
                  if (result.error) throw result.error;
                  const url = new URL(location.href);
                  url.searchParams.delete("password");
                  url.hash = "";
                  history.replaceState(null, "", url);
                  setPassword("");
                  setConfirmation("");
                  setSettingPassword(false);
                } else if (reset) {
                  const result = await cloud.auth.resetPasswordForEmail(email, {
                    redirectTo: `${location.origin}/builder/?password=setup`,
                  });
                  if (result.error) throw result.error;
                  setNotice(
                    "If this address has an account, a password reset link has been requested. Check your email.",
                  );
                } else {
                  const result = await cloud.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (result.error) throw result.error;
                  setPassword("");
                }
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Sign-in failed. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h1>
              {setup
                ? "Set your password"
                : reset
                  ? "Reset your password"
                  : "Sign in to Kaizen Builder"}
            </h1>
            <p>
              {setup
                ? `Choose a password for ${session?.user.email}.`
                : "Use your invited editor account to access your projects."}
            </p>
            {settingPassword && !session && (
              <p>
                Your invitation or reset link has expired or has already been
                used. Sign in, or request a new password reset link.
              </p>
            )}
            {!setup && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {(!reset || setup) && (
              <label>
                {setup ? "New password" : "Password"}
                <input
                  name="password"
                  type="password"
                  autoComplete={setup ? "new-password" : "current-password"}
                  minLength={setup ? 12 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {setup && (
              <label>
                Confirm password
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <button className="builder-primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : setup
                  ? "Save password and open builder"
                  : reset
                    ? "Send password reset link"
                    : "Sign in"}
            </button>
            {!setup && (
              <button
                type="button"
                className="builder-text-button builder-auth-switch"
                disabled={busy}
                onClick={() => {
                  setReset(!reset);
                  setError("");
                  setNotice("");
                }}
              >
                {reset ? "Back to sign in" : "Forgot password?"}
              </button>
            )}
            {setup && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cloud.auth.signOut()}
              >
                Sign out
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
