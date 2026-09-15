import React, { useEffect, useRef, useState } from "react";
import { cloud } from "./storage";
import {
  isAccountDeletionState,
  type AccountDeletionState,
} from "../../shared/builderAccount";
import { Card, Notice } from "./shell";

export async function accountDeletionRequest(
  accountId: string,
  input: Record<string, unknown>,
): Promise<{ outcome: string; state: AccountDeletionState }> {
  if (!cloud) throw new Error("Sign in to manage your account.");
  const readSession = () =>
    cloud!.auth.getSession().catch(() => {
      throw new Error(
        "Your sign-in could not be checked. Refresh your details before trying again.",
      );
    });
  const captured = await readSession();
  if (captured.error || captured.data.session?.user.id !== accountId)
    throw new Error("Your signed-in account changed. Refresh your details.");
  const result = await cloud.functions
    .invoke("builder-account", {
      body: input,
      headers: {
        Authorization: `Bearer ${captured.data.session.access_token}`,
      },
    })
    .catch(() => {
      throw new Error(
        "The account request could not be confirmed. Refresh before trying again.",
      );
    });
  const current = await readSession();
  if (current.error || current.data.session?.user.id !== accountId)
    throw new Error("Your signed-in account changed. Refresh your details.");
  if (result.error) {
    let message =
      "The account request could not be confirmed. Refresh before trying again.";
    try {
      const body = await result.error.context?.clone().json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* Keep the unknown-result message. */
    }
    throw new Error(message);
  }
  if (
    !result.data ||
    ![
      "unchanged",
      "requested",
      "cancelled",
      "awaiting-owners",
      "deleted",
    ].includes(result.data.outcome) ||
    !isAccountDeletionState(result.data.state)
  )
    throw new Error(
      "The account request returned incomplete details. Refresh before trying again.",
    );
  return result.data;
}

