import {
  localCompanionOrigin,
  type CompanionIdentity,
} from "../../shared/builderCompanion";

export type CompanionState = {
  status: "disconnected" | "connecting" | "connected";
  root?: string;
  origin?: string;
  error?: string;
  expiresAt?: number;
};
type Pending = {
  resolve(value: any): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};
/** A document-bound transport. No local server capability or cloud token leaves its owning window. */
export class CompanionConnection {
  private state: CompanionState = { status: "disconnected" };
  private listeners = new Set<() => void>();
  private popup: Window | null = null;
  private channel = "";
  private identity?: CompanionIdentity;
  private pending = new Map<string, Pending>();
  private handshake?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;
  private listening = false;
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: Partial<CompanionState>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }
  private send(value: Record<string, unknown>) {
    this.popup?.postMessage(
      { ...value, channel: this.channel },
      this.state.origin!,
    );
  }
  private receive = (event: MessageEvent) => {
    if (
      event.source !== this.popup ||
      event.origin !== this.state.origin ||
      event.data?.channel !== this.channel ||
      this.state.status === "disconnected"
    )
      return;
    const data = event.data;
    if (data.type === "kaizen-companion-ready")
      this.send({
        type: "kaizen-companion-init",
        identity: this.identity,
        requiredRoot: this.state.root,
      });
    else if (data.type === "kaizen-companion-connected") {
      if (
        typeof data.root !== "string" ||
        !data.root ||
        typeof data.expiresAt !== "number" ||
        data.expiresAt <= Date.now() ||
        (this.state.root && data.root !== this.state.root)
      ) {
        this.disconnect(
          "The companion returned a different folder or an expired connection.",
        );
        return;
      }
      clearTimeout(this.handshake);
      this.update({
        status: "connected",
        root: data.root,
        expiresAt: data.expiresAt,
        error: undefined,
      });
    } else if (data.type === "kaizen-companion-ping")
      this.send({ type: "kaizen-companion-pong" });
    else if (data.type === "kaizen-companion-disconnected")
      this.disconnect(
        data.error || "Local companion disconnected. Reconnect to continue.",
      );
    else if (data.type === "kaizen-companion-result") {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (typeof data.error === "string") pending.reject(new Error(data.error));
      else pending.resolve(data.result);
    }
  };
  connect(address: string, identity: CompanionIdentity) {
    const origin = localCompanionOrigin(address);
    this.disconnect();
    if (!this.listening) {
      this.listening = true;
      window.addEventListener("message", this.receive);
      window.addEventListener("pagehide", () => this.disconnect());
    }
    this.channel = crypto.randomUUID();
    this.identity = identity;
    this.update({ status: "connecting", origin, error: undefined });
    const url = new URL("/builder/companion/", origin);
    url.hash = new URLSearchParams({
      channel: this.channel,
      origin: location.origin,
    }).toString();
    this.popup = window.open(url.href, "_blank");
    if (!this.popup) {
      this.disconnect(
        "Allow the companion window in your browser and try again.",
      );
      return;
    }
    this.handshake = setTimeout(
      () =>
        this.disconnect(
          "The companion did not connect. Start it locally, allow its window, then reconnect.",
        ),
      5 * 60 * 1000,
    );
    this.timer = setInterval(() => {
      if (
        !this.popup ||
        this.popup.closed ||
        (this.state.expiresAt && this.state.expiresAt <= Date.now())
      )
        this.disconnect(
          "Local companion closed or expired. Reconnect to continue.",
        );
    }, 1000);
  }
  disconnect(error?: string) {
    if (this.popup && this.state.status !== "disconnected")
      this.send({ type: "kaizen-companion-disconnect" });
    clearTimeout(this.handshake);
    clearInterval(this.timer);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error(
          "Local connection ended. An already accepted operation may have finished; inspect before retrying.",
        ),
      );
    }
    this.pending.clear();
    this.popup = null;
    this.update({ status: "disconnected", error, expiresAt: undefined });
  }
  focus() {
    this.popup?.focus();
  }
  reconnect() {
    if (!this.identity || !this.state.origin)
      throw new Error("Connect the helper from Pages first.");
    this.connect(this.state.origin, this.identity);
  }
  recoveryIdentity() {
    return this.identity?.accountId || "local";
  }
  requireAccount(accountId?: string) {
    if (!accountId || this.identity?.accountId !== accountId) {
      this.disconnect(
        "Signed-in account changed. Reopen this project before connecting again.",
      );
      throw new Error(
        "Sign in with the account that opened this local connection.",
      );
    }
  }
  request(input: Record<string, unknown>): Promise<any> {
    if (this.state.status !== "connected" || !this.popup || this.popup.closed)
      return Promise.reject(
        new Error(
          "Connect the local companion to continue. Your open source edits are retained in this tab.",
        ),
      );
    if (this.pending.size >= 32)
      return Promise.reject(
        new Error("Wait for the pending local operations to finish."),
      );
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            "The local operation timed out. Its outcome is unknown; inspect the repository before retrying a write.",
          ),
        );
      }, 120000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ type: "kaizen-companion-request", id, input });
    });
  }
}
export const companionConnection = new CompanionConnection();
