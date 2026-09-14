import React, { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { cloud, localMode } from "./storage";
import { Card, Head, Notice } from "./shell";
import { accountName, accountEmail } from "../../shared/builderAccount";
import {
  AccountChangeError,
  changeAccount,
  verifiedAccount,
  type AccountAction,
} from "./accountAuth";
import AccountDeletion from "./AccountDeletion";

export default function AccountPage() {
  const [account, setAccount] = useState<{
    id?: string;
    user?: User;
    error: string;
    loading: boolean;
  }>({ error: "", loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!cloud || localMode) return;
    let live = true,
      authSequence = 0,
      readSequence = 0;
    const accept = (session: Session | null) => {
      const sequence = ++readSequence;
      setAccount((old) => ({
        id: session?.user.id,
        user: old.id === session?.user.id ? old.user : undefined,
        error: "",
        loading: true,
      }));
      if (!session) {
        setAccount({
          error: "Sign in to manage your account.",
          loading: false,
        });
        return;
      }
      void verifiedAccount(session)
        .then((user) => {
          if (live && sequence === readSequence)
            setAccount({ id: user.id, user, error: "", loading: false });
        })
        .catch((error) => {
          if (live && sequence === readSequence)
            setAccount({
              id: session.user.id,
              error:
                error instanceof AccountChangeError
                  ? error.message
                  : "Your account details could not be checked. Refresh your details to try again.",
              loading: false,
            });
        });
    };
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      authSequence++;
      // Fetch outside the Auth callback so the SDK can release its session lock.
      readSequence++;
      setAccount((old) => ({
        id: session?.user.id,
        user: old.id === session?.user.id ? old.user : undefined,
        error: "",
        loading: true,
      }));
      const sequence = authSequence;
      queueMicrotask(() => {
        if (live && sequence === authSequence) accept(session);
      });
    });
    const initial = authSequence;
    void cloud.auth
      .getSession()
      .then((result) => {
        if (live && initial === authSequence)
          accept(result.error ? null : result.data.session);
      })
      .catch(() => {
        if (live && initial === authSequence)
          setAccount({
            error:
              "Your sign-in could not be checked. Refresh your details to try again.",
            loading: false,
          });
      });
    return () => {
      live = false;
      readSequence++;
      data.subscription.unsubscribe();
    };
  }, [attempt]);
  return (
    <>
      <Head title="Account" help="account" />
      <div className="builder-page-body builder-account">
        {localMode || !cloud ? (
          <Notice>
            Account settings belong to your signed-in hosted builder account.
            This local helper has no account to change.
          </Notice>
        ) : (
          <>
            {account.loading && !account.user && (
              <p role="status">Loading your account…</p>
            )}
            {account.error && <Notice tone="error">{account.error}</Notice>}
            <button
              type="button"
              disabled={account.loading}
              onClick={() => setAttempt((value) => value + 1)}
            >
              Refresh account details
            </button>
            {account.user && (
              <AccountDetails key={account.user.id} user={account.user} />
            )}
          </>
        )}
      </div>
    </>
  );
}

function AccountDetails({ user }: { user: User }) {
  const initialName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const [removed, setRemoved] = useState(false);
  const [name, setName] = useState(
    typeof initialName === "string" ? initialName : "",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [nonce, setNonce] = useState("");
  const [needsCode, setNeedsCode] = useState(false),
    [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    part: string;
    error?: string;
    notice?: string;
  }>();
  const live = useRef(true),
    working = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const message = (part: string) =>
    feedback?.part === part &&
    (feedback.error ? (
      <Notice tone="error">{feedback.error}</Notice>
    ) : (
      <Notice>{feedback.notice}</Notice>
    ));
  async function run(part: string, input: AccountAction) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await changeAccount(user.id, input);
      if (!live.current) return;
      setFeedback({ part, notice: result.notice });
      if (input.action === "name") setName(accountName(input.name)!);
      if (input.action === "password") {
        setNeedsCode(false);
        setNonce("");
      }
    } catch (error) {
      if (!live.current) return;
      setFeedback({ part, error: error.message });
      if (
        error instanceof AccountChangeError &&
        ["reauthentication_needed", "reauthentication_not_valid"].includes(
          error.code,
        )
      )
        setNeedsCode(true);
    } finally {
      working.current = false;
      if (live.current) {
        setBusy(false);
        if (input.action === "password") {
          setPassword("");
          setConfirmation("");
        }
      }
    }
  }
  if (removed)
    return (
      <Card title="Account deleted">
        <p role="status">
          Your login and project access have been removed. Website content and
          history are kept.
        </p>
        <button
          type="button"
          onClick={() => void cloud?.auth.signOut({ scope: "local" })}
        >
          Return to sign in
        </button>
      </Card>
    );
  return (
    <>
      <Card title="Your name" ariaLabel="Your name">
        {!accountName(initialName) && (
          <Notice>Add your name here before using Save to website.</Notice>
        )}
        <form
          className="builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("name", { action: "name", name });
          }}
        >
          <label>
            Your name
            <input
              name="full-name"
              autoComplete="name"
              maxLength={200}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </label>
          {message("name")}
          <button className="builder-primary" disabled={busy}>
            Save my name
          </button>
        </form>
      </Card>
      <Card title="Email address" ariaLabel="Email address">
        <p>
          Current sign-in email: <strong>{user.email || "No email set"}</strong>
        </p>
        {!accountEmail(user.email) && (
          <Notice>Add a valid email address before saving to a website.</Notice>
        )}
        {user.new_email && (
          <p role="status">
            Waiting for confirmation of {user.new_email}. Keep using{" "}
            {user.email} until this changes.
          </p>
        )}
        <form
          className="builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("email", { action: "email", email });
          }}
        >
          <label>
            New email address
            <input
              name="new-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="builder-hint">
            Check your email for confirmation. Your current address stays in use
            until the change is confirmed.
          </p>
          {message("email")}
          <button disabled={busy}>Change my email</button>
        </form>
      </Card>
      <Card title="Password" ariaLabel="Password">
        <form
          className="builder-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("password", {
              action: "password",
              password,
              confirmation,
              ...(nonce ? { nonce } : {}),
            });
          }}
        >
          <label>
            New password
            <input
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy}
            />
          </label>
          {needsCode && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run("password", { action: "reauthenticate" })
                }
              >
                Send confirmation code
              </button>
              <label>
                Confirmation code
                <input
                  name="confirmation-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={nonce}
                  onChange={(event) => setNonce(event.target.value)}
                  disabled={busy}
                />
              </label>
            </>
          )}
          {message("password")}
          <button disabled={busy}>Change my password</button>
        </form>
      </Card>
      <Card title="Other devices" ariaLabel="Other devices">
        <p>End your other sign-ins while keeping this window signed in.</p>
        {message("sessions")}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("sessions", { action: "signout-others" })}
        >
          Sign out of other sessions
        </button>
      </Card>
      <AccountDeletion accountId={user.id} onDeleted={() => setRemoved(true)} />
    </>
  );
}
