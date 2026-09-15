/** Authenticated upload requests. The HTTP host sends the returned response after cleanup. */
import { Server, Metadata } from "@tus/server";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { validProjectId } from "../shared/builderProjects";
import { AssetCleanupWorker } from "./builder-asset-cleanup";
import { parseAllowedOrigins } from "../shared/builderOrigins";
import {
  accountId,
  HostedHelperError,
  type HostedRepositoryAccess,
  type RepositoryActor,
} from "./builder-hosted-auth";
import {
  UploadSpool,
  MAX_UPLOAD_BYTES,
  uploadAttemptStopped,
  type UploadAttempt,
} from "./builder-upload-spool";
import {
  UploadProviderError,
  type uploadStorageProvider,
  type UploadObject,
} from "./builder-upload-provider";

export const HOSTED_UPLOAD_PATH = "/editor-uploads";
type FileDescription = {
  projectId: string;
  assetId: string;
  bytes: number;
  sha256: string;
  mime: string;
  kind: string;
};
type UploadRecord = UploadObject & {
  actor_id: string;
  worker_id: string;
  status: string;
  owner_token: string | null;
  completed_token: string | null;
  completion_evidence: Record<string, unknown> | null;
  cancel_requested: boolean;
};
type UploadServices = {
  workerId: string;
  spool: UploadSpool;
  access: Pick<HostedRepositoryAccess, "verify">;
  /** Matches the existing release client: resolves the RPC value or throws its error code. */
  rpc: (name: string, args: Record<string, unknown>) => Promise<any>;
  provider: ReturnType<typeof uploadStorageProvider>;
  origins: string[];
};
function description(request: Request): FileDescription {
  const encoded = request.headers.get("upload-metadata") || "";
  let file: FileDescription;
  try {
    if (encoded.length > 4096) throw new Error();
    const metadata = Metadata.parse(encoded);
    if (Object.keys(metadata).join(",") !== "file") throw new Error();
    file = JSON.parse(metadata.file || "null");
    if (
      !file ||
      Object.keys(file).sort().join(",") !==
        "assetId,bytes,kind,mime,projectId,sha256" ||
      !validProjectId(file.projectId) ||
      !accountId(file.assetId) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > MAX_UPLOAD_BYTES ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      typeof file.mime !== "string" ||
      !file.mime ||
      file.mime.length > 255 ||
      /[\x00-\x1f\x7f]/.test(file.mime) ||
      !["image", "icon", "font", "licence", "code", "design", "other"].includes(
        file.kind,
      ) ||
      request.headers.get("upload-length") !== String(file.bytes)
    )
      throw new Error();
  } catch {
    throw new HostedHelperError(
      400,
      "Choose a valid file and its size before uploading.",
    );
  }
  return file;
}
/** Stable within the immutable project/asset identity, including retries whose POST reply was lost. */
export function hostedUploadId(projectId: string, assetId: string) {
  if (!validProjectId(projectId) || !accountId(assetId))
    throw new HostedHelperError(400, "Invalid upload identity.");
  const digest = createHash("sha256")
    .update(`kaizen-hosted-upload\0${projectId}\0${assetId}`)
    .digest();
  digest[6] = (digest[6] & 15) | 64;
  digest[8] = (digest[8] & 63) | 128;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const publicResult = (item: UploadRecord) => ({
  id: item.id,
  projectId: item.project_id,
  assetId: item.asset_id,
  bytes: item.bytes,
  sha256: item.sha256,
  status: item.status,
  cancelRequested: item.cancel_requested,
});
const retry = () =>
  new HostedHelperError(
    409,
    "This upload needs its previous operation to finish or recover. Resume the original import.",
  );
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export class HostedUploads {
  private origins: Set<string>;
  private active = 0;
  constructor(private services: UploadServices) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(services.workerId))
      throw new Error("Invalid upload worker configuration.");
    this.origins = new Set(
      parseAllowedOrigins(
        services.origins.join(","),
        [],
        "ALLOWED_STUDIO_ORIGINS",
      ),
    );
  }
  private rpc(name: string, args: Record<string, unknown>) {
    return this.services.rpc(name, args);
  }
  private async read(id: string, actor?: string): Promise<UploadRecord> {
    const item = await this.rpc("builder_upload_worker_read", {
      request_id: id,
      worker: this.services.workerId,
      actor: actor || null,
    });
    if (
      item?.id !== id ||
      item.worker_id !== this.services.workerId ||
      !validProjectId(item.project_id) ||
      !accountId(item.asset_id) ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 1 ||
      item.bytes > MAX_UPLOAD_BYTES ||
      (item.owner_token !== null && !accountId(item.owner_token))
    )
      throw retry();
    return item;
  }
  private async own(
    item: UploadRecord,
    cleanup: boolean,
  ): Promise<UploadAttempt> {
    const { spool } = this.services;
    const existing = await spool.state(item.id);
    if (!(cleanup && existing?.released))
      await spool.reserve(item.id, item.bytes, cleanup);
    let attempt = (await spool.state(item.id))?.attempt;
    if (item.owner_token) {
      const owner = await spool.attempt(item.id, item.owner_token);
      if (
        !owner ||
        (owner.pid !== process.pid && !uploadAttemptStopped(owner)) ||
        owner.host !== hostname()
      )
        throw retry();
    }
    if (
      !attempt ||
      attempt.pid !== process.pid ||
      attempt.host !== hostname()
    ) {
      if (attempt && !uploadAttemptStopped(attempt)) throw retry();
      attempt = {
        token: randomUUID(),
        pid: process.pid,
        host: hostname(),
        receipt: null,
      };
      // Old records are retained: if this process stops before the claim, the
      // next worker can still prove the database's previous owner stopped.
      await spool.setAttempt(item.id, attempt);
    }
    try {
      await this.rpc("builder_upload_claim", {
        request_id: item.id,
        worker: this.services.workerId,
        token: attempt.token,
        previous_owner:
          item.owner_token === attempt.token ? null : item.owner_token,
        cleanup_only: cleanup,
      });
    } catch (error) {
      const current = await this.read(item.id);
      if (
        current.owner_token !== attempt.token ||
        (cleanup && current.status !== "removing")
      )
        throw error;
    }
    return attempt;
  }
  private async assert(
    item: UploadRecord,
    attempt: UploadAttempt,
    actor: RepositoryActor,
    storing = false,
  ) {
    if (actor.expiresAt <= Date.now())
      throw new HostedHelperError(
        401,
        "Sign in again to continue this upload.",
      );
    return this.rpc("builder_upload_assert", {
      request_id: item.id,
      worker: this.services.workerId,
      token: attempt.token,
      actor: actor.id,
      storing,
    });
  }
  private async tidy(item: UploadRecord) {
    const { spool } = this.services,
      state = await spool.state(item.id);
    if (state) {
      await spool.release(item.id);
      await spool.forget(item.id);
    }
    await this.rpc("builder_upload_cleanup_ack", {
      request_id: item.id,
      worker: this.services.workerId,
      completed: item.completed_token,
    });
  }
  private async finish(
    item: UploadRecord,
    actor: RepositoryActor,
    existingProvider = false,
  ) {
    if (item.status === "stored") {
      await this.tidy(item);
      return json(publicResult(item));
    }
    const attempt = await this.own(item, false),
      { spool, provider } = this.services;
    // Establish exact local bytes before allowing the provider to receive them.
    const local = existingProvider
      ? null
      : await spool.verify(item.id, item.sha256);
    await this.assert(item, attempt, actor, true);
    const stored = existingProvider
      ? await provider.verify(item)
      : await provider.ensure(item, local!.path);
    await this.assert(item, attempt, actor, true);
    const receipt = {
      id: item.id,
      attemptId: attempt.token,
      ...stored,
      verifiedAt: new Date().toISOString(),
    };
    await spool.setAttempt(item.id, { ...attempt, receipt });
    try {
      await this.rpc("builder_upload_finish", {
        request_id: item.id,
        worker: this.services.workerId,
        token: attempt.token,
        verification: receipt,
      });
    } catch (error) {
      // Readback reconciles a committed finish whose response was lost. Keep
      // both local/provider data if that outcome remains uncertain.
      const current = await this.read(item.id, actor.id);
      if (
        current.status !== "stored" ||
        current.completed_token !== attempt.token
      )
        throw error;
    }
    const current = await this.read(item.id, actor.id);
    if (current.status !== "stored") throw retry();
    await this.tidy(current);
    return json(publicResult(current));
  }
  private async adopt(file: FileDescription, actor: RepositoryActor) {
    const args = {
      target: file.projectId,
      actor: actor.id,
      request_id: hostedUploadId(file.projectId, file.assetId),
      asset: file.assetId,
      file_bytes: file.bytes,
      file_hash: file.sha256,
      file_mime: file.mime,
      asset_kind: file.kind,
      worker: this.services.workerId,
    };
    const item = await this.rpc("builder_asset_adoption_context", args);
    if (
      item?.id !== args.request_id ||
      item.project_id !== file.projectId ||
      item.asset_id !== file.assetId
    )
      throw retry();
    // A provider write whose SQL reply was lost still belongs to its original
    // upload. Reconcile that owner before allowing any library registration.
    if (item.pendingUpload)
      return this.finish(await this.read(item.id, actor.id), actor, true);
    const stored = await this.services.provider.verify(item);
    if (actor.expiresAt <= Date.now())
      throw new HostedHelperError(401, "Sign in again to recover this file.");
    return json(
      await this.rpc("builder_asset_adopt_finish", {
        ...args,
        verification: { ...stored, verifiedAt: new Date().toISOString() },
      }),
    );
  }
  private async cancel(item: UploadRecord, actor: RepositoryActor) {
    await this.rpc("builder_upload_cancel", {
      target: item.project_id,
      actor: actor.id,
      request_id: item.id,
    });
    item = await this.read(item.id);
    return this.remove(item);
  }
  private async remove(item: UploadRecord) {
    if (["stored", "removed"].includes(item.status)) {
      await this.tidy(item);
      return json(publicResult(item));
    }
    const attempt = await this.own(item, true);
    await this.services.provider.remove(item);
    await this.services.spool.release(item.id);
    const receipt = {
      id: item.id,
      attemptId: attempt.token,
      localRemoved: true,
      providerRemoved: true,
      verifiedAt: new Date().toISOString(),
    };
    // Persist the removal receipt before the RPC even though local bytes have gone.
    // Released states keep their existing attempt until the database confirms cleanup.
    await this.services.spool.setCompletion(item.id, attempt.token, receipt);
    try {
      await this.rpc("builder_upload_remove_finish", {
        request_id: item.id,
        worker: this.services.workerId,
        token: attempt.token,
        verification: receipt,
      });
    } catch (error) {
      const current = await this.read(item.id);
      if (
        current.status !== "removed" ||
        current.completed_token !== attempt.token
      )
        throw error;
    }
    const current = await this.read(item.id);
    if (current.status !== "removed") throw retry();
    await this.tidy(current);
    return json(publicResult(current));
  }
  /** Background work uses the same file lock and durable ownership as requests. */
  async maintain(shouldStop = () => false) {
    const summary: {
      examined: number;
      cleaned: number;
      deferred: number;
      catalogued?: number;
      copiesPurged?: number;
    } = { examined: 0, cleaned: 0, deferred: 0 };
    const ids = await this.rpc("builder_upload_cleanup_queue", {
      worker: this.services.workerId,
      batch_size: 20,
    });
    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      ids.some((id) => !accountId(id))
    )
      throw new Error("Invalid upload maintenance response.");
    for (const id of ids) {
      if (shouldStop() || this.active >= 4) break;
      summary.examined++;
      this.active++;
      try {
        const cleaned = await this.services.spool.withUpload(id, async () => {
          const prepared = await this.rpc("builder_upload_cleanup_prepare", {
            request_id: id,
            worker: this.services.workerId,
          });
          if (!prepared) return false;
          const item = await this.read(id);
          await this.remove(item);
          return true;
        });
        if (cleaned) summary.cleaned++;
      } catch {
        // Preserve the item and its quota. Other requests remain independent;
        // an unavailable object must not stop the rest of this bounded batch.
        summary.deferred++;
      } finally {
        this.active--;
      }
    }
    if (!shouldStop()) {
      const assets = new AssetCleanupWorker({
        ...this.services,
        fileLockId: hostedUploadId,
      });
      for (const id of await assets.discoveryQueue()) {
        if (shouldStop() || this.active >= 4) break;
        summary.examined++;
        this.active++;
        try {
          if (await assets.discover(id))
            summary.catalogued = (summary.catalogued || 0) + 1;
        } catch {
          summary.deferred++;
        } finally {
          this.active--;
        }
      }
      for (const id of shouldStop() ? [] : await assets.queue()) {
        if (shouldStop() || this.active >= 4) break;
        summary.examined++;
        this.active++;
        try {
          await assets.run(id);
          summary.cleaned++;
        } catch {
          summary.deferred++;
        } finally {
          this.active--;
        }
      }
    }
    if (!shouldStop()) {
      const copies = await this.rpc("builder_project_copy_purge_queue", {
        worker: this.services.workerId,
        batch_size: 20,
      });
      if (
        !Array.isArray(copies) ||
        copies.length > 20 ||
        copies.some((id) => !accountId(id))
      )
        throw new Error("Invalid copy cleanup response.");
      for (const target of copies) {
        if (shouldStop()) break;
        try {
          const purged = await this.rpc("builder_project_copy_purge", {
            target,
            worker: this.services.workerId,
          });
          if (typeof purged !== "boolean")
            throw new Error("Invalid copy cleanup result.");
          if (purged) summary.copiesPurged = (summary.copiesPurged || 0) + 1;
        } catch {
          summary.deferred++;
        }
      }
    }
    return summary;
  }
  async handle(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    let counted = false,
      result: Response;
    try {
      if (origin && !this.origins.has(origin))
        throw new HostedHelperError(
          403,
          "This website cannot connect to the upload service.",
        );
      const url = new URL(request.url),
        suffix = url.pathname.slice(HOSTED_UPLOAD_PATH.length);
      const adopting = suffix === "/adopt";
      if (
        !url.pathname.startsWith(HOSTED_UPLOAD_PATH) ||
        url.search ||
        url.hash ||
        (!adopting && !/^(?:\/[a-f0-9-]{36}(?:\/finish)?)?$/.test(suffix))
      )
        throw new HostedHelperError(404, "Upload address not found.");
      if (request.method === "OPTIONS")
        return this.headers(new Response(null, { status: 204 }), origin);
      if (suffix.endsWith("/finish") && request.method !== "POST")
        throw new HostedHelperError(405, "Use POST to finish an upload.");
      if (adopting && request.method !== "POST")
        throw new HostedHelperError(
          405,
          "Use POST to verify an existing file.",
        );
      if (
        (!suffix || adopting || ["HEAD", "PATCH"].includes(request.method)) &&
        request.headers.get("tus-resumable") !== "1.0.0"
      )
        throw new HostedHelperError(
          412,
          "Use the supported resumable upload protocol.",
        );
      if (
        request.method === "POST" &&
        (request.headers.has("transfer-encoding") ||
          ![null, "0"].includes(request.headers.get("content-length")) ||
          request.headers.has("content-type"))
      )
        throw new HostedHelperError(
          400,
          "Send file bytes through the resumable upload request.",
        );
      if (this.active >= 4)
        throw new HostedHelperError(
          429,
          "The upload service is busy. Resume after another upload finishes.",
        );
      this.active++;
      counted = true;
      const match = /^Bearer ([a-zA-Z0-9_.-]+)$/i.exec(
        request.headers.get("authorization") || "",
      );
      if (!match) throw new HostedHelperError(401, "Sign in to upload files.");
      const actor = await this.services.access.verify(match[1]);
      let id = suffix.split("/")[1],
        file: FileDescription | undefined;
      if ((!suffix || adopting) && request.method === "POST") {
        if (
          request.headers.has("upload-defer-length") ||
          request.headers.has("upload-concat") ||
          request.headers.has("transfer-encoding") ||
          ![null, "0"].includes(request.headers.get("content-length")) ||
          request.headers.has("content-type")
        )
          throw new HostedHelperError(
            400,
            "Start the upload before sending file bytes.",
          );
        file = description(request);
        id = hostedUploadId(file.projectId, file.assetId);
        if (!adopting)
          await this.rpc("builder_upload_reserve", {
            target: file.projectId,
            actor: actor.id,
            request_id: id,
            asset: file.assetId,
            file_bytes: file.bytes,
            file_hash: file.sha256,
            file_mime: file.mime,
            asset_kind: file.kind,
            worker: this.services.workerId,
          });
      } else if (!accountId(id))
        throw new HostedHelperError(404, "Upload address not found.");
      result = await this.services.spool.withUpload(id, async () => {
        if (adopting) return this.adopt(file!, actor);
        let item = await this.read(
          id,
          request.method === "DELETE" ? undefined : actor.id,
        );
        if (suffix.endsWith("/finish") && request.method === "POST")
          return this.finish(item, actor);
        if (request.method === "DELETE" && suffix === `/${id}`)
          return this.cancel(item, actor);
        if (!file && !["HEAD", "PATCH"].includes(request.method))
          throw new HostedHelperError(405, "Unsupported upload operation.");
        if (item.status === "stored" || item.status === "storing") {
          if (request.method === "HEAD" || file)
            return new Response(null, {
              status: file ? 201 : 200,
              headers: {
                Location: `${HOSTED_UPLOAD_PATH}/${id}`,
                "Upload-Length": String(item.bytes),
                "Upload-Offset": String(item.bytes),
              },
            });
          throw retry();
        }
        const attempt = await this.own(item, false);
        await this.assert(item, attempt, actor);
        if (file && (await this.services.spool.inspect(id)))
          return new Response(null, {
            status: 201,
            headers: { Location: `${HOSTED_UPLOAD_PATH}/${id}` },
          });
        const headers = new Headers(request.headers);
        if (file)
          headers.set(
            "upload-metadata",
            `reservation ${Buffer.from(id).toString("base64")}`,
          );
        const tus = new Server({
          path: HOSTED_UPLOAD_PATH,
          datastore: this.services.spool.store,
          namingFunction: () => id,
          maxSize: item.bytes,
          relativeLocation: true,
          respectForwardedHeaders: false,
          allowedOrigins: [...this.origins],
          onResponseError: (_request, error: any) => ({
            status_code: error.status || error.status_code || 500,
            body: "The upload did not finish. Resume the original import.",
          }),
        });
        const response = await tus.handleWeb(new Request(request, { headers }));
        await this.assert(item, attempt, actor);
        if (request.method === "PATCH" && response.status === 204) {
          const offset = response.headers.get("upload-offset");
          if (!offset || !/^(0|[1-9][0-9]*)$/.test(offset)) throw retry();
          await this.rpc("builder_upload_progress", {
            request_id: id,
            worker: this.services.workerId,
            token: attempt.token,
            actor: actor.id,
            received: Number(offset),
          });
        }
        return response;
      });
    } catch (error) {
      const code = error?.code;
      const status =
        error instanceof HostedHelperError
          ? error.status
          : code === "P0403"
            ? 403
            : code === "P0429"
              ? 429
              : code === "P0409"
                ? 409
                : code === "22023"
                  ? 400
                  : 503;
      const message =
        error instanceof HostedHelperError ||
        error instanceof UploadProviderError
          ? error.message
          : status === 429
            ? "This billing account cannot accept another upload. Finish or cancel pending imports, or check its storage plan."
            : status === 403
              ? "Upload access has changed. Sign in with the original account or check website access."
              : "The upload could not finish. Its data has been kept; resume the original import to retry.";
      result = json({ error: message }, status);
    } finally {
      if (counted) this.active--;
    }
    return this.headers(
      result,
      origin && this.origins.has(origin) ? origin : null,
    );
  }
  private headers(result: Response, origin: string | null) {
    result.headers.set("Cache-Control", "no-store");
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("Tus-Resumable", "1.0.0");
    result.headers.set(
      "Access-Control-Allow-Methods",
      "POST, HEAD, PATCH, DELETE, OPTIONS",
    );
    result.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata",
    );
    result.headers.set(
      "Access-Control-Expose-Headers",
      "Location, Upload-Length, Upload-Offset, Tus-Resumable",
    );
    if (origin) {
      result.headers.set("Access-Control-Allow-Origin", origin);
      result.headers.set("Vary", "Origin");
    }
    return result;
  }
}
