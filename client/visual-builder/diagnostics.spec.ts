import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProblemReport,
  classifyDiagnosticError,
  safeDiagnosticError,
} from "../../shared/builderDiagnostics";
import {
  clearDiagnostics,
  diagnosticPage,
  setDiagnosticPage,
  lastDiagnosticError,
  recordBuilderError,
  subscribeDiagnosticErrors,
  trackStorageErrors,
  watchBrowserErrors,
} from "./diagnostics";

afterEach(() => {
  clearDiagnostics();
  vi.unstubAllGlobals();
});
describe("safe problem reports", () => {
  const now = new Date("2026-09-12T12:00:00Z");
  it("keeps the failing page when the user leaves the editor to report it, and clears it on account change", async () => {
    setDiagnosticPage({ screen: "website-editor", route: "/about/" });
    recordBuilderError(new Error("Build failed"), "helper");
    setDiagnosticPage({ screen: "pages" });
    setDiagnosticPage({ screen: "settings" });
    expect(
      (
        await buildProblemReport({
          page: diagnosticPage(),
          lastError: lastDiagnosticError(),
        })
      ).page.screen,
    ).toBe("website-editor");
    clearDiagnostics();
    expect(diagnosticPage()).toEqual({ screen: "pages" });
    expect(lastDiagnosticError()).toBeNull();
  });
  it("copies identifiers and known states without serialising arbitrary input, URLs, browser strings or errors", async () => {
    const secret = "private-key-must-never-appear";
    const report = await buildProblemReport(
      {
        projectId: "kaizen",
        projectName: secret,
        access_token: secret,
        page: {
          screen: "website-editor",
          route: `/about/${secret}?token=${secret}#${secret}`,
          title: secret,
        },
        userAgent: `Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36 Edg/141.0.0.0 ${secret}`,
        helper: {
          local: false,
          status: "connected",
          root: `/home/${secret}`,
          origin: `https://local/?token=${secret}`,
          token: secret,
        },
        lastError: {
          ...classifyDiagnosticError(
            new Error(`Build failed: Bearer ${secret}`),
            "helper",
            now,
          ),
          summary: secret,
          stack: secret,
          key: secret,
        },
      } as any,
      now,
    );
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(report.projectId).toBe("kaizen");
    expect(report.page.routeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.browser).toEqual({
      family: "Edge",
      majorVersion: 141,
      platform: "Windows",
    });
    expect(report.lastError).toEqual({
      category: "build",
      source: "helper",
      summary: "The website build or preview failed.",
      at: now.toISOString(),
    });
    expect(report.helper).toEqual({ mode: "hosted", status: "connected" });
  });
  it("rejects malicious field types rather than coercing and copying them", async () => {
    const trick = (label: string) => ({
      token: "never-copy",
      toString: () => label,
    });
    const report = await buildProblemReport(
      {
        projectId: "never-copy",
        page: { screen: trick("pages"), id: "never-copy" },
        helper: { status: trick("connected") },
        lastError: {
          category: "network",
          source: trick("workspace"),
          summary: "never-copy",
          at: now.toISOString(),
        },
      },
      now,
    );
    expect(JSON.stringify(report)).not.toContain("never-copy");
    expect(report.page).toEqual({
      screen: "unknown",
      id: null,
      routeHash: null,
    });
    expect(report.lastError?.source).toBe("browser");
    expect(report.helper.status).toBe("disconnected");
    expect(
      safeDiagnosticError({ category: "network", at: "never-copy" }),
    ).toBeNull();
  });
  it("identifies builder pages directly and hashes source routes consistently without queries", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      (
        await buildProblemReport(
          { page: { screen: "page-editor", id }, helper: { local: true } },
          now,
        )
      ).page.id,
    ).toBe(id);
    expect(
      (await buildProblemReport({ page: { route: "/about/?token=one" } }, now))
        .page.routeHash,
    ).toBe(
      (await buildProblemReport({ page: { route: "/about/#token-two" } }, now))
        .page.routeHash,
    );
  });
  it.each([
    ["Failed to fetch token=secret", "network"],
    ["Session expired", "session"],
    ["Permission denied", "access"],
    ["Changed in another window", "conflict"],
    ["Unexpected secret", "unknown"],
  ])("classifies %s without keeping its contents", (message, category) => {
    expect(
      classifyDiagnosticError(new Error(message), "workspace", now).category,
    ).toBe(category);
    expect(JSON.stringify(classifyDiagnosticError(message))).not.toContain(
      "secret",
    );
  });
  it("records caught storage failures while preserving the original error and successful return value", async () => {
    const error = new Error("Build failed: secret-key");
    const listener = vi.fn(),
      stop = subscribeDiagnosticErrors(listener);
    const api = trackStorageErrors({
      repository: async () => {
        throw error;
      },
      load: async () => ({ pages: [] }),
    });
    await expect(api.load()).resolves.toEqual({ pages: [] });
    expect(lastDiagnosticError()).toBeNull();
    await expect(api.repository()).rejects.toBe(error);
    expect(lastDiagnosticError()?.source).toBe("helper");
    expect(JSON.stringify(listener.mock.calls)).not.toContain("secret-key");
    stop();
    recordBuilderError(error);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("observes browser failures without suppressing them and removes listeners on cleanup", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const stop = watchBrowserErrors();
    const event = new Event("error", { cancelable: true });
    Object.assign(event, { error: new Error("Network token=secret") });
    target.dispatchEvent(event);
    expect(lastDiagnosticError()?.category).toBe("network");
    expect(event.defaultPrevented).toBe(false);
    stop();
    clearDiagnostics();
    target.dispatchEvent(event);
    expect(lastDiagnosticError()).toBeNull();
  });
});
