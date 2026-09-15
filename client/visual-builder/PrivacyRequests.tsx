import React, { useEffect, useRef, useState } from "react";
import { Card, Notice } from "./shell";
import { builderAccountRequest } from "./accountService";
import { BuilderLegalLinks } from "./BuilderLegalGate";
import { BUILDER_LEGAL } from "../../shared/builderLegal";
import {
  isPrivacyPage,
  isPrivacyState,
  privacyStatus,
  type PrivacyRequest,
  type PrivacyState,
} from "../../shared/builderPrivacy";

export default function PrivacyRequests({ accountId }: { accountId: string }) {
  const [state, setState] = useState<PrivacyState>();
  const [project, setProject] = useState(""),
    [kind, setKind] = useState("export"),
    [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState<PrivacyRequest>();
  const [response, setResponse] = useState(""),
    [status, setStatus] = useState("in_review"),
    [handled, setHandled] = useState(false);
  const live = useRef(false),
    sequence = useRef(0),
    working = useRef(false);
  const pending = useRef<{ signature: string; id: string } | undefined>(
    undefined,
  );
  const reviewPanel = useRef<HTMLFormElement>(null);
  useEffect(() => {
    reviewPanel.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus();
  }, [reviewing?.id]);

  async function run(
    input: Record<string, unknown>,
    success = "",
    pageScope?: "mine" | "reviews",
  ) {
    if (working.current) return;
    working.current = true;
    const version = ++sequence.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await builderAccountRequest(accountId, input);
      if (
        pageScope
          ? !isPrivacyPage(result?.page)
          : !isPrivacyState(result?.state)
      )
        throw new Error(
          "The request returned incomplete details. Refresh to check its status.",
        );
      if (!live.current || version !== sequence.current) return;
      if (pageScope)
        setState((previous) =>
          previous
            ? {
                ...previous,
                [pageScope]: {
                  nextCursor: result.page.nextCursor,
                  items: [
                    ...new Map(
                      [...previous[pageScope].items, ...result.page.items].map(
                        (item) => [item.id, item],
                      ),
                    ).values(),
                  ],
                },
              }
            : previous,
        );
      else setState(result.state);
      setNotice(success);
      if (input.action === "privacy-request") {
        setDetails("");
        pending.current = undefined;
      }
      if (input.action === "privacy-update" || input.action === "privacy-state")
        setReviewing(undefined);
    } catch (failure) {
      if (live.current && version === sequence.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The request could not be confirmed. Refresh before trying again.",
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
      if (live.current && setup === sequence.current)
        void run({ action: "privacy-state" });
    });
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, [accountId]);
  const ongoing = (item: PrivacyRequest) =>
    ["open", "in_review"].includes(item.status);
  function requestList(scope: "mine" | "reviews") {
    const page = state![scope];
    return (
      <>
        {!page.items.length && (
          <p>
            {scope === "mine"
              ? "You have no personal-data requests."
              : "There are no requests for websites you own."}
          </p>
        )}
        <ul className="builder-privacy-list">
          {page.items.map((item) => (
            <li key={item.id}>
              <article
                aria-label={`${item.kind === "export" ? "Data copy" : "Erasure"} request for ${item.projectName || "Builder account"}`}
              >
                <h3>
                  {item.kind === "export"
                    ? "Copy of personal data"
                    : "Erasure of personal data"}
                </h3>
                <p>
                  {item.projectName || "Builder account"} ·{" "}
                  <strong>{privacyStatus[item.status]}</strong>
                </p>
                {scope === "reviews" && (
                  <p>
                    {item.name || "The requester"}
                    {item.email && ` · ${item.email}`}
                  </p>
                )}
                <p>
                  Requested{" "}
                  <time dateTime={item.requestedAt}>
                    {new Date(item.requestedAt).toLocaleDateString()}
                  </time>
                  .{" "}
                  {item.needsOperator
                    ? "Kaizen reviews this request."
                    : "The current website owner reviews this request."}
                </p>
                <p className="builder-privacy-details">{item.details}</p>
                {item.response && (
                  <div>
                    <strong>Response</strong>
                    <p className="builder-privacy-details">{item.response}</p>
                  </div>
                )}
                {ongoing(item) &&
                  (scope === "mine" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          {
                            action: "privacy-update",
                            requestId: item.id,
                            version: item.version,
                            status: "cancelled",
                          },
                          "Your personal-data request is cancelled.",
                        )
                      }
                    >
                      Cancel request
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setReviewing(item);
                        setResponse(item.response);
                        setStatus("in_review");
                        setHandled(false);
                      }}
                    >
                      Review request
                    </button>
                  ))}
              </article>
            </li>
          ))}
        </ul>
        {page.nextCursor && (
          <button
            disabled={busy}
            onClick={() =>
              void run(
                { action: "privacy-list", scope, beforeId: page.nextCursor },
                "",
                scope,
              )
            }
          >
            Load older{" "}
            {scope === "mine" ? "personal-data requests" : "owner requests"}
          </button>
        )}
      </>
    );
  }
  return (
    <>
      <Card title="Terms and privacy" ariaLabel="Terms and privacy">
        <BuilderLegalLinks />
        <p>
          Current document version: {BUILDER_LEGAL.version}. Your acceptance is
          recorded against the document versions shown when you continue.
        </p>
      </Card>
      <Card title="My personal data" ariaLabel="My personal data">
        <p>
          Request a copy or erasure of your personal data. Account requests go
          to Kaizen; website requests go to the current website owner. A request
          does not automatically export data or delete a website.
        </p>
        <p>
          You can also contact{" "}
          <a href="mailto:privacy@kaizenweb.co.uk">privacy@kaizenweb.co.uk</a>,
          including without signing in.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        <button
          disabled={busy}
          onClick={() => void run({ action: "privacy-state" })}
        >
          Refresh personal-data requests
        </button>
        {!state && !error && (
          <p role="status">Loading personal-data requests…</p>
        )}
        {state && (
          <>
            <form
              className="builder-form"
              aria-label="New personal-data request"
              onSubmit={(event) => {
                event.preventDefault();
                const signature = JSON.stringify([project, kind, details]);
                if (pending.current?.signature !== signature)
                  pending.current = { signature, id: crypto.randomUUID() };
                void run(
                  {
                    action: "privacy-request",
                    requestId: pending.current.id,
                    projectId: project || null,
                    kind,
                    details,
                  },
                  "Your personal-data request is saved. You can track the owner's response here.",
                );
              }}
            >
              <label>
                What is this request about?
                <select
                  value={project}
                  disabled={busy}
                  onChange={(event) => setProject(event.target.value)}
                >
                  <option value="">My Builder account — Kaizen</option>
                  {state.projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — website owner
                    </option>
                  ))}
                </select>
              </label>
              <label>
                What would you like?
                <select
                  value={kind}
                  disabled={busy}
                  onChange={(event) => setKind(event.target.value)}
                >
                  <option value="export">A copy of my personal data</option>
                  <option value="erasure">Erasure of my personal data</option>
                </select>
              </label>
              <label>
                Help us find the relevant information
                <textarea
                  required
                  maxLength={1000}
                  rows={4}
                  value={details}
                  disabled={busy}
                  onChange={(event) => setDetails(event.target.value)}
                  aria-describedby="privacy-request-help"
                />
              </label>
              <p id="privacy-request-help">
                Use up to 1000 characters. Do not include passwords, private
                keys, identity documents or sensitive data here; the reviewer
                can arrange a secure way to verify or deliver information.
              </p>
              <button
                className="builder-primary"
                disabled={busy || !details.trim()}
              >
                Send personal-data request
              </button>
            </form>
            <h3>Your requests</h3>
            {requestList("mine")}
          </>
        )}
      </Card>
      {state && (
        <Card
          title="Personal-data requests to review"
          ariaLabel="Personal-data requests to review"
        >
          <p>
            Review requests for websites you currently own. Verify the requester
            and deliver any personal-data copy securely. Record the outcome here
            after handling it; this control does not export files or perform
            erasure.
          </p>
          {requestList("reviews")}
          {reviewing && (
            <form
              ref={reviewPanel}
              className="builder-form builder-account-confirm"
              aria-label="Respond to personal-data request"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  {
                    action: "privacy-update",
                    requestId: reviewing.id,
                    version: reviewing.version,
                    status,
                    response,
                    handled,
                  },
                  "Your response is recorded. The requester can see it in Account.",
                );
              }}
            >
              <h3>
                Response for{" "}
                {reviewing.name || reviewing.email || "the requester"}
              </h3>
              <label>
                Response to the requester
                <textarea
                  rows={4}
                  maxLength={2000}
                  required
                  value={response}
                  disabled={busy}
                  onChange={(event) => setResponse(event.target.value)}
                />
              </label>
              <p>
                Summarise the action or reason. Keep personal data, private
                links and identity documents out of this response.
              </p>
              <label>
                Request status
                <select
                  value={status}
                  disabled={busy}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setHandled(false);
                  }}
                >
                  <option value="in_review">Being reviewed</option>
                  <option value="fulfilled">Completed</option>
                  <option value="declined">Declined with a reason</option>
                </select>
              </label>
              {status !== "in_review" && (
                <label className="builder-legal-confirmation">
                  <input
                    type="checkbox"
                    checked={handled}
                    disabled={busy}
                    onChange={(event) => setHandled(event.target.checked)}
                  />
                  <span>
                    I have verified the requester and securely delivered the
                    response and any applicable data copy.
                  </span>
                </label>
              )}
              <button
                className="builder-primary"
                disabled={
                  busy ||
                  !response.trim() ||
                  (status !== "in_review" && !handled)
                }
              >
                Record response
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReviewing(undefined)}
              >
                Keep for later
              </button>
            </form>
          )}
        </Card>
      )}
    </>
  );
}
