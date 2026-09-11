import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    session: { user: { id: "owner" }, access_token: "owner-token" } as any,
  };
  const sign = vi.fn(),
    invoke = vi.fn();
  return {
    state,
    sign,
    invoke,
    client: {
      auth: {
        getSession: async () => ({
          data: { session: state.session },
          error: null,
        }),
      },
      functions: { invoke },
      storage: { from: () => ({ createSignedUrl: sign }) },
    },
  };
});
vi.mock("../lib/supabase", () => ({ getSupabaseClient: () => mocks.client }));
vi.mock("./projectStorage", () => ({
  activeProjectId: "11111111-1111-4111-8111-111111111111",
}));
const canonical =
  "/builder-project-media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";

describe("hosted project session and private media lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetModules();
    mocks.state.session = {
      user: { id: "owner" },
      access_token: "owner-token",
    };
    mocks.sign.mockReset().mockResolvedValue({
      data: { signedUrl: "https://storage.test/private?token=temporary" },
      error: null,
    });
    mocks.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
  });
  it("stores canonical asset references and binds a request to its original session", async () => {
    const api = await import("./cloudProjects");
    const signed = await api.projectMediaUrl(canonical);
    await api.cloudProjectRequest(
      { action: "save", document: { image: signed } },
      true,
    );
    expect(mocks.invoke).toHaveBeenCalledWith(
      "builder-projects",
      expect.objectContaining({
        headers: { Authorization: "Bearer owner-token" },
        body: expect.objectContaining({ document: { image: canonical } }),
      }),
    );
  });
  it("rechecks storage permission instead of returning a cached URL after revocation", async () => {
    const api = await import("./cloudProjects");
    await api.projectMediaUrl(canonical);
    mocks.sign.mockResolvedValueOnce({
      data: null,
      error: { message: "Storage access denied" },
    });
    await expect(api.projectMediaUrl(canonical)).rejects.toThrow(
      /access denied/,
    );
    expect(mocks.sign).toHaveBeenCalledTimes(2);
    await expect(
      api.projectMediaUrl(canonical.replace("11111111", "33333333")),
    ).rejects.toThrow(/selected project/);
  });
  it("discards an in-flight response when the account changes or signs out", async () => {
    const api = await import("./cloudProjects");
    mocks.invoke.mockImplementationOnce(async () => {
      mocks.state.session = {
        user: { id: "stranger" },
        access_token: "stranger-token",
      };
      return { data: { privateDraft: "old account" }, error: null };
    });
    await expect(api.cloudProjectRequest({ action: "load" })).rejects.toThrow(
      /account changed/,
    );
    mocks.state.session = null;
    await expect(api.projectMediaUrl(canonical)).rejects.toThrow(/Sign in/);
  });
  it("renews before expiry, projects old undo references to fresh URLs and never changes saved data", async () => {
    vi.useFakeTimers();
    const api = await import("./cloudProjects");
    const signed = await api.projectMediaUrl(canonical),
      draft = { title: "Unsaved client change", image: signed };
    const original = JSON.stringify(draft),
      listener = vi.fn(),
      stop = api.subscribeProjectMedia(listener);
    vi.setSystemTime(Date.now() + 49 * 60_000);
    await api.refreshProjectMedia();
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    mocks.sign.mockResolvedValueOnce({
      data: { signedUrl: "https://storage.test/private?token=fresh" },
      error: null,
    });
    vi.setSystemTime(Date.now() + 60_000);
    await api.refreshProjectMedia();
    expect(api.presentProjectMedia(draft).image).toContain("token=fresh");
    expect(JSON.stringify(draft)).toBe(original);
    expect(api.canonicalProjectData(draft).image).toBe(canonical);
    expect(listener).toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    stop();
  });
  it("keeps signed display URLs stable during preview polling while downloads still recheck access", async () => {
    const api = await import("./cloudProjects");
    mocks.invoke.mockResolvedValue({
      data: { document: { image: canonical } },
      error: null,
    });
    const first = await api.cloudProjectRequest({ action: "preview-read" });
    const second = await api.cloudProjectRequest({ action: "preview-read" });
    expect(second).toEqual(first);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    await api.projectMediaUrl(first.document.image, "client-image.svg");
    expect(mocks.sign).toHaveBeenCalledTimes(2);
  });
  it("keeps usable media during a temporary failure, suppresses expired access and retries without losing canonical references", async () => {
    vi.useFakeTimers();
    const api = await import("./cloudProjects"),
      signed = await api.projectMediaUrl(canonical);
    vi.setSystemTime(Date.now() + 51 * 60_000);
    mocks.sign.mockResolvedValue({
      data: null,
      error: { message: "Access denied or offline" },
    });
    await expect(api.refreshProjectMedia()).rejects.toThrow(
      "edits are unchanged",
    );
    expect(api.presentProjectMedia(signed)).toBe(signed);
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await expect(api.refreshProjectMedia()).rejects.toThrow(
      "edits are unchanged",
    );
    expect(api.presentProjectMedia(signed)).toBe("");
    expect(api.canonicalProjectData(signed)).toBe(canonical);
    mocks.sign.mockResolvedValue({
      data: { signedUrl: "https://storage.test/private?token=recovered" },
      error: null,
    });
    await api.refreshProjectMedia(true);
    expect(api.presentProjectMedia(signed)).toContain("token=recovered");
  });
  it("deduplicates simultaneous renewals and rejects an account changing away and back during signing", async () => {
    vi.useFakeTimers();
    const api = await import("./cloudProjects"),
      signed = await api.projectMediaUrl(canonical);
    vi.setSystemTime(Date.now() + 51 * 60_000);
    let complete: (value: any) => void;
    mocks.sign.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const first = api.refreshProjectMedia(),
      second = api.refreshProjectMedia();
    await vi.waitFor(() => expect(mocks.sign).toHaveBeenCalledTimes(2));
    api.setProjectMediaAccount("stranger");
    api.setProjectMediaAccount("owner");
    complete!({
      data: { signedUrl: "https://storage.test/private?token=discarded" },
      error: null,
    });
    const results = await Promise.allSettled([first, second]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(api.presentProjectMedia(signed)).toBe(canonical);
    expect(api.canonicalProjectData(signed)).toBe(canonical);
  });
});
