import React, { useEffect, useRef, useState } from "react";
import { cloud } from "./storage";
import { Brand } from "./shell";
import { BuilderLegalLinks } from "./BuilderLegalGate";
import { accountEmail, accountName } from "../../shared/builderAccount";
import {
  signupRedirect,
  signupNotice,
  confirmationNotice,
} from "../../shared/builderSignup";
import { authErrorMessage } from "./authState";

export default function BuilderSignup({
  initialEmail,
  confirmationOnly = false,
  onBack,
}: {
  initialEmail: string;
  confirmationOnly?: boolean;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail),
    [name, setName] = useState("");
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState(confirmationOnly);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const live = useRef(false),
    working = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card">
        <Brand />
        <form
          className="builder-login"
          onSubmit={async (event) => {
            event.preventDefault();
            if (working.current) return;
            const address = accountEmail(email),
              fullName = accountName(name);
            setError("");
            setNotice("");
            if (!address) {
              setError("Enter a valid email address.");
              return;
            }
            if (!confirming && !fullName) {
              setError(
                "Add your name using 1–200 characters, without brackets or control characters.",
              );
              return;
            }
            if (!confirming && password.length < 12) {
              setError("Use at least 12 characters for your password.");
              return;
            }
            if (!confirming && password !== confirmation) {
              setError("The passwords do not match.");
              return;
            }
            working.current = true;
            setBusy(true);
            try {
              const result = confirming
                ? await cloud!.auth.resend({
                    type: "signup",
                    email: address,
                    options: { emailRedirectTo: signupRedirect(location.href) },
                  })
                : await cloud!.auth.signUp({
                    email: address,
                    password,
                    options: {
                      emailRedirectTo: signupRedirect(location.href),
                      data: { full_name: fullName },
                    },
                  });
              // Some provider configurations return a duplicate-account error; the UI
              // deliberately gives the same response as a successful signup request.
              if (
                result.error &&
                result.error.code !== "user_already_exists" &&
                result.error.code !== "email_exists"
              )
                throw result.error;
              if (!live.current) return;
              setNotice(confirming ? confirmationNotice : signupNotice);
              setConfirming(true);
              setPassword("");
              setConfirmation("");
            } catch (failure) {
              if (live.current)
                setError(
                  authErrorMessage(failure, confirming ? "confirm" : "signup"),
                );
            } finally {
              working.current = false;
              if (live.current) setBusy(false);
            }
          }}
        >
          <h1>
            {confirming ? "Confirm your email" : "Create your Builder account"}
          </h1>
          <p>
            {confirming
              ? "Open your latest confirmation email to continue. You can request another link below."
              : "Confirm your email, review the documents, then start with your own website. Creating an account does not start a paid subscription."}
          </p>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {!confirming && (
            <>
              <label>
                Your name
                <input
                  name="full-name"
                  autoComplete="name"
                  maxLength={200}
                  required
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                Confirm password
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={busy}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button className="builder-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : confirming
                ? "Resend confirmation email"
                : "Create account"}
          </button>
          <button type="button" onClick={onBack}>
            Back to sign in
          </button>
          {!confirming && (
            <p>
              After confirming your email, you will be asked to accept the Terms
              of Service and acknowledge the Privacy Policy before your first
              project is created.
            </p>
          )}
        </form>
        <BuilderLegalLinks />
      </main>
    </div>
  );
}
