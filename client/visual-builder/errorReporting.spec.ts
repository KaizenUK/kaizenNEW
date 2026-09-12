import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startErrorReporting } from "./errorReporting";
import {
  clearDiagnostics,
  recordBuilderError,
  setDiagnosticPage,
} from "./diagnostics";
import {
  buildProblemReport,
  classifyDiagnosticError,
} from "../../shared/builderDiagnostics";
import { recordClientDiagnostic } from "../../supabase/functions/_shared/clientDiagnostics";

const project = "11111111-1111-4111-8111-111111111111";
const identity = (id: string) => ({
  user: { id },
  access_token: `${id}-private-token`,
});
const stops: (() => void)[] = [];
function fixture(
  session: ReturnType<typeof identity> | null = identity("owner"),
) {
  let listener: (event: string, session: any) => void = () => {};
  const invoke = vi
    .fn()
    .mockResolvedValue({ data: { recorded: true }, error: null });
  const unsubscribe = vi.fn();
  const getSession = vi.fn().mockResolvedValue({ data: { session } });
  const client = {
    auth: {
      getSession,
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe } } };
      },
    },
    functions: { invoke },
  } as unknown as SupabaseClient;
  const begin = (projectId = project) => {
    const stop = startErrorReporting(client, {
      projectId,
      userAgent: "Chrome/130.0 Linux private-UA-suffix",
      helper: () => ({ local: false, status: "connected" }),
    });
    stops.push(stop);
    return stop;
  };
  return {
    begin,
    invoke,
    unsubscribe,
    getSession,
    auth: (session: ReturnType<typeof identity> | null) =>
      listener("SIGNED_IN", session),
  };
}
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  clearDiagnostics();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("best-effort hosted error reporting", () => {
  it("sends only safe report fields with the captured account token and never a body-supplied user ID", async () => {
    const api = fixture();
    api.begin();
    await Promise.resolve();
    setDiagnosticPage({
      screen: "website-editor",
      route: "/about/?token=private-route-token",
    });
    recordBuilderError(new Error("Build failed private-error-token"), "helper");
    await vi.waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    const [name, options] = api.invoke.mock.calls[0];
    expect(name).toBe("builder-projects");
    expect(options.headers.Authorization).toBe("Bearer owner-private-token");
    expect(options.body).toMatchObject({
      action: "record-error",
      projectId: project,
      report: {
        page: { screen: "website-editor" },
        lastError: { source: "helper", category: "build" },
      },
    });
    expect(options.body.report.page.routeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(options.body)).not.toMatch(
      /private-|\/about\/|userId/,
    );
  });
  it("drops reports across account changes and sign-out while route hashing is pending", async () => {
    const api = fixture();
    api.begin();
    await Promise.resolve();
    let finish: (value: ArrayBuffer) => void = () => {};
    vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    setDiagnosticPage({ screen: "website-editor", route: "/about/" });
    recordBuilderError("Network failed");
    api.auth(identity("new-owner"));
    finish(new ArrayBuffer(32));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.invoke).not.toHaveBeenCalled();
    recordBuilderError("Network failed");
    await vi.waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    expect(api.invoke.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer new-owner-private-token",
    );
    api.auth(null);
    recordBuilderError("Build failed");
    expect(api.invoke).toHaveBeenCalledTimes(1);
  });
  it("does not revive an old initial session after a newer sign-out event", async () => {
    const api = fixture();
    let finish: (value: any) => void = () => {};
    api.getSession.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    api.begin();
    api.auth(null);
    finish({ data: { session: identity("old-owner") } });
    await Promise.resolve();
    recordBuilderError("Network failed");
    expect(api.invoke).not.toHaveBeenCalled();
  });
  it("deduplicates repeated errors and limits attempts even when the sink rejects them", async () => {
    const api = fixture();
    api.invoke.mockRejectedValue(new Error("Network private-sink-token"));
    api.begin();
    await Promise.resolve();
    recordBuilderError("Build failed");
    recordBuilderError("Build failed");
    await vi.waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    for (let index = 1; index < 25; index++) {
      setDiagnosticPage({ screen: "page-editor", id: String(index) });
      recordBuilderError("Access denied");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(api.invoke).toHaveBeenCalledTimes(20);
  });
  it("cancels slow sends, allows later distinct errors, and removes listeners on cleanup", async () => {
    vi.useFakeTimers();
    const api = fixture();
    api.invoke.mockImplementation(
      (_name, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          ),
        ),
    );
    const stop = api.begin();
    await Promise.resolve();
    recordBuilderError("Network failed");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.invoke).toHaveBeenCalledTimes(1);
    expect(api.invoke.mock.calls[0][1].signal.aborted).toBe(true);
    recordBuilderError("Build failed");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.invoke).toHaveBeenCalledTimes(2);
    stop();
    expect(api.invoke.mock.calls[1][1].signal.aborted).toBe(true);
    recordBuilderError("Access denied");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.invoke).toHaveBeenCalledTimes(2);
    expect(api.unsubscribe).toHaveBeenCalled();
  });
  it("does not send for unsigned-in or malformed project contexts", async () => {
    const anon = fixture(null);
    anon.begin();
    await Promise.resolve();
    recordBuilderError("Network failed");
    const invalid = fixture();
    invalid.begin("../private-token");
    await Promise.resolve();
    recordBuilderError("Build failed");
    expect(anon.invoke).not.toHaveBeenCalled();
    expect(invalid.invoke).not.toHaveBeenCalled();
  });
});

