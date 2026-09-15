// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  isBillingSummary,
  billingRedirect,
  type BillingSummary,
} from "../../shared/builderBilling";
const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
  account: "alice",
}));
vi.mock("./storage", () => ({
  cloud: {
    auth: { getSession: mock.getSession },
    functions: { invoke: mock.invoke },
  },
}));
vi.mock("./shell", () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  Notice: ({ children, tone }: any) => (
    <div role={tone === "error" ? "alert" : "status"}>{children}</div>
  ),
}));
import BillingPanel from "./BillingPanel";
import { billingRequest } from "./billingService";

const plans = [
  {
    id: "free",
    name: "Free",
    projects: 1,
    pages_per_project: 5,
    storage_bytes: 104857600,
    publishes_per_month: 10,
  },
  {
    id: "plus",
    name: "Plus",
    projects: 3,
    pages_per_project: 50,
    storage_bytes: 2147483648,
    publishes_per_month: 100,
  },
  {
    id: "agency",
    name: "Agency",
    projects: 20,
    pages_per_project: 200,
    storage_bytes: 21474836480,
    publishes_per_month: 1000,
  },
] as BillingSummary["plans"];
const summary = (): BillingSummary => ({
  plan: plans[0],
  plans,
  hasCustomer: false,
  available: true,
  verifiedAt: null,
  pendingCheckout: null,
  subscriptions: [],
  prices: [
    {
      planId: "plus",
      amount: 1900,
      currency: "gbp",
      interval: "month",
      taxBehavior: "exclusive",
    },
    {
      planId: "agency",
      amount: 5900,
      currency: "gbp",
      interval: "month",
      taxBehavior: "exclusive",
    },
  ],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.account = "alice";
  mock.getSession
    .mockReset()
    .mockImplementation(async () => ({
      error: null,
      data: {
        session: {
          user: { id: mock.account },
          access_token: `${mock.account}-token`,
        },
      },
    }));
  mock.invoke.mockReset().mockResolvedValue({ data: summary(), error: null });
  window.history.replaceState(null, "", "/builder/?view=account");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = (id = "alice") =>
  act(async () => root.render(<BillingPanel accountId={id} />));
const button = (text: string) =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  )!;
const click = (text: string) => act(async () => button(text).click());
it("shows the server plan and prices without treating a visit as a purchase", async () => {
  await mount();
  expect(host.textContent).toContain("Current plan: Free");
  expect(host.textContent).toContain("£19.00 per month");
  expect(host.textContent).toContain("50 pages per website");
  expect(host.textContent).toContain("2 GB storage");
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith("builder-billing", {
    body: { action: "summary" },
    headers: { Authorization: "Bearer alice-token" },
  });
});
it("a Stripe return requests fresh provider state and never trusts payment claims in the URL", async () => {
  window.history.replaceState(
    null,
    "",
    "/builder/?view=account&billing=returned&paid=true&plan=agency",
  );
  await mount();
  expect(mock.invoke.mock.calls[0][1].body).toEqual({ action: "refresh" });
  expect(host.textContent).toContain("Current plan: Free");
  expect(host.textContent).not.toContain("Current plan: Agency");
});
it("issues one initial request through StrictMode effect replay", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <BillingPanel accountId="alice" />
      </StrictMode>,
    ),
  );
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Current plan: Free");
});
it("keeps beta access separate and usable when paid plan configuration is unavailable", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: {
      ...summary(),
      plan: { ...plans[2], id: "beta", name: "Private beta" },
      available: false,
      prices: [],
    },
  });
  await mount();
  expect(host.textContent).toContain("Current plan: Private beta");
  expect(host.textContent).toContain("Paid plans are not available yet");
  expect(button("Choose Plus")).toBeUndefined();
  await click("Refresh billing");
  expect(mock.invoke.mock.calls[1][1].body).toEqual({ action: "summary" });
});
it("uses Manage billing for active or past-due subscriptions, without offering a duplicate purchase", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: {
      ...summary(),
      hasCustomer: true,
      subscriptions: [
        {
          planId: "plus",
          status: "past_due",
          periodEnd: "2026-10-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      ],
    },
  });
  await mount();
  expect(button("Manage billing")).toBeDefined();
  expect(button("Choose Plus")).toBeUndefined();
  expect(host.textContent).toContain("needs attention");
});
it("retains an unknown checkout outcome, disables duplicate submits and provides refresh instead of replaying a purchase", async () => {
  await mount();
  const pending = deferred<any>();
  mock.invoke.mockReturnValueOnce(pending.promise);
  await click("Choose Plus");
  expect(button("Choose Plus").disabled).toBe(true);
  expect(button("Choose Agency").disabled).toBe(true);
  await click("Choose Plus");
  expect(mock.invoke).toHaveBeenCalledTimes(2);
  await act(async () =>
    pending.resolve({
      data: null,
      error: {
        context: Response.json({
          error:
            "The earlier request may have completed. Refresh billing before trying again.",
        }),
      },
    }),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "may have completed",
  );
  expect(button("Refresh billing").disabled).toBe(false);
  expect(mock.invoke.mock.calls[1][1].body).toEqual({
    action: "checkout",
    plan: "plus",
  });
});
it("shows one pending Checkout, disables a different plan and clears it after confirmed closure", async () => {
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: {
      ...summary(),
      hasCustomer: true,
      pendingCheckout: { planId: "plus", state: "pending" },
    },
  });
  await mount();
  expect(button("Reopen Plus Checkout").disabled).toBe(false);
  expect(button("Choose Agency").disabled).toBe(true);
  await click("Close unfinished Checkout");
  expect(mock.invoke.mock.calls[1][1].body).toEqual({
    action: "close-checkout",
  });
  expect(host.textContent).toContain("Checkout has closed");
  expect(button("Choose Agency").disabled).toBe(false);
});
it("drops a late response after an account switch and loads the new account", async () => {
  const initial = deferred<any>();
  mock.invoke.mockReturnValueOnce(initial.promise);
  await mount();
  mock.account = "bob";
  await mount("bob");
  await act(async () =>
    initial.resolve({
      error: null,
      data: {
        ...summary(),
        plan: { ...plans[2], name: "Old private account plan" },
      },
    }),
  );
  expect(host.textContent).not.toContain("Old private");
  expect(host.textContent).toContain("Current plan: Free");
  expect(mock.invoke.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer bob-token",
  );
});
it("refuses stale identities and unsafe provider links before navigation", async () => {
  await expect(billingRequest("bob", "portal")).rejects.toThrow(
    /account changed/,
  );
  expect(mock.invoke).not.toHaveBeenCalled();
  const pending = deferred<any>();
  mock.invoke.mockReturnValueOnce(pending.promise);
  const call = billingRequest("alice", "checkout", "plus");
  const rejected = expect(call).rejects.toThrow(/account changed/);
  await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalled());
  mock.account = "bob";
  pending.resolve({
    error: null,
    data: { url: "https://checkout.stripe.com/c/pay/fixture" },
  });
  await rejected;
  mock.account = "alice";
  mock.invoke.mockResolvedValue({
    error: null,
    data: { url: "https://checkout.stripe.com.attacker.example.test/c/pay" },
  });
  await expect(billingRequest("alice", "checkout", "plus")).rejects.toThrow(
    /could not be verified/,
  );
});
it("accepts only bounded complete summaries and rejects malformed responses with recovery wording", async () => {
  expect(isBillingSummary(summary())).toBe(true);
  for (const override of [
    { prices: [] },
    { plans: [plans[0]] },
    { plan: { ...plans[0], projects: -1 } },
    { subscriptions: [{ status: "active" }] },
    { pendingCheckout: { planId: "free", state: "open" } },
    { verifiedAt: "invalid" },
  ])
    expect(isBillingSummary({ ...summary(), ...override })).toBe(false);
  mock.invoke.mockResolvedValue({ error: null, data: { plan: "paid" } });
  await mount();
  expect(host.textContent).toContain("Billing details could not be checked");
  expect(button("Choose Plus")).toBeUndefined();
});
it("allows only the correct Stripe hosts and HTTPS URLs for each action", () => {
  expect(
    billingRedirect("https://billing.stripe.com/p/session/fixture", "portal"),
  ).toBe("https://billing.stripe.com/p/session/fixture");
  for (const url of [
    "http://checkout.stripe.com/c/pay/fixture",
    "https://user@checkout.stripe.com/c/pay/fixture",
    "https://checkout.stripe.com:444/c/pay/fixture",
    "javascript:alert(1)",
    "https://billing.stripe.com/p/session/fixture",
  ])
    expect(() => billingRedirect(url, "checkout")).toThrow();
});
