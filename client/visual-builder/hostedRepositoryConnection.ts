import { validProjectId } from "../../shared/builderProjects";
import { repositorySetupActions } from "../../shared/builderRepositorySettings";

export type RepositorySession = {
  user: { id: string };
  access_token: string;
  expires_at?: number;
};
export type HostedRepositoryState = {
  status: "disconnected" | "connecting" | "connected";
  root?: string;
  expiresAt?: number;
  error?: string;
  accountId?: string;
  canSaveToWebsite?: boolean;
  canPublishWebsite?: boolean;
};
const ended =
  "The helper connection ended. An accepted operation may have finished; review the website before retrying a change.";

/** A preview may request a page only within its original project, build and public view. */
export function hostedPreviewNavigation(
  base: URL,
  message: unknown,
): URL | undefined {
  const value = message as { type?: unknown; nonce?: unknown; route?: unknown };
  const prefix =
    /^\/editor-preview\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/([a-f0-9]{64})(?=\/)/.exec(
      base.pathname,
    );
  if (
    !prefix ||
    value?.type !== "kaizen-preview-navigate" ||
    value.nonce !== prefix[1] ||
    typeof value.route !== "string" ||
    value.route.length > 4096 ||
    !value.route.startsWith("/") ||
    value.route.startsWith("//") ||
    /[\\\u0000-\u0020]|%(?:2e|2f|5c|25|00)/i.test(value.route) ||
    value.route
      .split(/[/?#]/)
      .some((part) => part === "." || part === ".." || part.includes(":"))
  )
    return;
  return new URL(base.origin + prefix[0] + value.route);
}

/** One project and one transport for this document. Never retries a write or falls back to another folder. */
export class HostedRepositoryConnection {
  private state: HostedRepositoryState = { status: "disconnected" };
  private listeners = new Set<() => void>();
  private pending = new Set<AbortController>();
  private session: RepositorySession | null = null;
  private generation = 0;
  private expiry?: ReturnType<typeof setTimeout>;
  private connecting?: Promise<void>;
  private previewSession = false;
  readonly endpoint: string;
  constructor(
    private options: {
      projectId: string;
      origin: string;
      getSession: () => Promise<RepositorySession | null>;
      fetch?: typeof fetch;
      allowLoopback?: boolean;
    },
  ) {
    const origin = new URL(options.origin);
    if (
      !validProjectId(options.projectId) ||
      origin.origin !== options.origin ||
      (origin.protocol !== "https:" &&
        !(
          options.allowLoopback &&
          origin.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
        ))
    )
      throw new Error(
        "The hosted helper needs a valid project and a secure builder address.",
      );
    this.endpoint = new URL("/editor-api/builder-repository", origin).href;
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: Partial<HostedRepositoryState>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }
  disconnect(
    error = "Sign in again to connect the hosted helper.",
    clearRoot = false,
  ) {
    this.generation++;
    clearTimeout(this.expiry);
    for (const controller of this.pending) controller.abort();
    this.connecting = undefined;
    this.update({
      status: "disconnected",
      expiresAt: undefined,
      error,
      ...(clearRoot
        ? {
            root: undefined,
            accountId: undefined,
            canSaveToWebsite: undefined,
            canPublishWebsite: undefined,
          }
        : {}),
    });
  }
  async setSession(next: RepositorySession | null) {
    const previous = this.session;
    const changed = this.session?.user.id !== next?.user.id;
    const refreshed = this.session?.access_token !== next?.access_token;
    const valid = Boolean(
      next?.expires_at && next.expires_at * 1000 > Date.now(),
    );
    if (changed) this.disconnect(ended, true);
    else if (refreshed && this.connecting) this.disconnect(ended);
    this.session = next;
    if ((changed || !valid) && previous && this.previewSession)
      await this.revokePreview(previous.user.id);
    // A delayed logout must not disconnect a newer account that has already connected.
    if (this.session !== next) return;
    if (!valid) {
      this.disconnect();
      return;
    }
    if (changed || refreshed || this.state.status !== "connected")
      await this.connect();
  }
  private async revokePreview(accountId: string) {
    this.previewSession = false;
    try {
      await (this.options.fetch || fetch)(this.endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        headers: { "X-Kaizen-Preview-Account": accountId },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* Sign-out still closes the editor; unreachable server sessions expire without renewal. */
    }
  }
  private async currentSession() {
    let session: RepositorySession | null;
    try {
      session = await this.options.getSession();
    } catch {
      const message =
        "Your sign-in could not be checked. Reconnect the hosted helper to continue; your open edits are kept.";
      this.disconnect(message);
      throw new Error(message);
    }
    if (
      !session ||
      !session.expires_at ||
      session.expires_at * 1000 <= Date.now()
    ) {
      if (this.previewSession && this.session)
        void this.revokePreview(this.session.user.id);
      this.disconnect();
      throw new Error(
        "Your sign-in has expired. Sign in again to use the hosted helper.",
      );
    }
    if (this.session && session.user.id !== this.session.user.id) {
      const previous = this.session;
      if (this.previewSession) await this.revokePreview(previous.user.id);
      if (this.session !== previous) throw new Error(ended);
      this.session = session;
      this.disconnect(
        "The signed-in account changed. Reopen this project.",
        true,
      );
      throw new Error("The signed-in account changed. Reopen this project.");
    }
    return session;
  }
  connect = async () => {
    if (this.connecting) return this.connecting;
    const version = this.generation;
    this.update({ status: "connecting", error: undefined });
    const work = (async () => {
      try {
        const session = await this.currentSession();
        if (version !== this.generation) throw new Error(ended);
        this.session = session;
        this.update({ accountId: session.user.id });
        const result = await this.send(
          { action: "repository-connect" },
          session,
          version,
        );
        if (
          result?.projectId !== this.options.projectId ||
          typeof result.root !== "string" ||
          !result.root ||
          result.root.length > 4096 ||
          /[\u0000-\u001f]/.test(result.root) ||
          !Number.isFinite(result.expiresAt) ||
          result.expiresAt <= Date.now()
        )
          throw new Error("The hosted helper returned an invalid connection.");
        if (this.state.root && result.root !== this.state.root)
          throw new Error(
            "The website folder changed. Reopen this project before editing.",
          );
        const expiresAt = Math.min(
          result.expiresAt,
          session.expires_at! * 1000,
        );
        this.previewSession = result.previewSession === true;
        clearTimeout(this.expiry);
        this.update({
          status: "connected",
          root: result.root,
          accountId: session.user.id,
          canSaveToWebsite: result.canSaveToWebsite === true,
          canPublishWebsite: result.canPublishWebsite === true,
          expiresAt,
          error: undefined,
        });
        this.expiry = setTimeout(
          () =>
            this.disconnect(
              "Your helper session expired. Reconnect to continue; your open edits are kept.",
            ),
          Math.min(expiresAt - Date.now(), 2_147_483_647),
        );
      } catch (error) {
        if (version === this.generation)
          this.disconnect(
            error instanceof Error
              ? error.message
              : "The hosted helper could not connect.",
          );
        throw error;
      }
    })();
    this.connecting = work;
    try {
      await work;
    } finally {
      if (this.connecting === work) this.connecting = undefined;
    }
  };
  async request(input: Record<string, unknown>): Promise<any> {
    const version = this.generation;
    const session = await this.currentSession();
    const setup =
      typeof input.action === "string" &&
      repositorySetupActions.has(input.action);
    if (
      version !== this.generation ||
      (!setup &&
        (this.state.status !== "connected" ||
          !this.state.expiresAt ||
          this.state.expiresAt <= Date.now()))
    )
      throw new Error(
        this.state.error ||
          "Connect the hosted helper to continue. Your open edits are kept.",
      );
    if (
      typeof input.action !== "string" ||
      !input.action.startsWith("repository-")
    )
      throw new Error("Choose a website folder action.");
    const nested = (input.edits as any)?.inspection?.root;
    if (
      (input.root !== undefined && input.root !== this.state.root) ||
      (nested !== undefined && nested !== this.state.root)
    )
      throw new Error(
        "This operation belongs to another website folder. Reopen the intended project.",
      );
    const result = await this.send(input, session, version);
    if (
      setup &&
      input.action !== "repository-settings-read" &&
      result?.connected === false
    ) {
      this.update({
        canSaveToWebsite: undefined,
        canPublishWebsite: undefined,
      });
      this.disconnect(
        "Repository setup changed. Check the website folder before editing.",
      );
    }
    return result;
  }
  private async send(
    input: Record<string, unknown>,
    session: RepositorySession,
    version: number,
  ) {
    if (this.pending.size >= 32)
      throw new Error("Wait for the pending website operations to finish.");
    const controller = new AbortController();
    this.pending.add(controller);
    const timer = setTimeout(
      () =>
        this.disconnect(
          "The hosted operation timed out. Its outcome is unknown; review the website before retrying a change.",
        ),
      120_000,
    );
    try {
      const response = await (this.options.fetch || fetch)(this.endpoint, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ...input, projectId: this.options.projectId }),
        signal: controller.signal,
      });
      const value = await response.json().catch(() => null);
      if (version !== this.generation || controller.signal.aborted)
        throw new Error(ended);
      if (!response.ok) {
        const message =
          typeof value?.error === "string"
            ? value.error
            : "The hosted helper is unavailable. Reconnect and try again.";
        if ([401, 403, 404, 502, 503, 504].includes(response.status))
          this.disconnect(message);
        throw new Error(message);
      }
      return value;
    } catch (error) {
      if (controller.signal.aborted || version !== this.generation)
        throw new Error(this.state.error || ended);
      if (error instanceof TypeError) {
        this.disconnect(
          "The hosted helper could not be reached. An accepted operation may have finished; review before retrying a change.",
        );
        throw new Error(this.state.error);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      this.pending.delete(controller);
    }
  }
}
