// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  isProjectBillingSummary,
  type ProjectBillingSummary,
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
import ProjectBillingPanel from "./ProjectBillingPanel";
import { projectBillingRequest } from "./billingService";
const summary = (payer = false): ProjectBillingSummary => ({
  isBillingOwner: payer,
  canTakeBilling: !payer,
  plan: {
    id: "free",
    name: "Free",
    projects: 1,
    pages_per_project: 5,
    storage_bytes: 104857600,
    publishes_per_month: 10,
  },
  pages: 3,
  registeredBytes: 1048576,
  accountUsage: payer
    ? { projects: 1, registeredBytes: 1048576, publications: 2 }
    : null,
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
  mock.invoke.mockReset().mockResolvedValue({ error: null, data: summary() });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = (accountId = "alice", projectId = "website-a") =>
  act(async () =>
    root.render(
      <ProjectBillingPanel accountId={accountId} projectId={projectId} />,
    ),
  );
const button = (text: string) =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  )!;
const click = (text: string) => act(async () => button(text).click());

it("loads the current website without exposing the other payer's account usage or changing billing", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <ProjectBillingPanel accountId="alice" projectId="website-a" />
      </StrictMode>,
    ),
  );
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith("builder-projects", {
    body: { action: "project-billing", projectId: "website-a" },
    headers: { Authorization: "Bearer alice-token" },
  });
  expect(host.textContent).toContain("another owner’s plan");
  expect(host.textContent).not.toContain("Across websites using your plan");
  expect(host.textContent).toContain("3 of 5 pages");
});
it("requires an explicit confirmation, supports cancellation and sends only the current account's bearer", async () => {
  await mount();
  await click("Use my plan for this website");
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Confirm website billing",
  );
  await click("Keep current billing");
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(button("Use my plan for this website"));
  await click("Use my plan for this website");
  mock.invoke.mockResolvedValueOnce({ error: null, data: summary(true) });
  await click("Confirm use of my plan");
  expect(mock.invoke.mock.calls[1]).toEqual([
    "builder-projects",
    {
      body: { action: "take-billing", projectId: "website-a", confirm: true },
      headers: { Authorization: "Bearer alice-token" },
    },
  ]);
  expect(host.textContent).toContain("This website now uses your plan");
  expect(host.textContent).toContain("2 of 10 publishes this month");
  expect(host.querySelector("a")?.getAttribute("href")).toBe(
    "?view=account&project=website-a",
  );
  expect(button("Use my plan for this website")).toBeUndefined();
});
it("suppresses duplicate transfers and requires a fresh read after an unknown outcome", async () => {
  await mount();
  await click("Use my plan for this website");
  const pending = deferred<any>();
  mock.invoke.mockReturnValueOnce(pending.promise);
  await click("Confirm use of my plan");
  await click("Confirm use of my plan");
  expect(mock.invoke).toHaveBeenCalledTimes(2);
  expect(button("Refresh website billing").disabled).toBe(true);
  await act(async () =>
    pending.resolve({
      error: {
        context: Response.json({
          error:
            "The billing request could not be confirmed. Refresh before trying again.",
        }),
      },
    }),
  );
  expect(button("Confirm use of my plan")).toBeUndefined();
  expect(button("Use my plan for this website")).toBeUndefined();
  mock.invoke.mockResolvedValueOnce({ error: null, data: summary(true) });
  await click("Refresh website billing");
  expect(mock.invoke.mock.calls[2][1].body.action).toBe("project-billing");
  expect(host.textContent).toContain("This website uses your plan");
});
it("drops stale website and account responses without replacing the current details", async () => {
  const first = deferred<any>();
  mock.invoke.mockReturnValueOnce(first.promise);
  await mount();
  await mount("alice", "website-b");
  await act(async () =>
    first.resolve({
      error: null,
      data: {
        ...summary(true),
        plan: { ...summary().plan, name: "Old website plan" },
      },
    }),
  );
  expect(host.textContent).not.toContain("Old website plan");
  const second = deferred<any>();
  mock.invoke.mockReturnValueOnce(second.promise);
  await click("Refresh website billing");
  mock.account = "bob";
  await mount("bob", "website-b");
  await act(async () =>
    second.resolve({
      error: null,
      data: {
        ...summary(true),
        plan: { ...summary().plan, name: "Old account plan" },
      },
    }),
  );
  expect(host.textContent).not.toContain("Old account plan");
  expect(host.textContent).toContain("Website plan: Free");
});
it("denies stale identities and a sign-in change while a transfer is pending", async () => {
  await expect(projectBillingRequest("bob", "website-a", true)).rejects.toThrow(
    /account changed/,
  );
  expect(mock.invoke).not.toHaveBeenCalled();
  const pending = deferred<any>();
  mock.invoke.mockReturnValueOnce(pending.promise);
  const result = projectBillingRequest("alice", "website-a", true);
  const rejected = expect(result).rejects.toThrow(/account changed/);
  await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalled());
  mock.account = "bob";
  pending.resolve({ error: null, data: summary(true) });
  await rejected;
});
it("shows preserved over-limit work, exhausted publishes and no transfer for editors", async () => {
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: {
      ...summary(true),
      pages: 7,
      accountUsage: {
        projects: 2,
        registeredBytes: 209715200,
        publications: 10,
      },
    },
  });
  await mount();
  expect(host.textContent).toContain("Your saved work is kept");
  expect(host.textContent).toContain("monthly publishing allowance is used");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: { ...summary(), canTakeBilling: false },
  });
  await mount("alice", "website-b");
  expect(button("Use my plan for this website")).toBeUndefined();
});
it("rejects missing, negative or private account usage in a non-owner response", async () => {
  expect(isProjectBillingSummary(summary())).toBe(true);
  expect(isProjectBillingSummary(summary(true))).toBe(true);
  for (const data of [
    { ...summary(), pages: -1 },
    { ...summary(), accountUsage: summary(true).accountUsage },
    { ...summary(true), canTakeBilling: true },
    { ...summary(true), accountUsage: null },
    { ...summary(), registeredBytes: Infinity },
  ])
    expect(isProjectBillingSummary(data)).toBe(false);
  mock.invoke.mockResolvedValueOnce({ error: null, data: { plan: "free" } });
  await mount();
  expect(host.textContent).toContain(
    "Website billing details could not be checked",
  );
  expect(button("Use my plan for this website")).toBeUndefined();
});
