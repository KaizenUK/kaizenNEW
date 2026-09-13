import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HostedRepositoryConnection,
  hostedPreviewNavigation,
  type RepositorySession,
} from "./hostedRepositoryConnection";

const projectId = "11111111-1111-4111-8111-111111111111";
const root = "/fixture/website";
const clients: HostedRepositoryConnection[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.disconnect());
  vi.useRealTimers();
});
function fixture(
  previewSession = false,
  canSaveToWebsite: unknown = undefined,
) {
  let session: RepositorySession | null = {
    user: { id: "owner" },
    access_token: "owner-token",
    expires_at: Date.now() / 1000 + 3600,
  };
  const server = vi.fn<typeof fetch>(
    async (_url: string | URL | Request, request?: RequestInit) => {
      if (request?.method === "DELETE")
        return new Response(null, { status: 204 });
      const body = JSON.parse(request!.body as string);
      return Response.json(
        body.action === "repository-connect"
          ? {
              projectId,
              root,
              expiresAt: Date.now() + 7200_000,
              previewSession,
              canSaveToWebsite,
            }
          : { action: body.action, root },
      );
    },
  );
  const getSession = vi.fn(async () => session);
  const client = new HostedRepositoryConnection({
    projectId,
    origin: "https://builder.example",
    getSession,
    fetch: server,
  });
  clients.push(client);
  return {
    client,
    server,
    getSession,
    session: () => session!,
    setSession: async (next: RepositorySession | null) => {
      session = next;
      await client.setSession(next);
    },
    open: () => client.setSession(session),
  };
}
describe("hosted repository transport", () => {
  it("enables website saving only when the server advertises it and clears the capability when the account ends", async () => {
    for (const capability of [undefined, false, "true", true]) {
      const api = fixture(false, capability);
      await api.open();
      expect(api.client.snapshot().canSaveToWebsite).toBe(capability === true);
      api.client.disconnect("Connection interrupted");
      expect(api.client.snapshot().canSaveToWebsite).toBe(capability === true);
      await api.setSession(null);
      expect(api.client.snapshot().canSaveToWebsite).toBeUndefined();
    }
  });
  it("confines preview navigation to the public view and rejects forged nonces, external URLs and escaped traversal", () => {
    const nonce = "a".repeat(64);
    const base = new URL(
      `https://builder.example/editor-preview/${projectId}/${projectId}/${nonce}/`,
    );
    const message = {
      type: "kaizen-preview-navigate",
      nonce,
      route: "/contact/?from=home#email",
    };
    expect(hostedPreviewNavigation(base, message)?.href).toBe(
      base.href + "contact/?from=home#email",
    );
    for (const route of [
      "//outside.example/",
      "https://outside.example/",
      "/../builder",
      "/%2e%2e/builder",
      "/%252e%252e/builder",
      "/x%2fy",
      "/x%5cy",
      "/\\builder",
      "/x\nheader",
    ])
      expect(
        hostedPreviewNavigation(base, { ...message, route }),
      ).toBeUndefined();
    expect(
      hostedPreviewNavigation(base, { ...message, nonce: "b".repeat(64) }),
    ).toBeUndefined();
    expect(hostedPreviewNavigation(base, null)).toBeUndefined();
    expect(
      hostedPreviewNavigation(
        new URL("https://builder.example/builder/"),
        message,
      ),
    ).toBeUndefined();
  });
  it("revokes the server preview session on sign-out without sending the access token", async () => {
    const api = fixture(true);
    await api.open();
    await api.setSession(null);
    expect(api.client.snapshot().status).toBe("disconnected");
    expect(api.server.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      headers: { "X-Kaizen-Preview-Account": "owner" },
    });
    expect(api.server.mock.calls[1][1].headers).not.toHaveProperty(
      "Authorization",
    );
  });
  it("keeps the newer account connected when an old sign-out completes late", async () => {
    const api = fixture(true);
    await api.open();
    let finish!: (response: Response) => void;
    api.server.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const closing = api.setSession(null);
    await Promise.resolve();
    await api.setSession({
      user: { id: "new-account" },
      access_token: "new-token",
      expires_at: Date.now() / 1000 + 3600,
    });
    finish(new Response(null, { status: 204 }));
    await closing;
    expect(api.client.snapshot()).toMatchObject({
      status: "connected",
      accountId: "new-account",
    });
    expect(api.server.mock.calls.map(([, options]) => options.method)).toEqual([
      "POST",
      "DELETE",
      "POST",
    ]);
  });
  it("closes the editor after an unreachable sign-out and revokes a session that has expired locally", async () => {
    const api = fixture(true);
    await api.open();
    api.server.mockRejectedValueOnce(new TypeError("offline"));
    await api.setSession(null);
    expect(api.client.snapshot().status).toBe("disconnected");
    const expired = fixture(true);
    await expired.open();
    await expired.setSession({
      ...expired.session(),
      expires_at: Date.now() / 1000 - 1,
    });
    expect(expired.server.mock.calls[1][1].method).toBe("DELETE");
    expect(expired.client.snapshot().status).toBe("disconnected");
  });
  it("checks a server connection and sends existing action shapes with a fixed project and verified session token", async () => {
    const api = fixture();
    await api.open();
    expect(api.client.snapshot()).toMatchObject({
      status: "connected",
      root,
      accountId: "owner",
      expiresAt: Date.now() + 3600_000,
    });
    await expect(
      api.client.request({
        action: "repository-source-inspect",
        root,
        route: "src/pages/index.astro",
        projectId: "spoofed",
      }),
    ).resolves.toMatchObject({ action: "repository-source-inspect", root });
    const [url, options] = api.server.mock.calls[1];
    expect(url).toBe("https://builder.example/editor-api/builder-repository");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      credentials: "same-origin",
      headers: { Authorization: "Bearer owner-token" },
    });
    expect(JSON.parse(options!.body as string)).toEqual({
      action: "repository-source-inspect",
      root,
      route: "src/pages/index.astro",
      projectId,
    });
  });
  it("refuses insecure origins and invalid project contexts before credentials can be sent", () => {
    for (const origin of [
      "http://builder.example",
      "https://builder.example/path",
      "https://user:secret@builder.example",
      "http://127.0.0.1:4321",
    ])
      expect(
        () =>
          new HostedRepositoryConnection({
            projectId,
            origin,
            getSession: async () => null,
          }),
      ).toThrow(/secure builder/);
    expect(
      () =>
        new HostedRepositoryConnection({
          projectId: "../private",
          origin: "https://builder.example",
          getSession: async () => null,
        }),
    ).toThrow();
  });
  it("requires sign-in and server approval before any source operation", async () => {
    const api = fixture();
    await expect(
      api.client.request({ action: "repository-inspect-current" }),
    ).rejects.toThrow(/Connect the hosted helper/);
    expect(api.server).not.toHaveBeenCalled();
    await api.setSession(null);
    await expect(api.client.connect()).rejects.toThrow(/sign-in has expired/);
    expect(api.server).not.toHaveBeenCalled();
  });
  it("rejects another project, an invalid lease and a changed folder from the server", async () => {
    const api = fixture();
    for (const response of [
      { projectId: "other", root, expiresAt: Date.now() + 1000 },
      { projectId, root, expiresAt: Date.now() - 1 },
      { projectId, root: "\0bad", expiresAt: Date.now() + 1000 },
    ]) {
      api.server.mockResolvedValueOnce(Response.json(response));
      await expect(api.client.connect()).rejects.toThrow(/invalid connection/);
      expect(api.client.snapshot().status).toBe("disconnected");
    }
    await api.client.connect();
    api.server.mockResolvedValueOnce(
      Response.json({
        projectId,
        root: "/other-folder",
        expiresAt: Date.now() + 1000,
      }),
    );
    await expect(api.client.connect()).rejects.toThrow(/folder changed/);
    expect(api.client.snapshot().root).toBe(root);
  });
  it("disconnects when sign-in cannot be checked and keeps the approved folder for recovery", async () => {
    const api = fixture();
    await api.open();
    api.getSession.mockRejectedValueOnce(
      new Error("Internal auth storage failure"),
    );
    await expect(
      api.client.request({ action: "repository-apply", planId: "reviewed" }),
    ).rejects.toThrow(/sign-in could not be checked/);
    expect(api.client.snapshot()).toMatchObject({
      status: "disconnected",
      root,
      error: expect.stringMatching(/open edits are kept/),
    });
    expect(api.server).toHaveBeenCalledTimes(1);
    await api.client.connect();
    expect(api.client.snapshot().status).toBe("connected");
  });
  it("rejects cross-folder and non-repository actions without sending them", async () => {
    const api = fixture();
    await api.open();
    for (const input of [
      { action: "publish" },
      { action: "repository-apply", root: "/other" },
      {
        action: "repository-source-prepare",
        edits: { inspection: { root: "/other" } },
      },
    ])
      await expect(api.client.request(input)).rejects.toThrow();
    expect(api.server).toHaveBeenCalledTimes(1);
  });
  it("expires without a request, keeps the folder for recovery, and notifies subscribers", async () => {
    const api = fixture();
    const listener = vi.fn();
    const stop = api.client.subscribe(listener);
    await api.open();
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(api.client.snapshot()).toMatchObject({
      status: "disconnected",
      root,
      error: expect.stringMatching(/expired/),
    });
    await expect(
      api.client.request({ action: "repository-apply" }),
    ).rejects.toThrow(/expired/);
    expect(api.server).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalled();
    stop();
    const count = listener.mock.calls.length;
    api.client.disconnect();
    expect(listener).toHaveBeenCalledTimes(count);
  });
  it("renews a connection on token refresh without carrying the old expiry into new operations", async () => {
    const api = fixture();
    await api.open();
    await vi.advanceTimersByTimeAsync(1800_000);
    await api.setSession({
      ...api.session(),
      access_token: "refreshed-token",
      expires_at: Date.now() / 1000 + 3600,
    });
    await vi.advanceTimersByTimeAsync(1800_000);
    expect(api.client.snapshot().status).toBe("connected");
    await api.client.request({ action: "repository-inspect-current" });
    expect(
      api.server.mock.calls[api.server.mock.calls.length - 1]?.[1]?.headers,
    ).toMatchObject({
      Authorization: "Bearer refreshed-token",
    });
  });
  it("checks the same valid session again after a restored document has disconnected", async () => {
    const api = fixture();
    await api.open();
    api.client.disconnect();
    await api.setSession(api.session());
    expect(api.client.snapshot().status).toBe("connected");
    expect(api.server).toHaveBeenCalledTimes(2);
  });
  it("does not retry rejected writes or switch to another transport, and keeps useful conflict errors", async () => {
    const api = fixture();
    await api.open();
    api.server.mockResolvedValueOnce(
      Response.json(
        { error: "Changes conflict with a newer version." },
        { status: 409 },
      ),
    );
    await expect(
      api.client.request({ action: "repository-apply", planId: "reviewed" }),
    ).rejects.toThrow(/conflict/);
    expect(api.client.snapshot().status).toBe("connected");
    api.server.mockResolvedValueOnce(
      Response.json({ error: "Project membership required." }, { status: 403 }),
    );
    await expect(
      api.client.request({ action: "repository-apply", planId: "reviewed" }),
    ).rejects.toThrow(/membership required/);
    expect(api.client.snapshot().status).toBe("disconnected");
    expect(api.server).toHaveBeenCalledTimes(3);
  });
  it("abandons a pending response on account change even when a server ignores cancellation", async () => {
    const api = fixture();
    await api.open();
    let finish: (value: Response) => void = () => {};
    api.server.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const request = api.client.request({
      action: "repository-apply",
      planId: "reviewed",
    });
    const checked = expect(request).rejects.toThrow(/connection ended|Sign in/);
    await Promise.resolve();
    await Promise.resolve();
    await api.setSession({
      user: { id: "other-account" },
      access_token: "other-token",
      expires_at: Date.now() / 1000 + 3600,
    });
    finish(Response.json({ applied: true }));
    await checked;
    expect(api.client.snapshot().accountId).toBe("other-account");
    expect(api.server.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });
  it("bounds a stalled operation and explains an unknown outcome instead of retrying", async () => {
    const api = fixture();
    await api.open();
    api.server.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options!.signal!.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    const checked = expect(
      api.client.request({ action: "repository-apply", planId: "reviewed" }),
    ).rejects.toThrow(/outcome is unknown/);
    await vi.advanceTimersByTimeAsync(120_000);
    await checked;
    expect(api.client.snapshot().status).toBe("disconnected");
    expect(api.server).toHaveBeenCalledTimes(2);
  });
});
