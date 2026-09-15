// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  domainVerificationRecord,
  readWebsiteDomainState,
  websiteDomainStatus,
  type WebsiteDomain,
  type WebsiteDomainState,
} from "../../shared/builderDomains";
const mock = vi.hoisted(() => ({
  account: "alice",
  getSession: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("./storage", () => ({
  cloud: {
    auth: { getSession: mock.getSession },
    functions: { invoke: mock.invoke },
  },
}));
vi.mock("./shell", () => ({
  Card: ({ children, title }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Pill: ({ children }: any) => <span>{children}</span>,
  Notice: ({ children, tone }: any) => (
    <div role={tone === "error" ? "alert" : "status"}>{children}</div>
  ),
}));
import DomainSettings from "./DomainSettings";
import { websiteDomainRequest } from "./domainService";
const project = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherProject = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const domainId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const hostname = "customer.fixture.co.uk";
const domain = (extra: Partial<WebsiteDomain> = {}): WebsiteDomain => ({
  id: domainId,
  projectId: project,
  hostname,
  status: "waiting_dns",
  operation: "connect",
  version: 1,
  bindingKind: "client-primary",
  verification: domainVerificationRecord(hostname, "a".repeat(64)),
  reason: null,
  dnsCheckedAt: null,
  connectedAt: null,
  removedAt: null,
  certificateExpiresAt: null,
  ...extra,
});
const state = (
  extra: Partial<WebsiteDomainState> = {},
): WebsiteDomainState => ({
  projectId: project,
  canManage: true,
  archived: false,
  domain: null,
  history: [],
  hosting: { ipv4: ["144.91.72.17"], ipv6: [] },
  ...extra,
});
const connected = (extra: Partial<WebsiteDomain> = {}) =>
  domain({
    status: "connected",
    dnsCheckedAt: new Date().toISOString(),
    connectedAt: new Date().toISOString(),
    certificateExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...extra,
  });
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.account = "alice";
  mock.getSession.mockReset().mockImplementation(async () => ({
    error: null,
    data: {
      session: {
        user: { id: mock.account },
        access_token: `${mock.account}-token`,
      },
    },
  }));
  mock.invoke.mockReset().mockResolvedValue({ error: null, data: state() });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const mount = (accountId = "alice", projectId = project) =>
  act(async () =>
    root.render(<DomainSettings accountId={accountId} projectId={projectId} />),
  );
const button = (text: string) =>
  Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent === text,
  )!;
const click = (text: string) => act(async () => button(text).click());
const fill = (value: string) =>
  act(async () => {
    const input = host.querySelector<HTMLInputElement>("input")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const submit = () =>
  act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );

it("reads once under StrictMode without performing setup", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <DomainSettings accountId="alice" projectId={project} />
      </StrictMode>,
    ),
  );
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith("builder-projects", {
    body: { action: "domain-state", projectId: project },
    headers: { Authorization: "Bearer alice-token" },
  });
  expect(button("Add domain")).toBeTruthy();
});

it("validates entered names and adds only a normalized hostname with a fresh request identity", async () => {
  await mount();
  await fill("https://customer.co.uk");
  await submit();
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "without a link or path",
  );
  const normalized = "www.xn--caf-dma.co.uk";
  await fill("WWW.Café.co.uk.");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({
      domain: domain({
        hostname: normalized,
        verification: domainVerificationRecord(normalized, "b".repeat(64)),
      }),
    }),
  });
  await submit();
  const body = mock.invoke.mock.calls[1][1].body;
  expect(body).toEqual({
    action: "domain-add",
    projectId: project,
    domainId: expect.stringMatching(/^[a-f0-9-]{36}$/),
    hostname: normalized,
  });
  expect(host.textContent).toContain("Waiting for DNS");
  expect(host.textContent).toContain(
    "_kaizen-verification.www.xn--caf-dma.co.uk",
  );
  expect(host.textContent).not.toContain("HTTPS is ready");
});

it("keeps the add identity across an unknown outcome and blocks duplicate mutations until a read", async () => {
  await mount();
  await fill(hostname);
  const waiting = deferred();
  mock.invoke.mockReturnValueOnce(waiting.promise);
  await submit();
  await submit();
  expect(mock.invoke).toHaveBeenCalledTimes(2);
  const originalId = mock.invoke.mock.calls[1][1].body.domainId;
  await act(async () =>
    waiting.resolve({
      error: {
        context: Response.json({
          error: "Refresh domain status before retrying.",
        }),
      },
      data: null,
    }),
  );
  expect(host.querySelector("form")).toBeNull();
  mock.invoke.mockResolvedValueOnce({ error: null, data: state() });
  await click("Refresh domain status");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ domain: domain() }),
  });
  await submit();
  expect(mock.invoke.mock.calls[2][1].body.action).toBe("domain-state");
  expect(mock.invoke.mock.calls[3][1].body.domainId).toBe(originalId);
});

it("binds removal confirmation to the observed domain and version and restores focus on cancellation", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: state({ domain: connected({ version: 7 }) }),
  });
  await mount();
  await click("Remove domain");
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Confirm domain removal",
  );
  await click("Keep domain");
  expect(document.activeElement).toBe(button("Remove domain"));
  await click("Remove domain");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({
      domain: domain({ version: 8, operation: "remove", status: "queued" }),
    }),
  });
  await click("Confirm removal");
  expect(mock.invoke.mock.calls[1][1].body).toEqual({
    action: "domain-remove",
    domainId,
    projectId: project,
    version: 7,
    confirm: true,
  });
  expect(host.textContent).toContain("Removing domain");
  expect(host.textContent).not.toContain("Open website");
});

