// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  authChanged: undefined as any,
}));
vi.mock("../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "owner" }, access_token: "token" } },
        error: null,
      }),
      onAuthStateChange: (callback: any) => {
        mocks.authChanged = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  }),
}));
vi.mock("./projectStorage", () => ({
  activeProjectId: "11111111-1111-4111-8111-111111111111",
}));
const canonical =
  "/builder-project-media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_BUILDER_CLOUD", "1");
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.sign.mockReset().mockResolvedValue({
    data: { signedUrl: "https://storage.test/old" },
    error: null,
  });
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("refreshes mounted images, backgrounds, fonts and video without mutating the document or remounting page controls", async () => {
  const api = await import("./cloudProjects"),
    { HostedMediaProvider } = await import("./HostedMediaProvider"),
    { default: PublishedPage } = await import("./Renderer"),
    { newDocument, starterBlocks } = await import("./starters");
  const signed = await api.projectMediaUrl(canonical),
    page = newDocument("Media lifecycle", "media", false);
  const picture = starterBlocks.Image(),
    video = starterBlocks.Video(),
    menu = starterBlocks.Menu();
  picture.props.src = signed;
  picture.props.style = { desktop: { backgroundImage: signed } };
  video.props.src = signed;
  video.props.poster = signed;
  video.props.captions = signed;
  page.theme.fontUrl = signed;
  page.data.content = [picture, video, menu];
  const unchanged = JSON.stringify(page);
  await act(async () =>
    root.render(
      <HostedMediaProvider>
        <PublishedPage document={page} />
      </HostedMediaProvider>,
    ),
  );
  const image = element.querySelector("img")!,
    details = element.querySelector("details")!;
  details.open = true;
  expect(image.getAttribute("src")).toBe("https://storage.test/old");
  mocks.sign.mockResolvedValue({
    data: { signedUrl: "https://storage.test/refreshed" },
    error: null,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50 * 60_000);
  });
  expect(element.querySelector("img")).toBe(image);
  expect(image.getAttribute("src")).toBe("https://storage.test/refreshed");
  expect(element.querySelector("figure")!.getAttribute("style")).toContain(
    "refreshed",
  );
  expect(element.querySelector("style")!.textContent).toContain("refreshed");
  expect(element.querySelector("video")!.getAttribute("poster")).toContain(
    "refreshed",
  );
  expect(element.querySelector("track")!.getAttribute("src")).toContain(
    "refreshed",
  );
  expect(element.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  expect(JSON.stringify(page)).toBe(unchanged);
  expect(api.canonicalProjectData(page).data.content[0].props.src).toBe(
    canonical,
  );
});

it("refreshes on returning to a sleeping tab, exposes retry on failure and clears old-account presentation", async () => {
  const api = await import("./cloudProjects"),
    { HostedMediaProvider } = await import("./HostedMediaProvider"),
    { default: PublishedPage } = await import("./Renderer"),
    { newDocument, starterBlocks } = await import("./starters");
  const signed = await api.projectMediaUrl(canonical),
    page = newDocument("Focus recovery", "focus", false),
    picture = starterBlocks.Image();
  picture.props.src = signed;
  page.data.content = [picture];
  await act(async () =>
    root.render(
      <HostedMediaProvider>
        <PublishedPage document={page} />
      </HostedMediaProvider>,
    ),
  );
  vi.setSystemTime(Date.now() + 61 * 60_000);
  mocks.sign.mockResolvedValue({ data: null, error: { message: "Offline" } });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(element.querySelector('[role="status"]')?.textContent).toContain(
    "edits are unchanged",
  );
  expect(element.querySelector("img")).toBeNull();
  mocks.sign.mockResolvedValue({
    data: { signedUrl: "https://storage.test/retry" },
    error: null,
  });
  await act(async () => {
    (
      element.querySelector('[role="status"] button') as HTMLButtonElement
    ).click();
  });
  expect(element.querySelector("img")!.getAttribute("src")).toBe(
    "https://storage.test/retry",
  );
  await act(async () => {
    mocks.authChanged("SIGNED_OUT", null);
  });
  expect(element.innerHTML).not.toContain("storage.test/retry");
  expect(api.canonicalProjectData(signed)).toBe(canonical);
});
