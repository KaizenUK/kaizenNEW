export type BillingPlanId = "free" | "plus" | "agency" | "beta";
export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  projects: number;
  pages_per_project: number;
  storage_bytes: number;
  publishes_per_month: number;
};
export type BillingPrice = {
  planId: "plus" | "agency";
  amount: number;
  currency: "gbp";
  interval: "month";
  taxBehavior: "inclusive" | "exclusive" | "unspecified";
};
export type BillingSummary = {
  plan: BillingPlan;
  plans: BillingPlan[];
  available: boolean;
  hasCustomer: boolean;
  prices: BillingPrice[];
  verifiedAt: string | null;
  pendingCheckout: {
    planId: "plus" | "agency";
    state: "pending" | "open";
  } | null;
  subscriptions: {
    planId: "plus" | "agency" | null;
    status:
      | "incomplete"
      | "trialing"
      | "active"
      | "past_due"
      | "unpaid"
      | "paused";
    periodEnd: string;
    cancelAtPeriodEnd: boolean;
  }[];
};
export type ProjectBillingSummary = {
  isBillingOwner: boolean;
  canTakeBilling: boolean;
  plan: BillingPlan;
  pages: number;
  registeredBytes: number;
  accountUsage: {
    projects: number;
    registeredBytes: number;
    publications: number;
  } | null;
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const paid = (value: unknown) => value === "plus" || value === "agency";
const date = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const positive = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0;
function plan(value: unknown): value is BillingPlan {
  return (
    record(value) &&
    ["free", "plus", "agency", "beta"].includes(String(value.id)) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 60 &&
    [
      value.projects,
      value.pages_per_project,
      value.storage_bytes,
      value.publishes_per_month,
    ].every(positive)
  );
}
export function isProjectBillingSummary(
  value: unknown,
): value is ProjectBillingSummary {
  const count = (item: unknown) =>
    Number.isSafeInteger(item) && (item as number) >= 0;
  if (
    !record(value) ||
    typeof value.isBillingOwner !== "boolean" ||
    typeof value.canTakeBilling !== "boolean" ||
    !plan(value.plan) ||
    !count(value.pages) ||
    !count(value.registeredBytes)
  )
    return false;
  if (!value.isBillingOwner) return value.accountUsage === null;
  return (
    !value.canTakeBilling &&
    record(value.accountUsage) &&
    count(value.accountUsage.projects) &&
    count(value.accountUsage.registeredBytes) &&
    count(value.accountUsage.publications)
  );
}
export function isBillingSummary(value: unknown): value is BillingSummary {
  if (
    !record(value) ||
    !plan(value.plan) ||
    typeof value.available !== "boolean" ||
    typeof value.hasCustomer !== "boolean" ||
    !(value.verifiedAt === null || date(value.verifiedAt)) ||
    !Array.isArray(value.plans) ||
    value.plans.length !== 3 ||
    !value.plans.every(plan) ||
    new Set(value.plans.map((p) => p.id)).size !== 3 ||
    value.plans.some((p) => p.id === "beta") ||
    !Array.isArray(value.prices) ||
    value.prices.length !== (value.available ? 2 : 0) ||
    !value.prices.every(
      (p) =>
        record(p) &&
        paid(p.planId) &&
        positive(p.amount) &&
        p.currency === "gbp" &&
        p.interval === "month" &&
        ["inclusive", "exclusive", "unspecified"].includes(
          String(p.taxBehavior),
        ),
    ) ||
    new Set(value.prices.map((p) => p.planId)).size !== value.prices.length
  )
    return false;
  if (
    value.pendingCheckout !== null &&
    !(
      record(value.pendingCheckout) &&
      paid(value.pendingCheckout.planId) &&
      ["pending", "open"].includes(String(value.pendingCheckout.state))
    )
  )
    return false;
  return (
    Array.isArray(value.subscriptions) &&
    value.subscriptions.length <= 100 &&
    value.subscriptions.every(
      (s) =>
        record(s) &&
        (s.planId === null || paid(s.planId)) &&
        [
          "incomplete",
          "trialing",
          "active",
          "past_due",
          "unpaid",
          "paused",
        ].includes(String(s.status)) &&
        date(s.periodEnd) &&
        typeof s.cancelAtPeriodEnd === "boolean",
    )
  );
}
export function billingRedirect(
  value: unknown,
  action: "checkout" | "portal",
): string {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.hostname ===
          (action === "checkout" ? "checkout.stripe.com" : "billing.stripe.com")
      )
        return url.href;
    } catch {
      /* Invalid URLs never reach document navigation. */
    }
  }
  throw new Error(
    "The billing page could not be verified. Refresh billing and try again.",
  );
}
