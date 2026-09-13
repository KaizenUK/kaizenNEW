import React, { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloud, localMode } from "./storage";
import { Brand } from "./shell";
import {
  initialAuthLink,
  readAuthLink,
  cleanAuthLink,
  passwordRecoveryAccount,
  finishPasswordRecovery,
} from "../lib/authRedirect";
import {
  authErrorMessage,
  missingAuthLink,
  unavailableAuthLink,
  passwordResetRedirect,
} from "./authState";
import { AccountChangeError, changeAccount } from "./accountAuth";
import { accountEmail, accountName } from "../../shared/builderAccount";

/** Authentication gates mounting the workspace; project access is enforced by RLS/API. */
export default function BuilderAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(localMode);
  const [session, setSession] = useState<Session | null>(null);
  const [link] = useState(
    () =>
      initialAuthLink() ??
      (typeof location === "undefined" ? null : readAuthLink(location.href)),
  );
  const [settingAccount, setSettingAccount] = useState<string>();
  const [linkProblem, setLinkProblem] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const account = useRef<string | undefined>(undefined);
  const completedSetup = useRef<string | undefined>(undefined);
  const pendingAction = useRef<"signin" | "reset" | "setup" | undefined>(
    undefined,
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const live = useRef(false),
    operation = useRef(0),
    working = useRef(false);
  useEffect(() => {
    if (localMode || !cloud) return;
    let mounted = true,
      revision = 0,
      initialized = false;
    let latest: Session | null = null,
      recoverySeen: string | undefined;
    live.current = true;
    const accept = (next: Session | null, event = "INITIAL_SESSION") => {
      if (!mounted) return;
      const signedInFromForm =
        initialized &&
        event === "SIGNED_IN" &&
        pendingAction.current === "signin";
      if (account.current !== next?.user.id) {
        operation.current++;
        working.current = false;
        setBusy(false);
        account.current = next?.user.id;
        completedSetup.current = undefined;
        pendingAction.current = undefined;
        const candidate =
          next?.user.user_metadata?.full_name ?? next?.user.user_metadata?.name;
        setName(typeof candidate === "string" ? candidate : "");
        setPassword("");
        setConfirmation("");
        setError("");
        setNotice("");
        setSettingAccount(undefined);
      }
      latest = next;
      setSession(next);
      if (initialized) setReady(true);
      if (signedInFromForm) setLinkProblem("");
      if (
        next?.user.user_metadata?.builder_password_set === false &&
        completedSetup.current !== next.user.id
      )
        setSettingAccount(next.user.id);
      if (
        next &&
        (event === "PASSWORD_RECOVERY" ||
          passwordRecoveryAccount() === next.user.id)
      ) {
        recoverySeen = next.user.id;
        setSettingAccount(next.user.id);
        setLinkProblem("");
      }
    };
    const { data } = cloud.auth.onAuthStateChange((event, next) => {
      revision++;
      accept(next, event);
    });
    void (async () => {
      try {
        const startup = await cloud.auth.initialize();
        const beforeRead = revision;
        const current = await cloud.auth.getSession();
        if (!mounted) return;
        if (beforeRead === revision)
          accept(current.error ? null : current.data.session);
        const observed = latest as Session | null;
        if (link?.failed || (startup.error && link?.callback)) {
          const message = authErrorMessage(
            startup.error || { code: link?.errorCode },
            "check",
          );
          setLinkProblem(
            message === authErrorMessage(null, "check")
              ? unavailableAuthLink
              : message,
          );
        } else if (
          link?.setupRequested &&
          (!observed ||
            (passwordRecoveryAccount() !== observed.user.id &&
              recoverySeen !== observed.user.id)) &&
          observed?.user.user_metadata?.builder_password_set !== false
        )
          setLinkProblem(missingAuthLink);
        else if (startup.error || (current.error && beforeRead === revision))
          setError(authErrorMessage(startup.error || current.error, "check"));
        if (link?.callback)
          history.replaceState(null, "", cleanAuthLink(location.href));
      } catch (error) {
        if (mounted) {
          const message = authErrorMessage(error, "check");
          if (link?.callback || link?.setupRequested) setLinkProblem(message);
          else setError(message);
        }
      } finally {
        initialized = true;
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
      live.current = false;
      operation.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  async function signOut() {
    if (!cloud || working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    const version = operation.current;
    try {
      const result = await cloud.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      if (live.current && account.current === undefined) {
        setLinkProblem("");
        setSettingAccount(undefined);
        setReset(false);
        history.replaceState(null, "", cleanAuthLink(location.href));
      }
    } catch (error) {
      if (live.current && version === operation.current)
        setError(authErrorMessage(error, "signout"));
    } finally {
      if (live.current && version === operation.current) {
        working.current = false;
        setBusy(false);
      }
    }
  }
  if (localMode || !cloud) return children;
  const setup = Boolean(
    session && !linkProblem && settingAccount === session.user.id,
  );
  if (ready && session && !setup && !linkProblem) return children;
  const invitedSetup =
    setup && session?.user.user_metadata?.builder_password_set === false;
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card">
        <Brand />
        {!ready ? (
          <p role="status">Checking your sign-in…</p>
        ) : session && linkProblem ? (
          <section
            className="builder-login"
            aria-label="Sign-in link unavailable"
          >
            <h1>This link could not be used</h1>
            <p role="alert">{linkProblem}</p>
            <p>
              You are still signed in as <strong>{session.user.email}</strong>.
              Continue with this account, or sign out to use another one.
            </p>
            {error && <p role="alert">{error}</p>}
            <button
              className="builder-primary"
              disabled={busy}
              onClick={() => {
                setLinkProblem("");
                history.replaceState(null, "", cleanAuthLink(location.href));
              }}
            >
              Continue with this account
            </button>
            <button disabled={busy} onClick={() => void signOut()}>
              Sign out and use another account
            </button>
          </section>
        ) : (
          <form
            className="builder-login"
            onSubmit={async (event) => {
              event.preventDefault();
              if (working.current) return;
              working.current = true;
              pendingAction.current = setup
                ? "setup"
                : reset
                  ? "reset"
                  : "signin";
              const version = operation.current;
              setBusy(true);
              setError("");
              setNotice("");
              try {
                if (setup) {
                  if (invitedSetup && !accountName(name))
                    throw new AccountChangeError(
                      "Add your name using 1–200 characters, without brackets or control characters.",
                    );
                  if (password.length < 12)
                    throw new AccountChangeError(
                      "Use at least 12 characters for your password.",
                    );
                  if (password !== confirmation)
                    throw new AccountChangeError("The passwords do not match.");
                  const accountId = session!.user.id;
                  await changeAccount(accountId, {
                    action: "setup-password",
                    password,
                    confirmation,
                    ...(invitedSetup ? { name } : {}),
                  });
                  if (!live.current || version !== operation.current) return;
                  history.replaceState(null, "", cleanAuthLink(location.href));
                  finishPasswordRecovery(accountId);
                  completedSetup.current = accountId;
                  setPassword("");
                  setConfirmation("");
                  setSettingAccount(undefined);
                } else if (reset) {
                  const address = accountEmail(email);
                  if (!address)
                    throw new AccountChangeError(
                      "Enter a valid email address.",
                    );
                  const result = await cloud.auth.resetPasswordForEmail(
                    address,
                    {
                      redirectTo: passwordResetRedirect(location.href),
                    },
                  );
                  if (result.error) throw result.error;
                  if (!live.current || version !== operation.current) return;
                  setLinkProblem("");
                  setNotice(
                    "If this address has an account, a password reset link has been requested. Check your email.",
                  );
                } else {
                  const result = await cloud.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  });
                  if (result.error) throw result.error;
                  if (!live.current || version !== operation.current) return;
                  setPassword("");
                }
              } catch (error) {
                if (live.current && version === operation.current)
                  setError(
                    error instanceof AccountChangeError &&
                      error.code === "account_change_failed"
                      ? error.message
                      : authErrorMessage(
                          error,
                          setup ? "setup" : reset ? "reset" : "signin",
                        ),
                  );
              } finally {
                if (live.current && version === operation.current) {
                  working.current = false;
                  pendingAction.current = undefined;
                  setBusy(false);
                }
              }
            }}
          >
            <h1>
              {setup
                ? invitedSetup
                  ? "Set up your account"
                  : "Set your password"
                : reset
                  ? "Reset your password"
                  : "Sign in to Kaizen Builder"}
            </h1>
            <p>
              {setup
                ? invitedSetup
                  ? `Add your name and choose a password for ${session?.user.email}.`
                  : `Choose a password for ${session?.user.email}.`
                : reset
                  ? "Enter your account email to request a new password link."
                  : "Use your invited editor account to access your projects."}
            </p>
            {linkProblem && <p role="alert">{linkProblem}</p>}
            {!setup && (
              <label>
                Email address
                <input
                  name="email"
                  disabled={busy}
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {invitedSetup && (
              <label>
                Your name
                <input
                  name="full-name"
                  disabled={busy}
                  autoComplete="name"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {(!reset || setup) && (
              <label>
                {setup ? "New password" : "Password"}
                <input
                  name="password"
                  disabled={busy}
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
                  disabled={busy}
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
                  setPassword("");
                  setConfirmation("");
                }}
              >
                {reset
                  ? "Back to sign in"
                  : linkProblem
                    ? "Request a new password reset link"
                    : "Forgot password?"}
              </button>
            )}
            {setup && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void signOut()}
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
