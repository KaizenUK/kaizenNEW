import { getSupabaseClient } from "../lib/supabase";
import { activeProjectId } from "./projectStorage";
import { validProjectId } from "../../shared/builderProjects";
import { companionConnection } from "./companionConnection";
import {
  HostedRepositoryConnection,
  type HostedRepositoryState,
} from "./hostedRepositoryConnection";
import { repositoryMode } from "./repositoryMode";
import { recordBuilderError } from "./diagnostics";

const localState: HostedRepositoryState = { status: "connected" };
const invalidProject =
  repositoryMode === "hosted" && !validProjectId(activeProjectId);
const invalidState: HostedRepositoryState = {
  status: "disconnected",
  error:
    "The selected project is unavailable. Return to Projects and check your access.",
};
const hosted =
  repositoryMode === "hosted" &&
  !invalidProject &&
  typeof location !== "undefined"
    ? new HostedRepositoryConnection({
        projectId: activeProjectId,
        origin: location.origin,
        allowLoopback: import.meta.env.DEV,
        getSession: async () =>
          (await getSupabaseClient()?.auth.getSession())?.data.session || null,
      })
    : null;
let started = false;
let stopAuth: (() => void) | undefined;
let disposed = false;
const snapshot = () =>
  invalidProject
    ? invalidState
    : repositoryMode === "local"
      ? localState
      : hosted
        ? hosted.snapshot()
        : companionConnection.snapshot();
/** UI and storage share this document's selected transport; there is no automatic fallback. */
export const repositoryConnection = {
  mode: repositoryMode,
  savedLabel:
    repositoryMode === "hosted"
      ? "Edits saved."
      : "Edits saved on this computer.",
  snapshot,
  subscribe: invalidProject
    ? (_listener: () => void) => () => {}
    : hosted
      ? hosted.subscribe
      : repositoryMode === "local"
        ? (_listener: () => void) => () => {}
        : companionConnection.subscribe,
  start() {
    if (started || repositoryMode === "local" || invalidProject) return;
    started = true;
    const client = getSupabaseClient();
    if (!client) {
      hosted?.disconnect("The hosted helper is not configured.");
      return;
    }
    let eventCount = 0;
    const accept = (session: any) => {
      if (disposed) return;
      if (hosted)
        void hosted
          .setSession(session)
          .catch((error) => recordBuilderError(error, "helper"));
      else if (
        !session ||
        (companionConnection.recoveryIdentity() !== "local" &&
          companionConnection.recoveryIdentity() !== session.user.id)
      )
        companionConnection.disconnect(
          "Signed out or account changed. Reconnect the helper.",
        );
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      eventCount++;
      accept(session);
    });
    stopAuth = () => data.subscription.unsubscribe();
    const initial = eventCount;
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (eventCount === initial) accept(data.session);
      })
      .catch(() => hosted?.disconnect());
    window.addEventListener(
      "pagehide",
      () => {
        disposed = true;
        stopAuth?.();
        hosted?.disconnect();
        companionConnection.disconnect();
      },
      { once: true },
    );
  },
  async request(
    input: Record<string, unknown>,
    local: (input: unknown) => Promise<any>,
  ) {
    if (repositoryMode === "local") return local(input);
    if (invalidProject) throw new Error(invalidState.error);
    this.start();
    if (hosted) return hosted.request(input);
    const session = await getSupabaseClient()?.auth.getSession();
    companionConnection.requireAccount(session?.data.session?.user.id);
    return companionConnection.request(input);
  },
  reconnect: async () => {
    if (invalidProject) throw new Error(invalidState.error);
    if (hosted) {
      const client = getSupabaseClient();
      const result = await client?.auth.refreshSession();
      if (!result?.data.session)
        throw new Error("Sign in again to reconnect the hosted helper.");
      await hosted.setSession(result.data.session);
      await hosted.connect();
    } else companionConnection.reconnect();
  },
  recoveryIdentity: () =>
    hosted
      ? `hosted:${hosted.snapshot().accountId || "signed-out"}`
      : companionConnection.recoveryIdentity(),
  buildConsentScope: () =>
    hosted
      ? `hosted:${hosted.snapshot().accountId || "signed-out"}`
      : companionConnection.snapshot().expiresAt || "local",
  preferredRoot() {
    if (repositoryMode !== "local") return snapshot().root;
    try {
      return (
        localStorage.getItem(`kaizen-native-repository:${activeProjectId}`) ||
        undefined
      );
    } catch {
      return undefined;
    }
  },
  localBuilderOrigin: () =>
    repositoryMode === "companion"
      ? companionConnection.snapshot().origin
      : undefined,
  projectLocation(id: string) {
    const url = `/builder/?${hosted ? "" : "local=1&"}project=${encodeURIComponent(id)}`;
    return repositoryMode === "companion"
      ? new URL(url, companionConnection.snapshot().origin).href
      : url;
  },
  validateFrame(value: unknown, nonce: unknown) {
    if (typeof nonce !== "string" || !/^[a-f0-9]{64}$/.test(nonce))
      throw new Error("The helper returned an invalid preview address.");
    return this.validatePreview(value);
  },
  validatePreview(value: unknown) {
    const url = new URL(String(value));
    if (url.username || url.password)
      throw new Error("The helper returned an invalid preview address.");
    const valid = hosted
      ? url.origin === location.origin &&
        url.pathname.startsWith(`/editor-preview/${activeProjectId}/`) &&
        !/%(?:2f|5c)/i.test(url.pathname) &&
        !decodeURIComponent(url.pathname).split("/").includes("..")
      : url.protocol === "http:" && url.hostname === "127.0.0.1";
    if (!valid)
      throw new Error("The helper returned an invalid preview address.");
    return url;
  },
  openPreviewWindow(value: string) {
    const url = this.validatePreview(value);
    if (!hosted) return window.open(url.href, "_blank", "noopener,noreferrer");
    const child = window.open("about:blank", "_blank");
    if (!child)
      throw new Error(
        "Allow the preview window in your browser, then try again.",
      );
    child.document.title = "Website preview";
    child.document.body.style.margin = "0";
    const frame = child.document.createElement("iframe");
    frame.title = "Website preview";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
    frame.src = url.href;
    child.document.body.append(frame);
    return child;
  },
  frameSandbox: hosted ? "allow-scripts" : "allow-scripts allow-same-origin",
  frameOrigin: (url: string) => (hosted ? "null" : new URL(url).origin),
  frameTarget: (url: string) => (hosted ? "*" : new URL(url).origin),
};
if (typeof window !== "undefined")
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      disposed = false;
      started = false;
      repositoryConnection.start();
    }
  });
