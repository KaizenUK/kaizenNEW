// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  client: vi.fn(),
  releases: vi.fn(),
  action: vi.fn(),
}));
vi.mock("./storage", () => ({
  storage: {
    clientPublication: mock.client,
    releases: mock.releases,
    releaseAction: mock.action,
  },
}));
vi.mock("./activeProject", () => ({ ProjectName: () => null }));
vi.mock("./RepositoryPublish", () => ({ default: () => null }));
vi.mock("./shell", () => ({
  Head: ({ title, children }: any) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
  Card: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Notice: ({ children }: any) => <div role="alert">{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
}));
import ClientPublications from "./ClientPublications";
import ReleasesPanel from "./ReleasesPanel";

const refusal =
  "This release is being removed or is no longer retained. Choose another release";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  for (const fn of Object.values(mock)) fn.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const buttons = (element: Element, name: string) =>
  [...element.querySelectorAll("button")].filter(
    (button) => button.textContent?.trim() === name,
  );
async function click(button: Element) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

it("offers client restoration only for kept releases and refreshes after a stale-screen refusal", async () => {
  const destination = {
    projectId: crypto.randomUUID(),
    destinationId: crypto.randomUUID(),
    environment: "production",
    origin: "https://client.example",
    label: "Client website",
  };
  const job = (name: string, active: boolean, availability: string) => ({
    id: crypto.randomUUID(),
    destination,
    action: "publish",
    phase: "live",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    previousReleaseId: null,
    artifactId: name,
    log: "",
    active,
    availability,
  });
  const jobs = [
    job("current", true, "retained"),
    job("kept", false, "retained"),
    job("going", false, "removing"),
    job("gone", false, "removed"),
  ];
  mock.client.mockImplementation(async (input: any) => {
    if (input.action === "client-release-list")
      return {
        destinations: [destination],
        jobs: structuredClone(jobs),
        currentJobs: [structuredClone(jobs[0])],
        nextCursor: null,
      };
    if (input.action === "client-release-review") {
      jobs[1].availability = "removed"; // retired after the screen loaded
      throw new Error(refusal);
    }
    throw new Error(`Unexpected ${input.action}`);
  });
  await act(async () => {
    root.render(<ClientPublications onChanged={() => {}} />);
  });
  const card = (index: number) =>
    host.querySelector(`[data-release-id="${jobs[index].id}"]`)!;
  await vi.waitFor(() => expect(card(3)).not.toBeNull());
  expect(buttons(card(1), "Review restoring this release")).toHaveLength(1);
  expect(card(2).textContent).toContain("Being removed to free space");
  expect(buttons(card(2), "Review restoring this release")).toHaveLength(0);
  expect(card(3).textContent).toContain("No longer kept");
  expect(buttons(card(3), "Review restoring this release")).toHaveLength(0);
  expect(buttons(card(0), "Review restoring this release")).toHaveLength(0);

  const lists = () =>
    mock.client.mock.calls.filter(
      ([input]) => input.action === "client-release-list",
    ).length;
  const before = lists();
  await click(buttons(card(1), "Review restoring this release")[0]);
  await vi.waitFor(() =>
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "no longer retained",
    ),
  );
  await vi.waitFor(() => expect(lists()).toBeGreaterThan(before));
  await vi.waitFor(() =>
    expect(card(1).textContent).toContain("No longer kept"),
  );
  expect(buttons(card(1), "Review restoring this release")).toHaveLength(0);
  expect(host.textContent).not.toContain("Review rollback");
});

it("hides native rollback for removed releases and reloads history when a queued rollback is refused", async () => {
  const row = (live: boolean, availability: string, day: number) => ({
    id: crypto.randomUUID(),
    action: "page",
    status: "live",
    live,
    createdAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
    updatedAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
    artifactId: `native-${day}`,
    previousReleaseId: null,
    rollbackOf: null,
    error: null,
    availability,
  });
  const rows = [
    row(true, "retained", 12),
    row(false, "retained", 11),
    row(false, "removed", 10),
  ];
  mock.releases.mockImplementation(async () => structuredClone(rows));
  mock.action.mockImplementation(async () => {
    rows[1].availability = "removed";
    throw new Error(refusal);
  });
  await act(async () => {
    root.render(
      <ReleasesPanel
        workspace={{ pages: [], assets: [], saved: [] }}
        onClose={() => {}}
      />,
    );
  });
  await vi.waitFor(() => expect(host.textContent).toContain("No longer kept"));
  expect(buttons(host, "Review rollback")).toHaveLength(1);
  await click(buttons(host, "Review rollback")[0]);
  await click(buttons(host, "Queue rollback")[0]);
  await vi.waitFor(() =>
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "no longer retained",
    ),
  );
  expect(buttons(host, "Review rollback")).toHaveLength(0);
  expect(buttons(host, "Queue rollback")).toHaveLength(0);
  expect(mock.releases.mock.calls.length).toBeGreaterThan(1);
});