describe("projects function diagnostic action", () => {
  it("uses verified actor/project arguments and normalizes every field before the service call", async () => {
    const report = await buildProblemReport({
      lastError: classifyDiagnosticError("Build failed", "helper"),
    });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const result = await recordClientDiagnostic(
      { rpc },
      project,
      "verified-actor",
      {
        ...report,
        projectId: "spoofed-project",
        userId: "spoofed-actor",
        token: "private-token",
        page: {
          id: "private-token",
          routeHash: "private-token",
          screen: "private-token",
        },
        browser: {
          family: { toString: () => "Chrome", secret: "private-token" },
          majorVersion: 10000,
          platform: "private-token",
        },
        helper: { mode: "private-token", status: "private-token" },
        lastError: {
          ...report.lastError,
          summary: "private-token",
          stack: "private-token",
        },
      },
    );
    expect(result).toEqual({ status: 200, body: { recorded: true } });
    expect(rpc.mock.calls[0]).toMatchObject([
      "builder_record_client_error",
      {
        target: project,
        actor: "verified-actor",
        diagnostic: {
          category: "build",
          source: "helper",
          page_id: null,
          route_hash: null,
          screen: "unknown",
          browser_family: "Other",
          browser_version: null,
        },
      },
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/private-token|spoofed/);
  });
  it("rejects absent reports and reports without errors before contacting the sink", async () => {
    const rpc = vi.fn();
    for (const input of [
      null,
      {},
      { schemaVersion: 1, lastError: null },
      { schemaVersion: 1, lastError: { at: "private-token" } },
    ])
      expect(
        (await recordClientDiagnostic({ rpc }, project, "actor", input)).status,
      ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a safe access or outage response without exposing database errors; rate limits stay quiet", async () => {
    const report = await buildProblemReport({
      lastError: classifyDiagnosticError("Network failed"),
    });
    for (const [code, status] of [
      ["42501", 403],
      ["XX000", 503],
    ] as const) {
      const rpc = vi
        .fn()
        .mockResolvedValue({
          data: null,
          error: { code, message: "private-key in SQL" },
        });
      const result = await recordClientDiagnostic(
        { rpc },
        project,
        "actor",
        report,
      );
      expect(result.status).toBe(status);
      expect(JSON.stringify(result)).not.toContain("private-key");
    }
    expect(
      await recordClientDiagnostic(
        { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) },
        project,
        "actor",
        report,
      ),
    ).toEqual({ status: 200, body: { recorded: false } });
    expect(
      (
        await recordClientDiagnostic(
          { rpc: vi.fn().mockRejectedValue(new Error("private-key")) },
          project,
          "actor",
          report,
        )
      ).status,
    ).toBe(503);
  });
});
