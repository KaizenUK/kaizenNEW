// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ list: vi.fn(), request: vi.fn() }));
vi.mock("./projectStorage", () => ({
  activeProjectId: "source",
  listProjects: mock.list,
  cachedProjects: mock.list,
  projectRequest: mock.request,
}));
vi.mock("./ProjectMembers", () => ({ default: () => null }));
vi.mock("./shell", () => ({
  Head: () => <h1>Projects</h1>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Notice: ({ children, action }: any) => (
    <div role="alert">
      {children}
      {action}
    </div>
  ),
}));
import ProjectsView from "./ProjectsView";
const source = {
  id: "source",
  name: "Source",
  version: 1,
  archived: false,
  destination: { label: "Not configured" },
  access: { role: "owner" },
};
const pending = {
  ...source,
  id: "copy",
  name: "Source copy",
  copy: { pending: true, canResume: true, files: 7, copied: 3 },
};
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.list.mockReset().mockResolvedValue([source]);
  mock.request.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = () => act(async () => root.render(<ProjectsView />));
const button = (name: string, card = "Source") =>
  [
    ...host.querySelectorAll<HTMLButtonElement>(
      `article[aria-label="${card}"] button`,
    ),
  ].find((item) => item.textContent === name)!;
const click = (name: string, card?: string) =>
  act(async () => button(name, card).click());

it("continues bounded copy batches automatically using the returned destination", async () => {
  mock.request
    .mockResolvedValueOnce(pending)
    .mockResolvedValueOnce({ ...pending, copy: { ...pending.copy, copied: 6 } })
    .mockResolvedValueOnce({ ...pending, copy: undefined });
  await mount();
  await click("Duplicate");
  expect(mock.request.mock.calls.map(([input]) => input.action)).toEqual([
    "duplicate",
    "duplicate-resume",
    "duplicate-resume",
  ]);
  expect(mock.request.mock.calls[0][0]).toMatchObject({
    id: "source",
    name: "Source copy",
    requestId: expect.stringMatching(/^[a-f0-9-]{36}$/),
  });
  expect(mock.request.mock.calls[1][0]).toEqual({
    action: "duplicate-resume",
    id: "copy",
  });
});

it("confirms copy cancellation and returns keyboard focus when keeping the copy", async () => {
  mock.list.mockResolvedValue([source, pending]);
  await mount();
  await click("Cancel copy", "Source copy");
  const panel = host.querySelector<HTMLElement>(
    '[aria-label="Cancel copy of Source copy"]',
  )!;
  expect(document.activeElement).toBe(panel);
  expect(panel.textContent).toContain("The original website will be kept");
  expect(mock.request).not.toHaveBeenCalled();
  await act(async () =>
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.activeElement).toBe(button("Cancel copy", "Source copy"));
  expect(
    host.querySelector('[aria-label="Cancel copy of Source copy"]'),
  ).toBeNull();
});

it("can cancel an active copy and stops further batches after an in-flight request fails", async () => {
  let rejectBatch!: (error: Error) => void;
  mock.request
    .mockResolvedValueOnce(pending)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectBatch = reject;
        }),
    )
    .mockResolvedValueOnce({
      projectId: pending.id,
      cancelled: true,
      cleanupPending: true,
    });
  await mount();
  await click("Duplicate");
  expect(button("Resume copy", "Source copy").disabled).toBe(true);
  expect(button("Cancel copy", "Source copy").disabled).toBe(false);
  await click("Cancel copy", "Source copy");
  mock.list.mockResolvedValue([
    source,
    {
      ...pending,
      archived: true,
      copy: { ...pending.copy, canResume: false, cancelling: true },
    },
  ]);
  await click("Confirm cancellation", "Source copy");
  await act(async () => rejectBatch(new Error("This upload was cancelled")));
  expect(mock.request.mock.calls.map(([input]) => input.action)).toEqual([
    "duplicate",
    "duplicate-resume",
    "duplicate-cancel",
  ]);
  expect(mock.request.mock.calls[2][0]).toEqual({
    action: "duplicate-cancel",
    id: "copy",
    version: 1,
    confirm: true,
  });
  expect(host.textContent).toContain(
    "Storage remains in use until cleanup finishes",
  );
  expect(host.textContent).not.toContain("This upload was cancelled");
  expect(button("Resume copy", "Source copy")).toBeUndefined();
  expect(button("Restore project", "Source copy")).toBeUndefined();
  expect(button("Duplicate", "Source copy")).toBeUndefined();
  expect(host.querySelector('article[aria-label="Source copy"] a')).toBeNull();
});

it("offers cancellation only to an unfinished copy's owner", async () => {
  mock.list.mockResolvedValue([
    source,
    { ...pending, access: { role: "editor" } },
  ]);
  await mount();
  expect(button("Cancel copy", "Source copy")).toBeUndefined();
  expect(button("Cancel copy", "Source")).toBeUndefined();
});

it("shows a lost-response copy and resumes it without allocating a second website", async () => {
  mock.request.mockRejectedValueOnce(
    new Error("The copy paused. Resume this copy."),
  );
  await mount();
  mock.list.mockResolvedValue([source, pending]);
  await click("Duplicate");
  expect(host.textContent).toContain("3 of 7 files copied");
  expect(host.querySelector('article[aria-label="Source copy"] a')).toBeNull();
  expect(button("Duplicate", "Source copy").disabled).toBe(true);
  mock.request.mockResolvedValue({ ...pending, copy: undefined });
  await click("Resume copy", "Source copy");
  expect(mock.request.mock.calls[1][0]).toEqual({
    action: "duplicate-resume",
    id: "copy",
  });
});

it("reuses the request identity when the original duplicate button is retried after a lost response", async () => {
  mock.request.mockRejectedValue(new Error("Connection interrupted"));
  await mount();
  await click("Duplicate");
  await click("Duplicate");
  expect(mock.request.mock.calls[1][0].requestId).toBe(
    mock.request.mock.calls[0][0].requestId,
  );
});

it("keeps unfinished copies visible after reload and only enables resume for the original account", async () => {
  mock.list.mockResolvedValue([
    source,
    { ...pending, copy: { ...pending.copy, canResume: false } },
  ]);
  await mount();
  expect(button("Resume copy", "Source copy").disabled).toBe(true);
  expect(host.textContent).toContain(
    "The account that started this copy must resume it",
  );
  expect(mock.request).not.toHaveBeenCalled();
});

it("does not start another copy batch after the Projects screen is closed", async () => {
  let finish!: (value: any) => void;
  mock.request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await click("Duplicate");
  await act(async () => root.unmount());
  await act(async () => finish(pending));
  expect(mock.request).toHaveBeenCalledTimes(1);
});
