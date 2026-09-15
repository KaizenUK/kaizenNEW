// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: {
    user: { id: "fixture-one" },
    access_token: "fixture-token",
  } as any,
  signup: vi.fn(),
  resend: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./storage", () => ({
  cloud: {
    auth: {
      signUp: mock.signup,
      resend: mock.resend,
      getSession: async () => ({
        data: { session: mock.session },
        error: null,
      }),
      signOut: mock.signOut,
    },
    functions: { invoke: mock.invoke },
  },
}));
vi.mock("./shell", () => ({ Brand: () => <span>Kaizen</span> }));
import BuilderSignup from "./BuilderSignup";
import BuilderFirstProjectGate from "./BuilderFirstProjectGate";
import {
  signupNotice,
  firstProjectRedirect,
  signupRedirect,
  isBuilderAccountStart,
} from "../../shared/builderSignup";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  history.replaceState(null, "", "/builder/?project=kaizen");
  mock.session = { user: { id: "fixture-one" }, access_token: "fixture-token" };
  mock.signup
    .mockReset()
    .mockResolvedValue({ data: { session: null }, error: null });
  mock.resend.mockReset().mockResolvedValue({ error: null });
  mock.invoke.mockReset().mockResolvedValue({
    data: { created: false, projectId: "kaizen" },
    error: null,
  });
  mock.signOut.mockReset().mockResolvedValue({ error: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;
const click = (element: HTMLElement) => act(async () => element.click());
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
async function mountSignup() {
  await act(async () =>
    root.render(
      <BuilderSignup
        initialEmail="new@example.test"
        onBack={() => void root.render(<p>Sign in</p>)}
      />,
    ),
  );
}
async function fields() {
  await fill("full-name", "Fixture New User");
  await fill("password", "fixture-new-password");
  await fill("confirmation", "fixture-new-password");
}
const submit = () =>
  act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
const mountGate = (id = "fixture-one") =>
  act(async () =>
    root.render(
      <StrictMode>
        <BuilderFirstProjectGate key={id} accountId={id}>
          <p data-private>Workspace</p>
        </BuilderFirstProjectGate>
      </StrictMode>,
    ),
  );

it("validates names and password confirmation before requesting an account", async () => {
  await mountSignup();
  await fields();
  await fill("full-name", "<invalid>");
  await submit();
  expect(mock.signup).not.toHaveBeenCalled();
  await fill("full-name", "Fixture New User");
  await fill("confirmation", "different-password");
  await submit();
  expect(host.textContent).toContain("passwords do not match");
  expect(mock.signup).not.toHaveBeenCalled();
});
it.each([null, "user_already_exists", "email_exists"])(
  "gives the same neutral signup outcome for provider error %s",
  async (code) => {
    mock.signup.mockResolvedValue({
      error: code ? { code, message: "Private provider detail" } : null,
    });
    await mountSignup();
    await fields();
    await submit();
    expect(host.textContent).toContain(signupNotice);
    expect(host.textContent).not.toContain("Private provider detail");
    expect(host.querySelector('input[type="password"]')).toBeNull();
    expect(mock.signup).toHaveBeenCalledWith({
      email: "new@example.test",
      password: "fixture-new-password",
      options: {
        data: { full_name: "Fixture New User" },
        emailRedirectTo: new URL("/builder/", location.href).href,
      },
    });
    expect(mock.invoke).not.toHaveBeenCalled();
  },
);
it("prevents duplicate pending submissions and ignores an outcome after leaving", async () => {
  let release!: (value: any) => void;
  mock.signup.mockImplementation(
    () => new Promise((resolve) => (release = resolve)),
  );
  await mountSignup();
  await fields();
  await submit();
  await submit();
  expect(mock.signup).toHaveBeenCalledTimes(1);
  await click(button("Back to sign in"));
  await act(async () => release({ error: null }));
  expect(host.textContent).toBe("Sign in");
});
it("mounts the workspace only after a validated account-bound bootstrap response", async () => {
  await mountGate();
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(mock.invoke).toHaveBeenCalledWith("builder-projects", {
    body: { action: "bootstrap" },
    headers: { Authorization: "Bearer fixture-token" },
  });
  expect(host.querySelector("[data-private]")).not.toBeNull();
});
it("rejects incomplete bootstrap state, then retries its persisted outcome", async () => {
  mock.invoke.mockResolvedValueOnce({
    data: { created: true, projectId: null },
    error: null,
  });
  await mountGate();
  expect(host.querySelector("[data-private]")).toBeNull();
  await click(button("Retry"));
  expect(host.querySelector("[data-private]")).not.toBeNull();
});
it("discards an old account result after a switch while keeping the new account gated", async () => {
  let release!: (value: any) => void;
  mock.invoke.mockImplementationOnce(
    () => new Promise((resolve) => (release = resolve)),
  );
  await mountGate();
  mock.session = { user: { id: "fixture-two" }, access_token: "second-token" };
  mock.invoke.mockResolvedValueOnce({ data: { bad: true }, error: null });
  await mountGate("fixture-two");
  await act(async () =>
    release({ data: { created: false, projectId: "kaizen" }, error: null }),
  );
  expect(host.querySelector("[data-private]")).toBeNull();
});
it("lets an account leave during a pending bootstrap without opening from its late reply", async () => {
  let release!: (value: any) => void;
  mock.invoke.mockImplementationOnce(
    () => new Promise((resolve) => (release = resolve)),
  );
  await mountGate();
  await click(button("Sign out"));
  expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  await act(async () =>
    release({ data: { created: false, projectId: "kaizen" }, error: null }),
  );
  expect(host.querySelector("[data-private]")).toBeNull();
});
it("uses the canonical confirmation URL and changes project context by document navigation", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(
    signupRedirect(
      "https://fixture.test/builder/?next=https://attacker.test#access_token=fixture",
    ),
  ).toBe("https://fixture.test/builder/");
  expect(
    firstProjectRedirect("https://fixture.test/builder/", {
      created: true,
      projectId: id,
    }),
  ).toBe(`https://fixture.test/builder/?project=${id}`);
  expect(
    firstProjectRedirect("https://fixture.test/builder/?project=kaizen", {
      created: false,
      projectId: id,
    }),
  ).toBeNull();
  expect(
    firstProjectRedirect("https://fixture.test/builder/?project=", {
      created: true,
      projectId: id,
    }),
  ).toBe(`https://fixture.test/builder/?project=${id}`);
  expect(
    isBuilderAccountStart({
      created: true,
      projectId: "https://attacker.test",
    }),
  ).toBe(false);
});