export default function AccountDeletion({
  accountId,
  onDeleted,
}: {
  accountId: string;
  onDeleted: () => void;
}) {
  const [state, setState] = useState<AccountDeletionState>();
  const [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState<{
    requestId: string;
    projectId?: string;
    label: string;
    finish?: boolean;
  }>();
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0),
    live = useRef(true),
    working = useRef(false);
  const confirmationPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirming) return;
    confirmationPanel.current?.scrollIntoView({ block: "center" });
    confirmationPanel.current?.querySelector("button")?.focus();
  }, [confirming]);
  async function run(input: Record<string, unknown>) {
    if (working.current) return;
    working.current = true;
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await accountDeletionRequest(accountId, input);
      if (!live.current || current !== sequence.current) return;
      setState(result.state);
      setConfirming(undefined);
      const notices: Record<string, string> = {
        requested:
          "Your deletion request is saved. Another owner for each website must confirm it before your account is removed.",
        cancelled:
          "Your deletion request is cancelled. Your account stays open.",
        "awaiting-owners":
          "Your confirmation is saved. Other website owners still need to confirm before the account is removed.",
        deleted:
          "Account deletion is complete. Website content and release history are kept.",
      };
      setNotice(notices[result.outcome] || "");
      if (result.outcome === "deleted")
        window.dispatchEvent(new Event("builder-projects-changed"));
      if (result.state.request?.status === "completed") onDeleted();
    } catch (error) {
      if (live.current && current === sequence.current)
        setError(
          error.message ||
            "The account request could not be confirmed. Refresh before trying again.",
        );
    } finally {
      working.current = false;
      if (live.current && current === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    const setup = ++sequence.current;
    // React can replay setup/cleanup before a request has started. Only the
    // current setup may start a read, so replay cannot leave loading stuck.
    queueMicrotask(() => {
      if (live.current && setup === sequence.current)
        void run({ action: "state" });
    });
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, [accountId]);
  const request = state?.request;
  const confirmationControls = confirming && (
    <div
      ref={confirmationPanel}
      className="builder-account-confirm"
      role="group"
      aria-label="Confirm account deletion"
    >
      <p>
        Confirm deletion for {confirming.label}. Once all website owners have
        confirmed, the login and all project access will be removed. This cannot
        be undone. Website content and history are kept.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run({
            action: confirming.finish ? "finish" : "confirm",
            requestId: confirming.requestId,
            projectId: confirming.projectId,
            confirmation: "CONFIRM DELETION",
          })
        }
      >
        Confirm account deletion
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(undefined)}
      >
        Keep this request for later
      </button>
    </div>
  );
  return (
    <>
      <Card title="Delete my account" ariaLabel="Delete my account">
        <p>
          Request removal of your login and access to all your websites. Website
          content, uploaded files and release history stay with the websites.
        </p>
        <p>
          Before deletion, another owner must take over billing for each website
          that uses your plan, from Website plan and usage in Settings. Close
          any unfinished Checkout and end your subscriptions in Plan and
          billing. A subscription set to cancel stays active until its end date.
          Refresh billing after it ends, then continue your deletion request.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run({ action: "state" })}
        >
          Refresh account requests
        </button>
        {!state && !error && <p role="status">Loading account requests…</p>}
        {state && !request && (
          <form
            className="builder-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run({ action: "request", confirmation });
            }}
          >
            <p>
              Another owner for each website must confirm your request. You can
              cancel it until deletion starts.
            </p>
            <label>
              Type DELETE MY ACCOUNT
              <input
                name="delete-confirmation"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
                required
              />
            </label>
            <button disabled={busy || confirmation !== "DELETE MY ACCOUNT"}>
              Request account deletion
            </button>
          </form>
        )}
        {request && (
          <>
            <p role="status">
              {request.status === "completed"
                ? "Your account has been deleted."
                : request.status === "processing"
                  ? "Deletion has started. Website access has ended; account removal still needs to finish."
                  : "Waiting for owner confirmation."}
            </p>
            {request.status === "pending" && (
              <>
                {request.accessChanged && (
                  <Notice tone="error">
                    Your project access changed after this request. Cancel it
                    and make a new request so the right owners can review it.
                  </Notice>
                )}
                {request.needsOperator && (
                  <Notice>
                    This account has no project owner to review it. Ask the
                    builder operator to review your saved deletion request.
                  </Notice>
                )}
                <ul>
                  {request.projects.map((project) => (
                    <li key={project.id}>
                      {project.name}:{" "}
                      {project.lastOwner
                        ? "Add another owner before this account can be deleted."
                        : project.approved
                          ? "Owner confirmed"
                          : "Waiting for another owner"}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "cancel", requestId: request.id })
                  }
                >
                  Cancel deletion request
                </button>
              </>
            )}
            {request.status === "processing" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirming({
                    requestId: request.id,
                    label: "your account",
                    finish: true,
                  })
                }
              >
                Finish deletion
              </button>
            )}
          </>
        )}
        {!confirming?.projectId && confirmationControls}
      </Card>
      {Boolean(state?.reviews.length) && (
        <Card
          title="Account requests to review"
          ariaLabel="Account requests to review"
        >
          <p>
            Confirm only the requests for websites you own. Each other website
            needs its own owner's confirmation.
          </p>
          <ul className="builder-account-reviews">
            {state!.reviews.map((review) => (
              <li key={`${review.id}:${review.projectId}`}>
                <strong>
                  {review.name || review.email || "The requested account"}
                </strong>
                {review.name && review.email && <span>{review.email}</span>}
                <span>
                  {review.projectName} ·{" "}
                  {review.status === "processing"
                    ? "Deletion needs to finish"
                    : review.approved
                      ? "Owner confirmed"
                      : "Needs your review"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setConfirming({
                      requestId: review.id,
                      projectId: review.projectId,
                      label:
                        review.email || review.name || "the requested account",
                      finish: review.status === "processing",
                    })
                  }
                >
                  {review.status === "processing"
                    ? "Finish deletion"
                    : "Review deletion request"}
                </button>
              </li>
            ))}
          </ul>
          {confirming?.projectId && confirmationControls}
        </Card>
      )}
    </>
  );
}
