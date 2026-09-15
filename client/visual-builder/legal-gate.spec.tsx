// @vitest-environment jsdom
import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  session: {
    user: { id: "fixture-one" },
    access_token: "fixture-token",
  } as any,
  invoke: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./storage", () => ({
  cloud: {
    auth: {
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
import BuilderLegalGate from "./BuilderLegalGate";
import {
  BUILDER_LEGAL,
  type BuilderLegalState,
} from "../../shared/builderLegal";
let root: Root, host: HTMLDivElement;
const legal = (acceptedAt: string | null = null) => ({
  ...BUILDER_LEGAL,
  acceptedAt,
});
const reply = (value: BuilderLegalState = legal()) => ({
  data: { legal: value },
  error: null,
});
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.session = { user: { id: "fixture-one" }, access_token: "fixture-token" };
  mock.invoke.mockReset().mockResolvedValue(reply());
  mock.signOut.mockReset().mockResolvedValue({ error: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = (id = "fixture-one") =>
  act(async () =>
    root.render(
      <StrictMode>
        <BuilderLegalGate key={id} accountId={id}>
          <div data-private>Workspace</div>
        </BuilderLegalGate>
      </StrictMode>,
    ),
  );
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;
const click = (element: HTMLElement) => act(async () => element.click());
it("keeps the workspace unmounted until explicit, server-confirmed acceptance of exact documents", async () => {
  await mount();
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[data-private]")).toBeNull();
  expect(button("Accept and open Builder").disabled).toBe(true);
  expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(
    [...host.querySelectorAll("a")].map((a) => a.getAttribute("href")),
  ).toContain(BUILDER_LEGAL.termsUrl);
  await click(host.querySelector("input")!);
  mock.invoke.mockResolvedValueOnce(reply(legal("2026-09-14T12:00:00Z")));
  await click(button("Accept and open Builder"));
  expect(mock.invoke).toHaveBeenLastCalledWith("builder-account", {
    body: {
      action: "legal-accept",
      version: BUILDER_LEGAL.version,
      termsHash: BUILDER_LEGAL.termsHash,
      privacyHash: BUILDER_LEGAL.privacyHash,
      confirmed: true,
    },
    headers: { Authorization: "Bearer fixture-token" },
  });
  expect(host.querySelector("[data-private]")).not.toBeNull();
});
it("opens a previously accepted account without creating another acceptance", async () => {
  mock.invoke.mockResolvedValue(reply(legal("2026-09-14T12:00:00Z")));
  await mount();
  expect(host.querySelector("[data-private]")).not.toBeNull();
  expect(mock.invoke).toHaveBeenCalledTimes(1);
  expect(mock.invoke.mock.calls[0][1].body.action).toBe("legal-state");
});
it("recovers an unknown acceptance outcome by reading its persisted state", async () => {
  await mount();
  await click(host.querySelector("input")!);
  mock.invoke.mockRejectedValueOnce(new Error("private provider detail"));
  await click(button("Accept and open Builder"));
  expect(host.querySelector("[data-private]")).toBeNull();
  expect(host.textContent).toContain("Refresh to check its status");
  expect(host.textContent).not.toContain("private provider detail");
  mock.invoke.mockResolvedValueOnce(reply(legal("2026-09-14T12:00:00Z")));
  await click(button("Refresh documents"));
  expect(host.querySelector("[data-private]")).not.toBeNull();
});
it("rejects a newer document version even when its server acceptance exists", async () => {
  mock.invoke.mockResolvedValue(
    reply({
      ...legal("2026-09-15T12:00:00Z"),
      version: "2026-09-15",
      termsUrl: "/builder/legal/2026-09-15/terms/",
      privacyUrl: "/builder/legal/2026-09-15/privacy/",
    }),
  );
  await mount();
  expect(host.querySelector("[data-private]")).toBeNull();
  expect(button("Accept and open Builder").disabled).toBe(true);
  expect(button("Reload Builder")).toBeDefined();
});
it("discards an acceptance response after the authenticated account changes", async () => {
  let release!: (value: any) => void;
  mock.invoke.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await mount();
  mock.session = {
    user: { id: "fixture-two" },
    access_token: "fixture-two-token",
  };
  await mount("fixture-two");
  await act(async () => release(reply(legal("2026-09-14T12:00:00Z"))));
  expect(host.querySelector("[data-private]")).toBeNull();
  expect(host.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
});
it("allows sign-out during a pending read and never opens from its late result", async () => {
  let release!: (value: any) => void;
  mock.invoke.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await mount();
  await click(button("Sign out"));
  expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  await act(async () => release(reply(legal("2026-09-14T12:00:00Z"))));
  expect(host.querySelector("[data-private]")).toBeNull();
});
it("fails closed for incomplete persisted state and can retry the document read", async () => {
  mock.invoke.mockResolvedValueOnce({
    data: {
      legal: {
        version: BUILDER_LEGAL.version,
        acceptedAt: "2026-09-14T12:00:00Z",
      },
    },
    error: null,
  });
  await mount();
  expect(host.querySelector("[data-private]")).toBeNull();
  await click(button("Refresh documents"));
  expect(host.querySelector<HTMLInputElement>("input")!.disabled).toBe(false);
});
