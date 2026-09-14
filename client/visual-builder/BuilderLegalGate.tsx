import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { cloud } from "./storage";
import { Brand } from "./shell";
import { builderAccountRequest } from "./accountService";
import {
  BUILDER_LEGAL,
  currentLegalDocuments,
  isBuilderLegalState,
  type BuilderLegalState,
} from "../../shared/builderLegal";

export function BuilderLegalLinks() {
  return (
    <p className="builder-legal-links">
      <a
        href={BUILDER_LEGAL.termsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of Service
      </a>
      {" · "}
      <a
        href={BUILDER_LEGAL.privacyUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
    </p>
  );
}

export default function BuilderLegalGate({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const [legal, setLegal] = useState<BuilderLegalState>();
  const [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const live = useRef(false),
    sequence = useRef(0),
    working = useRef(false);
  async function run(accept = false) {
    if (
      working.current ||
      (accept && (!checked || !legal || !currentLegalDocuments(legal)))
    )
      return;
    working.current = true;
    const version = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const result = await builderAccountRequest(
        accountId,
        accept
          ? {
              action: "legal-accept",
              version: legal!.version,
              termsHash: legal!.termsHash,
              privacyHash: legal!.privacyHash,
              confirmed: true,
            }
          : { action: "legal-state" },
      );
      if (
        !isBuilderLegalState(result?.legal) ||
        (accept && !result.legal.acceptedAt)
      )
        throw new Error(
          "Your acceptance could not be confirmed. Refresh the documents to check before trying again.",
        );
      if (live.current && version === sequence.current) {
        setLegal(result.legal);
        setChecked(false);
      }
    } catch (failure) {
      if (live.current && version === sequence.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The documents could not be checked. Refresh to try again.",
        );
    } finally {
      if (version === sequence.current) {
        working.current = false;
        if (live.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    live.current = true;
    const setup = ++sequence.current;
    queueMicrotask(() => {
      if (live.current && setup === sequence.current) void run();
    });
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, [accountId]);
  if (legal?.acceptedAt && currentLegalDocuments(legal)) return children;
  const current = legal && currentLegalDocuments(legal);
  return (
    <div className="builder-app builder-auth" data-theme="light">
      <main className="builder-auth-card">
        <Brand />
        <h1>Before you open the Builder</h1>
        <p>
          Read the Terms of Service and Privacy Policy. We record the document
          versions and the time you accept.
        </p>
        <BuilderLegalLinks />
        {!legal && !error && (
          <p role="status">Checking the current documents…</p>
        )}
        {legal && !current && (
          <p role="alert">
            The document versions have changed. Reload to review the current
            terms before continuing.
          </p>
        )}
        {legal && <p>Document version: {legal.version}</p>}
        {error && <p role="alert">{error}</p>}
        <form
          className="builder-login"
          onSubmit={(event) => {
            event.preventDefault();
            void run(true);
          }}
        >
          <label className="builder-legal-confirmation">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy || !current}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              I agree to the Terms of Service and acknowledge the Privacy
              Policy.
            </span>
          </label>
          <p>This does not opt you into marketing or optional tracking.</p>
          <button
            className="builder-primary"
            disabled={busy || !checked || !current}
          >
            {busy ? "Please wait…" : "Accept and open Builder"}
          </button>
          <button type="button" disabled={busy} onClick={() => void run()}>
            Refresh documents
          </button>
          {legal && !current && (
            <button type="button" onClick={() => location.reload()}>
              Reload Builder
            </button>
          )}
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              if (signingOut) return;
              // Leaving must remain possible while a document read is pending.
              const version = ++sequence.current;
              working.current = true;
              setBusy(true);
              setSigningOut(true);
              setError("");
              try {
                const result = await cloud!.auth.signOut({ scope: "local" });
                if (result.error) throw new Error();
              } catch {
                if (live.current)
                  setError("Sign-out could not be confirmed. Try again.");
              } finally {
                if (version === sequence.current) {
                  working.current = false;
                  if (live.current) {
                    setBusy(false);
                    setSigningOut(false);
                  }
                }
              }
            }}
          >
            Sign out
          </button>
        </form>
        <p>
          You can make a personal-data request without accepting new terms:{" "}
          <a href="mailto:privacy@kaizenweb.co.uk">privacy@kaizenweb.co.uk</a>.
        </p>
      </main>
    </div>
  );
}