it("requires refreshed status after a failed removal and never silently confirms again", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: state({ domain: connected() }),
  });
  await mount();
  await click("Remove domain");
  mock.invoke.mockResolvedValueOnce({
    error: {
      context: Response.json({ error: "Domain changed. Refresh its status." }),
    },
  });
  await click("Confirm removal");
  expect(button("Confirm removal")).toBeUndefined();
  expect(button("Remove domain")).toBeUndefined();
  await click("Refresh domain status");
  expect(button("Confirm removal")).toBeUndefined();
  expect(button("Remove domain")).toBeTruthy();
});

it("polls running work and later maintenance changes using reads only, skipping hidden tabs", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: state({ domain: domain({ status: "queued", version: 2 }) }),
  });
  await mount();
  vi.useFakeTimers();
  // Re-render via refresh so the running-state effect installs its timer under the fake clock.
  await click("Refresh domain status");
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  const count = mock.invoke.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count);
  visibility.mockReturnValue("visible");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ domain: connected({ version: 4 }) }),
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(mock.invoke.mock.calls[count][1].body.action).toBe("domain-state");
  expect(host.textContent).toContain("HTTPS is ready");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count + 1);
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({
      domain: connected({
        status: "attention",
        reason: "routing_mismatch",
        version: 5,
      }),
    }),
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count + 2);
  expect(host.textContent).not.toContain("HTTPS is ready");
  visibility.mockReturnValue("hidden");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count + 2);
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ domain: connected({ version: 6 }) }),
  });
  visibility.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count + 3);
  expect(host.textContent).toContain("HTTPS is ready");
});

it("picks up automatically completed DNS setup and pauses reads during removal confirmation", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: state({ domain: domain() }),
  });
  await mount();
  vi.useFakeTimers();
  await click("Refresh domain status");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ domain: connected({ version: 2 }) }),
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(host.textContent).toContain("HTTPS is ready");
  await click("Remove domain");
  const count = mock.invoke.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mock.invoke).toHaveBeenCalledTimes(count);
  expect(button("Confirm removal")).toBeTruthy();
});

it("shows read-only, archived and unavailable states without unauthorized connection controls", async () => {
  mock.invoke.mockResolvedValue({
    error: null,
    data: state({ canManage: false, domain: connected() }),
  });
  await mount();
  expect(button("Remove domain")).toBeUndefined();
  expect(button("Check domain")).toBeUndefined();
  expect(host.textContent).toContain("owner with publishing permission");
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ archived: true, domain: connected() }),
  });
  await click("Refresh domain status");
  expect(button("Check domain")).toBeUndefined();
  expect(button("Remove domain")).toBeTruthy();
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ hosting: null }),
  });
  await click("Refresh domain status");
  expect(button("Add domain")).toBeUndefined();
  expect(host.textContent).toContain("not available yet");
});

it("discards old project/account responses and never displays their fields in the next scope", async () => {
  const delayed = deferred();
  mock.invoke.mockReturnValueOnce(delayed.promise);
  await mount();
  mock.account = "bob";
  mock.invoke.mockResolvedValueOnce({
    error: null,
    data: state({ projectId: otherProject, canManage: false }),
  });
  await mount("bob", otherProject);
  await act(async () =>
    delayed.resolve({ error: null, data: state({ domain: connected() }) }),
  );
  expect(host.textContent).not.toContain(hostname);
  expect(button("Add domain")).toBeUndefined();
  expect(mock.invoke.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer bob-token",
  );
});

it("rejects cross-project, malformed and incomplete response data before showing DNS or links", () => {
  for (const value of [
    state({ projectId: otherProject }),
    state({ domain: domain({ projectId: otherProject }) }),
    state({ domain: domain({ hostname: "https://foreign.co.uk" }) }),
    state({
      domain: domain({
        verification: { type: "TXT", name: "foreign.co.uk", value: "bad" },
      }),
    }),
    state({ domain: connected({ certificateExpiresAt: null }) }),
    state({ domain: connected({ dnsCheckedAt: null }) }),
    state({ history: [domain()] }),
    state({ hosting: { ipv4: ["999.2.3.4"], ipv6: [] } }),
    state({ hosting: { ipv4: [], ipv6: ["https://foreign.co.uk"] } }),
  ])
    expect(() => readWebsiteDomainState(value, project)).toThrow(
      "could not be checked",
    );
  const result = readWebsiteDomainState(
    { ...state({ domain: connected() }), privateWorker: "private" },
    project,
  );
  expect(result).not.toHaveProperty("privateWorker");
  expect(
    websiteDomainStatus(
      connected({
        certificateExpiresAt: new Date(Date.now() - 1).toISOString(),
      }),
    ),
  ).toBe("HTTPS needs checking");
});

it("checks the signed-in account both before and after a request", async () => {
  mock.account = "bob";
  await expect(
    websiteDomainRequest("alice", project, { action: "domain-state" }),
  ).rejects.toThrow("account changed");
  expect(mock.invoke).not.toHaveBeenCalled();
  mock.account = "alice";
  mock.invoke.mockImplementationOnce(async () => {
    mock.account = "bob";
    return { error: null, data: state() };
  });
  await expect(
    websiteDomainRequest("alice", project, { action: "domain-state" }),
  ).rejects.toThrow("account changed");
});
