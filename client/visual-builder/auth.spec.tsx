// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: null as any,
  changed: undefined as any,
  getSession: vi.fn(),
  initialize: vi.fn(),
  recovery: undefined as string | undefined,
  signOut: vi.fn(),
  signIn: vi.fn(),
  update: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("./storage", () => ({
  localMode: false,
  cloud: {
    auth: {
      getSession: mock.getSession,
      initialize: mock.initialize,
      onAuthStateChange: (callback: any) => {
        mock.changed = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword: mock.signIn,
      resetPasswordForEmail: mock.reset,
      signOut: mock.signOut,
    },
  },
}));
vi.mock("./shell", () => ({ Brand: () => <span>Kaizen</span> }));
vi.mock("../lib/authRedirect", async (original) => {
  const actual = await original<typeof import("../lib/authRedirect")>();
  return {
    ...actual,
    initialAuthLink: () => actual.readAuthLink(location.href),
    passwordRecoveryAccount: () => mock.recovery,
    finishPasswordRecovery: () => {
      mock.recovery = undefined;
    },
  };
});
vi.mock("./accountAuth", () => ({
  AccountChangeError: class extends Error {
    code = "account_change_failed";
  },
  changeAccount: mock.update,
}));
import BuilderAuth from "./BuilderAuth";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  history.replaceState(null, "", "/builder/");
  mock.session = null;
  mock.recovery = undefined;
  mock.getSession.mockReset().mockImplementation(async () => ({
    data: { session: mock.session },
    error: null,
  }));
  mock.initialize.mockReset().mockResolvedValue({ error: null });
  mock.signOut.mockReset().mockImplementation(async () => {
    mock.session = null;
    mock.changed("SIGNED_OUT", null);
    return { error: null };
  });
  mock.signIn.mockReset().mockResolvedValue({ error: null });
  mock.update.mockReset().mockResolvedValue({ error: null });
  mock.reset.mockReset().mockResolvedValue({ error: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = () =>
  act(async () =>
    root.render(
      <BuilderAuth>
        <div data-workspace>Private workspace</div>
      </BuilderAuth>,
    ),
  );
async function fill(name: string, value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>(
      `input[name="${name}"]`,
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = () =>
  act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
it("keeps private content unmounted until sign-in and removes it on sign-out", async () => {
  await mount();
  expect(host.querySelector("[data-workspace]")).toBeNull();
  await fill("email", "editor@example.test");
  await fill("password", "test-password-123");
  mock.signIn.mockResolvedValueOnce({
    error: { code: "invalid_credentials", message: "private provider detail" },
  });
  await submit();
  expect(host.textContent).toContain(
    "email address and password did not match",
  );
  expect(host.textContent).not.toContain("private provider detail");
  expect(host.querySelector("[data-workspace]")).toBeNull();
  expect(mock.signIn).toHaveBeenCalledWith({
    email: "editor@example.test",
    password: "test-password-123",
  });
  await act(async () =>
    mock.changed("SIGNED_IN", {
      user: { id: "one", email: "editor@example.test" },
    }),
  );
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
  await act(async () => mock.changed("SIGNED_OUT", null));
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("requires matching passwords and a successful server update before opening an invited account", async () => {
  history.replaceState(null, "", "/builder/?password=setup");
  mock.session = {
    user: {
      id: "invited-fixture",
      email: "editor@example.test",
      user_metadata: { builder_password_set: false },
    },
  };
  await mount();
  await fill("full-name", "Fixture Editor");
  await fill("password", "new-password-123");
  await fill("confirmation", "different-password");
  await submit();
  expect(mock.update).not.toHaveBeenCalled();
  expect(host.textContent).toContain("do not match");
  await fill("confirmation", "new-password-123");
  mock.update.mockRejectedValueOnce({
    code: "weak_password",
    message: "private provider detail",
  });
  await submit();
  expect(host.querySelector("[data-workspace]")).toBeNull();
  await submit();
  expect(mock.update).toHaveBeenLastCalledWith("invited-fixture", {
    action: "setup-password",
    password: "new-password-123",
    confirmation: "new-password-123",
    name: "Fixture Editor",
  });
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
  expect(location.search).toBe("");
});
it("handles recovery while the password reset form is open", async () => {
  await mount();
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent === "Forgot password?")!
      .click(),
  );
  await fill("email", "editor@example.test");
  await submit();
  expect(mock.reset).toHaveBeenCalledWith("editor@example.test", {
    redirectTo: `${location.origin}/builder/?password=setup`,
  });
  await act(async () =>
    mock.changed("PASSWORD_RECOVERY", {
      user: { id: "recovering-fixture", email: "editor@example.test" },
    }),
  );
  expect(host.querySelector('input[name="password"]')).not.toBeNull();
  expect(host.querySelector("[data-workspace]")).toBeNull();
});

it("keeps an invited account closed until its owner supplies a valid name", async () => {
  mock.session = {
    user: {
      id: "invited-fixture",
      email: "editor@example.test",
      user_metadata: { builder_password_set: false },
    },
  };
  await mount();
  await fill("password", "new-password-123");
  await fill("confirmation", "new-password-123");
  for (const name of ["   ", "<not-a-git-author>"]) {
    await fill("full-name", name);
    await submit();
    expect(mock.update).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Add your name");
    expect(host.querySelector("[data-workspace]")).toBeNull();
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const member = (id = "member", invited = false) => ({
  user: {
    id,
    email: `${id}@example.test`,
    user_metadata: invited ? { builder_password_set: false } : {},
  },
});
const emit = (event: string, next: any) =>
  act(async () => {
    mock.session = next;
    mock.changed(event, next);
  });
const click = (text: string) =>
  act(async () => {
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === text)!
      .click();
  });
it.each([
  ["otp_expired", "invalid or has expired"],
  ["invite_not_found", "expired or already been used"],
  ["flow_state_expired", "sign-in link has expired"],
  ["flow_state_not_found", "used already or opened in a different browser"],
])(
  "explains an unavailable link (%s), removes callback details, and offers a new request",
  async (code, copy) => {
    history.replaceState(
      null,
      "",
      `/builder/?password=setup&project=kaizen#error=access_denied&error_code=${code}&error_description=private-provider-text`,
    );
    await mount();
    expect(host.textContent).toContain(copy);
    expect(host.textContent).not.toContain("private-provider-text");
    expect(host.querySelector("[data-workspace]")).toBeNull();
    expect(location.hash).toBe("");
    expect(new URLSearchParams(location.search).get("project")).toBe("kaizen");
    await click("Request a new password reset link");
    await fill("email", "editor@example.test");
    await submit();
    expect(mock.reset).toHaveBeenCalledExactlyOnceWith("editor@example.test", {
      redirectTo: `${location.origin}/builder/?password=setup&project=kaizen`,
    });
    expect(host.textContent).toContain("If this address has an account");
  },
);
it("does not claim a bookmarked setup URL has expired when it contained no link", async () => {
  history.replaceState(null, "", "/builder/?password=setup");
  await mount();
  expect(host.textContent).toContain("needs a fresh invitation or reset link");
  expect(host.textContent).not.toContain("has expired");
});
it.each(["otp_expired", "invite_not_found"])(
  "preserves an existing account after %s without offering to change its password",
  async (code) => {
    mock.session = member("existing");
    history.replaceState(
      null,
      "",
      `/builder/?password=setup#error=access_denied&error_code=${code}`,
    );
    await mount();
    expect(host.textContent).toContain(
      "still signed in as existing@example.test",
    );
    expect(host.querySelector('input[name="password"]')).toBeNull();
    expect(host.querySelector("[data-workspace]")).toBeNull();
    await emit("SIGNED_IN", member("existing"));
    expect(host.querySelector("[data-workspace]")).toBeNull();
    await click("Continue with this account");
    expect(host.querySelector("[data-workspace]")).not.toBeNull();
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.signOut).not.toHaveBeenCalled();
  },
);
it("needs a real recovery event before a setup URL can change a signed-in password", async () => {
  mock.session = member("existing");
  history.replaceState(null, "", "/builder/?password=setup");
  await mount();
  expect(host.querySelector('input[name="password"]')).toBeNull();
  await emit("PASSWORD_RECOVERY", member("recovered"));
  expect(host.textContent).toContain(
    "Choose a password for recovered@example.test",
  );
  expect(host.querySelector('input[name="password"]')).not.toBeNull();
});
it("remembers a recovery event emitted before the component mounted", async () => {
  mock.session = member("recovered");
  mock.recovery = "recovered";
  history.replaceState(null, "", "/builder/?password=setup");
  await mount();
  expect(host.textContent).toContain("Set your password");
  expect(host.textContent).not.toContain("needs a fresh");
});
it("does not apply an older recovery account to a different session", async () => {
  mock.session = member("different");
  mock.recovery = "old";
  history.replaceState(null, "", "/builder/?password=setup");
  await mount();
  expect(host.querySelector('input[name="password"]')).toBeNull();
  expect(host.textContent).toContain(
    "still signed in as different@example.test",
  );
});
it("lets a normal password sign-in recover from an unavailable link", async () => {
  history.replaceState(null, "", "/builder/#error_code=otp_expired");
  await mount();
  await fill("email", "member@example.test");
  await fill("password", "fixture-password");
  mock.signIn.mockImplementationOnce(async () => {
    mock.session = member();
    mock.changed("SIGNED_IN", mock.session);
    return { error: null };
  });
  await submit();
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
});
it("shows the unfinished invitation after a fresh sign-in until setup succeeds", async () => {
  await mount();
  await emit("SIGNED_IN", member("invited", true));
  expect(host.textContent).toContain("Set up your account");
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("does not relock confirmed setup when the shared session still has older profile metadata", async () => {
  mock.session = member("invited", true);
  await mount();
  await fill("full-name", "Invited person");
  await fill("password", "password-for-fixture");
  await fill("confirmation", "password-for-fixture");
  await submit();
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
  await emit("TOKEN_REFRESHED", member("invited", true));
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
});
it("discards an initial session that resolves after sign-out", async () => {
  const initial = deferred<any>();
  mock.getSession.mockReturnValueOnce(initial.promise);
  await mount();
  await emit("SIGNED_OUT", null);
  await act(async () =>
    initial.resolve({ data: { session: member("old") }, error: null }),
  );
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("discards an initial null session that resolves after a new account signs in", async () => {
  const initial = deferred<any>();
  mock.getSession.mockReturnValueOnce(initial.promise);
  await mount();
  await emit("SIGNED_IN", member());
  await act(async () =>
    initial.resolve({ data: { session: null }, error: null }),
  );
  expect(host.querySelector("[data-workspace]")).not.toBeNull();
});
it("keeps another invited account in setup after an older password response arrives", async () => {
  mock.session = member("first", true);
  const saved = deferred<any>();
  mock.update.mockReturnValueOnce(saved.promise);
  await mount();
  await fill("full-name", "First person");
  await fill("password", "fixture-first-password");
  await fill("confirmation", "fixture-first-password");
  await submit();
  await emit("SIGNED_IN", member("second", true));
  await act(async () => saved.resolve({ notice: "Old password saved" }));
  expect(host.textContent).toContain("second@example.test");
  expect(host.textContent).toContain("Set up your account");
  expect(
    host.querySelector<HTMLInputElement>('input[name="password"]')!.value,
  ).toBe("");
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("ignores a reset acknowledgement after recovery has opened another account", async () => {
  const sent = deferred<any>();
  mock.reset.mockReturnValueOnce(sent.promise);
  await mount();
  await click("Forgot password?");
  await fill("email", "editor@example.test");
  await submit();
  await emit("PASSWORD_RECOVERY", member("recovered"));
  await act(async () => sent.resolve({ error: null }));
  expect(host.textContent).toContain("recovered@example.test");
  expect(host.textContent).not.toContain("link has been requested");
});
it.each([
  ["email_not_confirmed", "email is not confirmed yet"],
  ["over_request_rate_limit", "Too many sign-in attempts"],
  ["user_banned", "Contact the website owner"],
  ["unexpected_failure", "Sign-in could not be confirmed"],
])("provides a safe next step for %s", async (code, message) => {
  await mount();
  await fill("email", "editor@example.test");
  await fill("password", "test-password");
  mock.signIn.mockResolvedValueOnce({
    error: { code, message: "private provider detail" },
  });
  await submit();
  expect(host.textContent).toContain(message);
  expect(host.textContent).not.toContain("private provider detail");
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("keeps a lost reset response unknown and never sends another email automatically", async () => {
  await mount();
  await click("Forgot password?");
  await fill("email", "editor@example.test");
  mock.reset.mockRejectedValueOnce(new Error("private network detail"));
  await submit();
  expect(host.textContent).toContain("may have sent an email");
  expect(host.textContent).not.toContain("private network detail");
  expect(mock.reset).toHaveBeenCalledTimes(1);
});
it("keeps initialization failures actionable without showing raw provider messages", async () => {
  mock.initialize.mockRejectedValueOnce(
    new Error("private initialization detail"),
  );
  await mount();
  expect(host.textContent).toContain("could not be checked");
  expect(host.textContent).not.toContain("private initialization detail");
});
it("does not silently open an existing workspace when checking a callback throws", async () => {
  history.replaceState(
    null,
    "",
    "/builder/?password=setup#error_code=otp_expired",
  );
  mock.getSession.mockRejectedValueOnce(new Error("private lookup detail"));
  await mount();
  await emit("INITIAL_SESSION", member("existing"));
  expect(host.textContent).toContain("This link could not be used");
  expect(host.textContent).not.toContain("private lookup detail");
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
it("leaves a newer invitation open after an older sign-out promise completes", async () => {
  mock.session = member("first", true);
  const ended = deferred<any>();
  mock.signOut.mockReturnValueOnce(ended.promise);
  await mount();
  await click("Sign out");
  await emit("SIGNED_OUT", null);
  await emit("SIGNED_IN", member("second", true));
  await act(async () => ended.resolve({ error: null }));
  expect(host.textContent).toContain("Set up your account");
  expect(host.textContent).toContain("second@example.test");
  expect(host.querySelector("[data-workspace]")).toBeNull();
});
