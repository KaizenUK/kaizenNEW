import type { Asset } from "../../shared/visualBuilder";
import { validProjectId } from "../../shared/builderProjects";
import { getSupabaseClient } from "../lib/supabase";
import { activeProjectId, requireActiveProject } from "./projectStorage";
import {
  assertUploadUrl,
  resumableUpload,
  type UploadControl,
} from "./resumableUpload";
import type { RepositorySession } from "./hostedRepositoryConnection";

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export class HostedUploadConnection {
  readonly endpoint: string;
  readonly projectId: string;
  readonly accountId: string;
  readonly scope: string;
  constructor(
    private options: {
      origin: string;
      projectId: string;
      accountId: string;
      scope: string;
      getSession: () => Promise<RepositorySession | null>;
      allowLoopback?: boolean;
      previousEndpoints?: string[];
      fetch?: typeof fetch;
      transfer?: typeof resumableUpload;
    },
  ) {
    const origin = new URL(options.origin);
    if (
      origin.origin !== options.origin ||
      !validProjectId(options.projectId) ||
      !uuid.test(options.accountId) ||
      !(
        origin.protocol === "https:" ||
        (options.allowLoopback &&
          origin.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
      )
    )
      throw new Error("Configure a secure builder address before uploading.");
    this.endpoint = new URL("/editor-uploads", origin).href;
    this.projectId = options.projectId;
    this.accountId = options.accountId;
    this.scope = options.scope;
  }
  async current() {
    const session = await this.options.getSession();
    if (
      !session ||
      session.user.id !== this.accountId ||
      !session.expires_at ||
      session.expires_at * 1000 <= Date.now()
    )
      throw new Error(
        "Sign in with the original account to resume this upload.",
      );
    return session;
  }
  private address(value: string) {
    const url = new URL(assertUploadUrl(value, this.endpoint));
    if (
      url.search ||
      !uuid.test(
        url.pathname.slice(new URL(this.endpoint).pathname.length + 1),
      ) ||
      url.pathname !== `/editor-uploads/${url.pathname.split("/").pop()}`
    )
      throw new Error(
        "The saved upload address is invalid. Resume the original import.",
      );
    return url.href;
  }
  private previous(value: string) {
    return (this.options.previousEndpoints || []).some((endpoint) => {
      try {
        assertUploadUrl(value, endpoint);
        return true;
      } catch {
        return false;
      }
    });
  }
  private sameScope(control: UploadControl) {
    if (control.scope && control.scope !== this.scope)
      throw new Error(
        "This upload belongs to another account or website. Resume it in the original workspace.",
      );
  }
  private async action(
    url: string,
    method: "POST" | "DELETE",
    signal?: AbortSignal,
    headers: Record<string, string> = {},
  ) {
    const session = await this.current();
    signal?.throwIfAborted();
    const response = await (this.options.fetch || fetch)(url, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...headers },
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(180000)])
        : AbortSignal.timeout(180000),
    });
    let result: any;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 4096) throw new Error();
          parts.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      result = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error(
        "The upload service returned an invalid response. Resume the original import.",
      );
    }
    await this.current();
    if (!response.ok)
      throw new Error(
        typeof result?.error === "string"
          ? result.error.slice(0, 1000)
          : "The upload did not finish. Resume the original import.",
      );
    if (
      result?.projectId !== this.projectId ||
      !uuid.test(result?.id || "") ||
      (url !== `${this.endpoint}/adopt` &&
        !url.startsWith(`${this.endpoint}/${result.id}`))
    )
      throw new Error(
        "The upload response belongs to another website. Resume the original import.",
      );
    return result;
  }
  async adopt(asset: Asset, signal?: AbortSignal) {
    if (
      !uuid.test(asset.id) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > 50 * 1024 ** 2 ||
      !/^[a-f0-9]{64}$/.test(asset.hash)
    )
      throw new Error("Choose a valid file before recovering its upload.");
    const file = {
      projectId: this.projectId,
      assetId: asset.id,
      bytes: asset.size,
      sha256: asset.hash,
      mime: asset.mime,
      kind: asset.kind,
    };
    const metadata = btoa(
      Array.from(new TextEncoder().encode(JSON.stringify(file)), (byte) =>
        String.fromCharCode(byte),
      ).join(""),
    );
    const result = await this.action(`${this.endpoint}/adopt`, "POST", signal, {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(asset.size),
      "Upload-Metadata": `file ${metadata}`,
    });
    if (
      result.status !== "stored" ||
      result.assetId !== asset.id ||
      result.bytes !== asset.size ||
      result.sha256 !== asset.hash
    )
      throw new Error("The recovered file does not match this import.");
  }
  async upload(
    asset: Asset,
    blob: Blob,
    progress: (value: number) => void,
    control: UploadControl = {},
  ) {
    this.sameScope(control);
    await this.current();
    control.signal?.throwIfAborted();
    if (
      !uuid.test(asset.id) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > 50 * 1024 ** 2 ||
      blob.size !== asset.size ||
      !/^[a-f0-9]{64}$/.test(asset.hash)
    )
      throw new Error(
        "Choose a valid file no larger than 50 MB before uploading.",
      );
    let saved = control.uploadUrl;
    // Old recovery packs retain their browser bytes. Restart a recognised
    // pre-cutover provider transfer here, without sending credentials to it.
    if (saved && control.recover && this.previous(saved)) saved = undefined;
    if (saved) saved = this.address(saved);
    const url = await (this.options.transfer || resumableUpload)(blob, {
      ...control,
      uploadUrl: saved,
      endpoint: this.endpoint,
      metadata: {
        file: JSON.stringify({
          projectId: this.projectId,
          assetId: asset.id,
          bytes: asset.size,
          sha256: asset.hash,
          mime: asset.mime,
          kind: asset.kind,
        }),
      },
      headers: async () => ({
        Authorization: `Bearer ${(await this.current()).access_token}`,
      }),
      onUploadUrl: async (value) => {
        const safe = this.address(value);
        await this.current();
        await control.onUploadUrl?.(safe);
      },
      progress: (value) => progress(Math.min(95, Math.round(value * 0.95))),
    });
    const safe = this.address(url);
    const result = await this.action(`${safe}/finish`, "POST", control.signal);
    if (
      result.status !== "stored" ||
      result.assetId !== asset.id ||
      result.bytes !== asset.size ||
      result.sha256 !== asset.hash
    )
      throw new Error(
        "The completed upload did not match this file. Resume the original import.",
      );
    progress(100);
  }
  async cancel(uploadUrl: string, scope?: string) {
    this.sameScope({ scope });
    await this.current();
    if (this.previous(uploadUrl)) return;
    const result = await this.action(this.address(uploadUrl), "DELETE");
    if (!["stored", "removed"].includes(result.status))
      throw new Error(
        "The pending upload has not been removed yet. Try discarding it again.",
      );
  }
}

export async function hostedUploadContext() {
  const client = getSupabaseClient();
  if (!client) throw new Error("The hosted builder is not configured.");
  const project = await requireActiveProject();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to resume uploads.");
  const source = new URL(import.meta.env.VITE_SUPABASE_URL);
  const previousEndpoints = [
    new URL("/storage/v1/upload/resumable", source).href,
  ];
  if (/^[\w-]+\.supabase\.co$/.test(source.hostname)) {
    source.hostname = source.hostname.replace(
      ".supabase.co",
      ".storage.supabase.co",
    );
    previousEndpoints.push(
      new URL("/storage/v1/upload/resumable", source).href,
    );
  }
  const scope = `${new URL(import.meta.env.VITE_SUPABASE_URL).origin}:${data.user.id}${project.capabilities.legacyWorkspace ? "" : `:project:${activeProjectId}`}`;
  return new HostedUploadConnection({
    origin: location.origin,
    projectId: activeProjectId,
    accountId: data.user.id,
    scope,
    allowLoopback: import.meta.env.DEV,
    previousEndpoints,
    getSession: async () => (await client.auth.getSession()).data.session,
  });
}
