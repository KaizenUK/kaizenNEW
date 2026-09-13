// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: null as any,
  changed: undefined as any,
  signIn: vi.fn(),
  update: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("./storage", () => ({
  localMode: false,
  cloud: {
    auth: {
      getSession: async () => ({
        data: { session: mock.session },
        error: null,
      }),
      onAuthStateChange: (callback: any) => {
        mock.changed = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword: mock.signIn,
      updateUser: mock.update,
      resetPasswordForEmail: mock.reset,
      signOut: async () => mock.changed("SIGNED_OUT", null),
    },
  },
}));
vi.mock("./shell", () => ({ Brand: () => <span>Kaizen</span> }));
import BuilderAuth from "./BuilderAuth";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  history.replaceState(null, "", "/builder/");
  mock.session = null;
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
    error: new Error("Invalid login credentials"),
  });
  await submit();
  expect(host.textContent).toContain("Invalid login credentials");
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
  mock.update.mockResolvedValueOnce({
    error: new Error("Password update failed"),
  });
  await submit();
  expect(host.querySelector("[data-workspace]")).toBeNull();
  await submit();
  expect(mock.update).toHaveBeenLastCalledWith({
    password: "new-password-123",
    data: { builder_password_set: true, full_name: "Fixture Editor" },
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
      user: { email: "editor@example.test" },
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
