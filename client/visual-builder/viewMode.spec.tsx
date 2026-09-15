// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  local: false,
  changed: undefined as any,
  getSession: vi.fn(),
  invoke: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("./storage", () => ({
  get localMode() {
    return mock.local;
  },
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
vi.mock("./projectStorage", () => ({ activeProjectId: "garden" }));
vi.mock("./shell", () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  Notice: ({ children }: any) => <p role="status">{children}</p>,
}));
import {
  BuilderViewProvider,
  BuilderViewSettings,
  useBuilderViewMode,
  resolveViewMode,
  viewPreferenceKey,
} from "./viewMode";
const owner = { user: { id: "owner" }, access_token: "owner-token" };
const editor = { user: { id: "editor" }, access_token: "editor-token" };
const membership = (role: string, canPublish = false) => ({
  data: [{ id: "garden", access: { role, canPublish } }],
  error: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let host: HTMLDivElement, root: Root;
function Probe() {
  const view = useBuilderViewMode();
  return (
    <>
      <output data-mode>{view.mode}</output>
      <button onClick={() => view.choose("developer")}>
        Request developer view
      </button>
      <BuilderViewSettings />
    </>
  );
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.restoreAllMocks();
  localStorage.clear();
  mock.local = false;
  mock.unsubscribe.mockReset();
  mock.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: owner }, error: null });
  mock.invoke.mockReset().mockResolvedValue(membership("owner"));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = () =>
  act(async () => {
    root.render(
      <BuilderViewProvider>
        <Probe />
      </BuilderViewProvider>,
    );
  });
const mode = () => host.querySelector("[data-mode]")?.textContent;
const checkbox = () =>
  host.querySelector<HTMLInputElement>('input[type="checkbox"]');
const changeAccount = (session: any) =>
  act(async () => mock.changed(session ? "SIGNED_IN" : "SIGNED_OUT", session));

it("defaults owners and the local helper to developer, while unknown access and editors stay client", () => {
  expect(resolveViewMode("owner", null)).toBe("developer");
  expect(resolveViewMode("owner", "client")).toBe("client");
  expect(resolveViewMode("owner", "invalid")).toBe("developer");
  for (const role of ["editor", undefined, "admin", null]) {
    expect(resolveViewMode(role, "developer")).toBe("client");
  }
  expect(resolveViewMode(undefined, undefined, true)).toBe("developer");
  expect(resolveViewMode(undefined, "client", true)).toBe("client");
});
it("remembers an owner's choice without changing publishing or sending a mutation", async () => {
  await mount();
  expect(mode()).toBe("developer");
  expect(checkbox()?.checked).toBe(true);
  await act(async () => checkbox()!.click());
  expect(mode()).toBe("client");
  expect(localStorage.getItem(viewPreferenceKey("owner", "garden"))).toBe(
    "client",
  );
  expect(mock.invoke.mock.calls).toEqual([
    [
      "builder-projects",
      {
        body: { action: "list" },
        headers: { Authorization: "Bearer owner-token" },
      },
    ],
  ]);
  await act(async () => checkbox()!.click());
  expect(mode()).toBe("developer");
});
it.each([true, false])(
  "keeps editors in client view with canPublish=%s despite a stored or requested developer preference",
  async (publish) => {
    mock.getSession.mockResolvedValue({
      data: { session: editor },
      error: null,
    });
    mock.invoke.mockResolvedValue(membership("editor", publish));
    localStorage.setItem(viewPreferenceKey("editor", "garden"), "developer");
    await mount();
    expect(mode()).toBe("client");
    expect(checkbox()).toBeNull();
    await act(async () =>
      host.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(mode()).toBe("client");
  },
);
it("scopes preferences to the account and website, including another owner's default", async () => {
  localStorage.setItem(viewPreferenceKey("owner", "garden"), "client");
  localStorage.setItem(viewPreferenceKey("other", "another-website"), "client");
  await mount();
  expect(mode()).toBe("client");
  await changeAccount({
    ...owner,
    user: { id: "other" },
    access_token: "other-token",
  });
  expect(mode()).toBe("developer");
  await changeAccount(owner);
  expect(mode()).toBe("client");
});
it("keeps developer details hidden until membership is confirmed", async () => {
  const read = deferred<any>();
  mock.invoke.mockReturnValueOnce(read.promise);
  await mount();
  expect(mode()).toBe("client");
  expect(checkbox()).toBeNull();
  expect(host.textContent).toContain("Checking your project access");
  await act(async () => read.resolve(membership("owner")));
  expect(mode()).toBe("developer");
});
it("discards a late previous-owner response after switching to an editor", async () => {
  const read = deferred<any>();
  mock.invoke.mockReturnValueOnce(read.promise);
  await mount();
  mock.invoke.mockResolvedValue(membership("editor"));
  await changeAccount(editor);
  expect(mock.invoke).toHaveBeenLastCalledWith("builder-projects", {
    body: { action: "list" },
    headers: { Authorization: "Bearer editor-token" },
  });
  await act(async () => read.resolve(membership("owner")));
  expect(mode()).toBe("client");
  expect(checkbox()).toBeNull();
});
it("cannot restore an owner through a late initial session after sign-out", async () => {
  const read = deferred<any>();
  mock.getSession.mockReturnValueOnce(read.promise);
  await mount();
  await changeAccount(null);
  await act(async () =>
    read.resolve({ data: { session: owner }, error: null }),
  );
  expect(mode()).toBe("client");
  expect(mock.invoke).not.toHaveBeenCalled();
});
it("a project refresh during the initial session read does not leave access loading forever", async () => {
  const read = deferred<any>();
  mock.getSession.mockReturnValueOnce(read.promise);
  await mount();
  await act(async () =>
    window.dispatchEvent(new Event("builder-projects-changed")),
  );
  await act(async () =>
    read.resolve({ data: { session: owner }, error: null }),
  );
  expect(mode()).toBe("developer");
});
it.each(["builder-projects-changed", "focus"])(
  "rechecks membership on %s and discards older in-flight access",
  async (event) => {
    await mount();
    const read = deferred<any>();
    mock.invoke.mockReturnValueOnce(read.promise);
    await act(async () => window.dispatchEvent(new Event(event)));
    expect(mode()).toBe("client");
    mock.invoke.mockResolvedValue(membership("editor"));
    await act(async () => window.dispatchEvent(new Event(event)));
    await act(async () => read.resolve(membership("owner")));
    expect(mode()).toBe("client");
    expect(checkbox()).toBeNull();
  },
);
it.each([
  { data: [], error: null },
  { data: [{ id: "elsewhere", access: { role: "owner" } }], error: null },
  {
    data: [{ id: "garden", archived: true, access: { role: "owner" } }],
    error: null,
  },
  { data: null, error: { message: "Private upstream details" } },
  { data: {}, error: null },
])(
  "hides developer controls for absent, archived or unavailable project access %#",
  async (result) => {
    mock.invoke.mockResolvedValue(result);
    await mount();
    expect(mode()).toBe("client");
    expect(checkbox()).toBeNull();
    expect(host.textContent).toContain("could not be");
    expect(host.textContent).not.toContain("Private upstream details");
  },
);
it("handles rejected auth and membership reads without restoring developer details", async () => {
  mock.getSession.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(mode()).toBe("client");
  mock.invoke.mockRejectedValueOnce(new Error("Offline"));
  await changeAccount(owner);
  expect(mode()).toBe("client");
});
it("refreshes when a token or profile changes for the same account", async () => {
  await mount();
  await changeAccount({ ...owner, access_token: "refreshed-token" });
  expect(
    mock.invoke.mock.calls[mock.invoke.mock.calls.length - 1]?.[1].headers
      .Authorization,
  ).toBe("Bearer refreshed-token");
  await act(async () => mock.changed("USER_UPDATED", { ...owner }));
  expect(mode()).toBe("developer");
  expect(mock.invoke).toHaveBeenCalledTimes(3);
});
it("keeps a working in-memory choice when browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  await mount();
  await act(async () => checkbox()!.click());
  expect(mode()).toBe("client");
  expect(host.textContent).toContain("for this visit");
});
it("uses another tab's current preference, ignoring unrelated keys", async () => {
  await mount();
  localStorage.setItem(viewPreferenceKey("owner", "garden"), "client");
  await act(async () =>
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" })),
  );
  expect(mode()).toBe("developer");
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: viewPreferenceKey("owner", "garden"),
      }),
    ),
  );
  expect(mode()).toBe("client");
  localStorage.clear();
  await act(async () =>
    window.dispatchEvent(new StorageEvent("storage", { key: null })),
  );
  expect(mode()).toBe("developer");
});
it("retains the local developer path without fetching hosted account or membership data", async () => {
  mock.local = true;
  await mount();
  expect(mode()).toBe("developer");
  expect(mock.getSession).not.toHaveBeenCalled();
  expect(mock.invoke).not.toHaveBeenCalled();
  await act(async () => checkbox()!.click());
  expect(mode()).toBe("client");
});
