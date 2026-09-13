// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  changed: undefined as any,
  current: null as any,
  getSession: vi.fn(),
  verified: vi.fn(),
  change: vi.fn(),
  invoke: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("./storage", () => ({
  localMode: false,
  cloud: {
    auth: {
      getSession: mock.getSession,
      onAuthStateChange: (fn: any) => {
        mock.changed = fn;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
    },
    functions: { invoke: mock.invoke },
  },
}));
vi.mock("./accountAuth", () => ({
  AccountChangeError: class extends Error {},
  changeAccount: mock.change,
  verifiedAccount: mock.verified,
}));
vi.mock("./shell", () => ({
  Head: ({ title }: any) => <h1>{title}</h1>,
  Card: ({ title, children }: any) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Notice: ({ children, tone }: any) => (
    <p role={tone === "error" ? "alert" : "status"}>{children}</p>
  ),
}));
import AccountPage from "./AccountPage";
import AccountDeletion, { accountDeletionRequest } from "./AccountDeletion";
function session(id: string) {
  return {
    user: {
      id,
      email: `${id}@example.test`,
      user_metadata: { full_name: `${id} name` },
    },
    access_token: `${id}-token`,
  };
}
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
  mock.current = session("first");
  mock.getSession
    .mockReset()
    .mockImplementation(async () => ({
      data: { session: mock.current },
      error: null,
    }));
  mock.verified
    .mockReset()
    .mockImplementation(async (value: any) => value.user);
  mock.change.mockReset().mockResolvedValue({ notice: "Saved" });
  mock.invoke
    .mockReset()
    .mockResolvedValue({
      data: { outcome: "unchanged", state: { request: null, reviews: [] } },
      error: null,
    });
  mock.unsubscribe.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = (node: React.ReactNode = <AccountPage />) =>
  act(async () => {
    root.render(node);
  });
const name = () =>
  host.querySelector<HTMLInputElement>('input[name="full-name"]')?.value;
const changeSession = (value: any) =>
  act(async () => {
    mock.current = value;
    mock.changed(value ? "SIGNED_IN" : "SIGNED_OUT", value);
  });

it("discards a late initial session after a newer sign-in event", async () => {
  const initial = deferred<any>();
  mock.getSession.mockReturnValueOnce(initial.promise);
  await mount();
  await changeSession(session("second"));
  expect(name()).toBe("second name");
  await act(async () =>
    initial.resolve({ data: { session: session("first") }, error: null }),
  );
  expect(name()).toBe("second name");
  expect(mock.verified).toHaveBeenCalledTimes(1);
});
it("does not restore the old profile when its verified account response arrives last", async () => {
  const old = deferred<any>();
  mock.verified.mockReturnValueOnce(old.promise);
  await mount();
  await changeSession(session("second"));
  expect(name()).toBe("second name");
  await act(async () => old.resolve(session("first").user));
  expect(name()).toBe("second name");
  expect(host.textContent).not.toContain("first@example.test");
});
it("drops old forms and their in-flight save notice on an account change", async () => {
  const saved = deferred<any>();
  mock.change.mockReturnValueOnce(saved.promise);
  await mount();
  const form = host.querySelector('input[name="full-name"]')!.closest("form")!;
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  expect(mock.change).toHaveBeenCalledWith("first", {
    action: "name",
    name: "first name",
  });
  await changeSession(session("second"));
  await act(async () => saved.resolve({ notice: "Old account was saved" }));
  expect(name()).toBe("second name");
  expect(host.textContent).not.toContain("Old account was saved");
});
it("clears profile and deletion controls on sign-out even with a profile read pending", async () => {
  const old = deferred<any>();
  mock.verified.mockReturnValueOnce(old.promise);
  await mount();
  await changeSession(null);
  await act(async () => old.resolve(session("first").user));
  expect(name()).toBeUndefined();
  expect(host.textContent).toContain("Sign in to manage your account");
  expect(host.textContent).not.toContain("Delete my account");
});
it("keeps account lookup transport details out of the screen and offers refresh", async () => {
  mock.verified.mockRejectedValueOnce(new Error("private transport detail"));
  await mount();
  expect(host.textContent).not.toContain("private transport detail");
  expect(host.textContent).toContain("could not be checked");
  expect(host.textContent).toContain("Refresh account details");
});
it("loads account requests through React's development effect replay", async () => {
  await mount(
    <StrictMode>
      <AccountDeletion accountId="first" onDeleted={() => {}} />
    </StrictMode>,
  );
  expect(host.textContent).toContain("Type DELETE MY ACCOUNT");
  expect(host.textContent).not.toContain("Loading account requests");
});
it("uses the captured account token for requests and discards responses after switching accounts", async () => {
  const response = deferred<any>();
  mock.invoke.mockReturnValueOnce(response.promise);
  const operation = accountDeletionRequest("first", {
    action: "request",
    confirmation: "DELETE MY ACCOUNT",
  });
  const rejected = expect(operation).rejects.toThrow(/account changed/);
  await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalled());
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith("builder-account", {
    body: { action: "request", confirmation: "DELETE MY ACCOUNT" },
    headers: { Authorization: "Bearer first-token" },
  });
  mock.current = session("second");
  response.resolve({
    data: { outcome: "requested", state: { request: null, reviews: [] } },
    error: null,
  });
  await rejected;
});
it("refuses account mismatches before invoking the deletion function", async () => {
  await expect(
    accountDeletionRequest("second", { action: "request" }),
  ).rejects.toThrow(/account changed/);
  expect(mock.invoke).not.toHaveBeenCalled();
});
it("treats an incomplete deletion response as unknown, without a retry", async () => {
  mock.invoke.mockResolvedValueOnce({
    data: { outcome: "deleted", state: { request: null, reviews: "bad" } },
    error: null,
  });
  await expect(
    accountDeletionRequest("first", { action: "finish" }),
  ).rejects.toThrow(/incomplete details/);
  expect(mock.invoke).toHaveBeenCalledTimes(1);
});
it("keeps thrown session failures bounded before a deletion request", async () => {
  mock.getSession.mockRejectedValueOnce(new Error("private session detail"));
  await expect(
    accountDeletionRequest("first", { action: "state" }),
  ).rejects.toThrow(/could not be checked/);
  expect(mock.invoke).not.toHaveBeenCalled();
});
