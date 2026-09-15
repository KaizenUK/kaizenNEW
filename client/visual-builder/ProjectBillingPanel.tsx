import React, { useEffect, useRef, useState } from "react";
import { Card, Notice } from "./shell";
import { projectBillingRequest } from "./billingService";
import type { ProjectBillingSummary } from "../../shared/builderBilling";

function storageAmount(bytes: number) {
  const unit = bytes >= 1073741824 ? 1073741824 : 1048576;
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(bytes / unit)} ${unit === 1073741824 ? "GB" : "MB"}`;
}
export default function ProjectBillingPanel({
  accountId,
  projectId,
}: {
  accountId: string;
  projectId: string;
}) {
  const [summary, setSummary] = useState<ProjectBillingSummary>();
  const [busy, setBusy] = useState(true),
    [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mounted = useRef(false),
    pending = useRef(false),
    sequence = useRef(0);
  const confirmation = useRef<HTMLDivElement>(null);
  const takeButton = useRef<HTMLButtonElement>(null);
  async function run(take = false) {
    if (pending.current) return;
    pending.current = true;
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await projectBillingRequest(accountId, projectId, take);
      if (!mounted.current || current !== sequence.current) return;
      setSummary(result);
      setConfirming(false);
      setNotice(
        take
          ? "This website now uses your plan. Your subscription has not changed."
          : "",
      );
    } catch (error) {
      if (mounted.current && current === sequence.current) {
        setError(
          error instanceof Error
            ? error.message
            : "Website billing could not be checked. Refresh before trying again.",
        );
        // A failed read or lost response is not permission to repeat a transfer.
        setSummary(undefined);
        setConfirming(false);
      }
    } finally {
      if (current === sequence.current) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const revision = ++sequence.current;
    pending.current = false;
    setSummary(undefined);
    setBusy(true);
    setConfirming(false);
    setError("");
    setNotice("");
    queueMicrotask(() => {
      if (mounted.current && revision === sequence.current) void run();
    });
    return () => {
      mounted.current = false;
      sequence.current++;
      pending.current = false;
    };
  }, [accountId, projectId]);
  useEffect(() => {
    if (confirming) confirmation.current?.focus();
  }, [confirming]);
  const usage = summary?.accountUsage,
    plan = summary?.plan;
  const overLimit =
    !!summary &&
    !!plan &&
    (summary.pages > plan.pages_per_project ||
      (!!usage &&
        (usage.projects > plan.projects ||
          usage.registeredBytes > plan.storage_bytes)));
  return (
    <Card title="Website plan and usage" ariaLabel="Website plan and usage">
      <p>
        Each website uses one owner’s plan. Other owners and editors can keep
        their access.
      </p>
      {busy && <p role="status">Checking website billing…</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <button type="button" disabled={busy} onClick={() => void run()}>
        Refresh website billing
      </button>
      {summary && plan && (
        <>
          <h3>Website plan: {plan.name}</h3>
          <p>
            {summary.isBillingOwner
              ? "This website uses your plan."
              : "This website uses another owner’s plan."}
          </p>
          <p>
            {summary.pages} of {plan.pages_per_project} pages ·{" "}
            {storageAmount(summary.registeredBytes)} of website storage
          </p>
          {usage && (
            <>
              <h3>Across websites using your plan</h3>
              <ul>
                <li>
                  {usage.projects} of {plan.projects} websites, including
                  archived websites
                </li>
                <li>
                  {storageAmount(usage.registeredBytes)} of{" "}
                  {storageAmount(plan.storage_bytes)} website storage
                </li>
                <li>
                  {usage.publications} of {plan.publishes_per_month} publishes
                  this month, including pending publishes
                </li>
              </ul>
              <p>
                The publishing allowance resets at the start of each calendar
                month in UTC. Failed publishes return their allowance.
              </p>
              <a
                href={`?view=account&project=${encodeURIComponent(projectId)}`}
              >
                Manage my plan
              </a>
            </>
          )}
          {overLimit && (
            <Notice tone="error">
              This website or your account exceeds its plan. Your saved work is
              kept. Reduce usage or upgrade before publishing or adding more.
            </Notice>
          )}
          {usage && usage.publications >= plan.publishes_per_month && (
            <Notice>
              Your monthly publishing allowance is used. You can still edit,
              undo a publication or take the website offline.
            </Notice>
          )}
          {summary.isBillingOwner && (
            <p>
              To leave this website or delete your account, another owner must
              open these settings and take over its billing first.
            </p>
          )}
          {summary.canTakeBilling && !confirming && (
            <button
              ref={takeButton}
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Use my plan for this website
            </button>
          )}
          {confirming && (
            <div
              ref={confirmation}
              tabIndex={-1}
              className="builder-account-confirm"
              role="group"
              aria-label="Confirm website billing"
            >
              <p>
                This website will count towards your plan’s website, page,
                storage and publishing limits. Your subscription and price will
                not change. Existing publication usage stays with the account
                that requested it. If your plan cannot fit the website, nothing
                changes.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(true)}
              >
                Confirm use of my plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  queueMicrotask(() => takeButton.current?.focus());
                }}
              >
                Keep current billing
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
