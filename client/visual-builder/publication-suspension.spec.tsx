// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("./storage", () => ({
  storage: { clientPublication: mock.client },
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

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mock.client.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (name: string) =>
  [...host.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === name,
  )!;

it.each([
  ["suspended", "Publishing is paused for this website"],
  ["taken_down", "This website has been taken offline"],
] as const)(
  "explains a %s website and keeps only taking it offline available",
  async (state, message) => {
    const destination = {
      projectId: crypto.randomUUID(),
      destinationId: crypto.randomUUID(),
      environment: "production",
      origin: "https://client.example",
      label: "Client website",
    };
    const earlier = {
      id: crypto.randomUUID(),
      destination,
      action: "publish",
      phase: "live",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      previousReleaseId: null,
      artifactId: "earlier",
      log: "",
      active: false,
      availability: "retained",
    };
    mock.client.mockResolvedValue({
      destinations: [destination],
      jobs: [earlier],
      currentJobs: [],
      nextCursor: null,
      suspension: { state, since: new Date().toISOString() },
    });
    await act(async () => {
      root.render(<ClientPublications onChanged={() => {}} />);
    });
    await vi.waitFor(() =>
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        message,
      ),
    );
    expect(host.textContent).toContain("drafts and files are kept");
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = destination.destinationId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Review saved project for publication").disabled).toBe(true);
    expect(button("Review restoring this release").disabled).toBe(true);
    expect(button("Take website offline…").disabled).toBe(false);
  },
);
