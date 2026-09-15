import React, { useEffect, useRef, useState } from "react";
import { Card, Notice } from "./shell";
import { billingRequest, type BillingAction } from "./billingService";
import type { BillingPlan, BillingSummary } from "../../shared/builderBilling";

function limits(plan: BillingPlan) {
  const megabytes = plan.storage_bytes / 1048576;
  const storage =
    megabytes >= 1024 ? `${megabytes / 1024} GB` : `${megabytes} MB`;
  return `${plan.projects} ${plan.projects === 1 ? "website" : "websites"} · ${plan.pages_per_project} pages per website · ${storage} storage · ${plan.publishes_per_month} publishes per month`;
}
export default function BillingPanel({ accountId }: { accountId: string }) {
  const [summary, setSummary] = useState<BillingSummary>();
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const mounted = useRef(false),
    pending = useRef(false),
    sequence = useRef(0);
  const run = async (action: BillingAction, plan?: "plus" | "agency") => {
    if (pending.current) return;
    pending.current = true;
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await billingRequest(accountId, action, plan);
      if (!mounted.current || current !== sequence.current) return;
      if ("url" in result) {
        window.location.assign(result.url);
        return;
      }
      setSummary(result.summary);
      if (action === "refresh") setNotice("Billing details refreshed.");
      if (action === "close-checkout")
        setNotice(
          "Checkout has closed. Your current subscription, if any, is shown below.",
        );
    } catch (error) {
      if (mounted.current && current === sequence.current)
        setError(
          error instanceof Error
            ? error.message
            : "Billing could not be checked. Refresh billing to try again.",
        );
    } finally {
      if (current === sequence.current) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    const revision = ++sequence.current;
    setSummary(undefined);
    setError("");
    setNotice("");
    setBusy(true);
    pending.current = false;
    // A query string only selects the screen and requests a fresh server read.
    // It never claims payment succeeded or changes the user's plan.
    const returning = new URLSearchParams(window.location.search).has(
      "billing",
    );
    queueMicrotask(() => {
      if (mounted.current && revision === sequence.current)
        void run(returning ? "refresh" : "summary");
    });
    return () => {
      mounted.current = false;
      sequence.current++;
      pending.current = false;
    };
  }, [accountId]);
  const paid = !!summary?.subscriptions.length;
  return (
    <Card className="builder-billing">
      <h2>Plan and billing</h2>
      <p>
        Manage the plan for websites you pay for. Invited access to someone
        else’s website does not change your subscription.
      </p>
      {busy && <p role="status">Checking billing…</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(summary?.available === false ? "summary" : "refresh")
        }
      >
        Refresh billing
      </button>
      {summary && (
        <>
          <h3>Current plan: {summary.plan.name}</h3>
          <p>{limits(summary.plan)}</p>
          <p>
            Cancelling or moving to a smaller plan keeps your saved work. If you
            exceed a limit, reduce usage or upgrade before adding more.
          </p>
          {summary.plan.id === "beta" && (
            <Notice>
              Your private beta access is already included. You do not need to
              start a paid subscription.
            </Notice>
          )}
          {!summary.available && (
            <Notice>
              Paid plans are not available yet. Your saved work is safe.
            </Notice>
          )}
          {summary.subscriptions.map((subscription, index) => (
            <p key={index}>
              {subscription.planId === null
                ? "An unrecognised subscription needs a billing review."
                : subscription.status === "active"
                  ? "Your subscription is active."
                  : subscription.status === "trialing"
                    ? "Your subscription is in its trial period."
                    : "Your subscription needs attention. Open Manage billing to check it."}
              {subscription.cancelAtPeriodEnd &&
                ` It is set to end on ${new Date(subscription.periodEnd).toLocaleDateString("en-GB", { dateStyle: "long" })}.`}
            </p>
          ))}
          {summary.available && summary.hasCustomer && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("portal")}
            >
              Manage billing
            </button>
          )}
          {summary.pendingCheckout && (
            <Notice>
              <p>
                You have an unfinished Checkout. Reopening the same plan reuses
                it. Close it before choosing a different plan.
              </p>
              <button
                type="button"
                disabled={busy || !summary.available}
                onClick={() => void run("close-checkout")}
              >
                Close unfinished Checkout
              </button>
            </Notice>
          )}
          {summary.available && summary.plan.id !== "beta" && !paid && (
            <div className="builder-billing-plans">
              {summary.prices.map((price) => {
                const plan = summary.plans.find((p) => p.id === price.planId)!;
                return (
                  <section key={price.planId} aria-label={`${plan.name} plan`}>
                    <h3>{plan.name}</h3>
                    <p>
                      <strong>
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: price.currency,
                        }).format(price.amount / 100)}{" "}
                        per month
                      </strong>
                    </p>
                    <p>{limits(plan)}</p>
                    <p>
                      {price.taxBehavior === "inclusive"
                        ? "Includes applicable tax."
                        : "The final total is shown at Checkout."}{" "}
                      You can cancel in Manage billing.
                    </p>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        (!!summary.pendingCheckout &&
                          summary.pendingCheckout.planId !== price.planId)
                      }
                      onClick={() => void run("checkout", price.planId)}
                    >
                      {summary.pendingCheckout?.planId === price.planId
                        ? `Reopen ${plan.name} Checkout`
                        : `Choose ${plan.name}`}
                    </button>
                  </section>
                );
              })}
            </div>
          )}
          {summary.available && (
            <p>
              Payment details are entered on Stripe. Your plan updates after
              Stripe confirms the subscription; returning here alone does not
              confirm a payment.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
