/** Retained-file cleanup shares upload locks and stopped-process recovery. */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { accountId } from "./builder-hosted-auth";
import { validProjectId } from "../shared/builderProjects";
import {
  MAX_UPLOAD_BYTES,
  UploadSpool,
  uploadAttemptStopped,
  type UploadAttempt,
} from "./builder-upload-spool";
import type {
  StorageProbe,
  UploadObject,
  uploadStorageProvider,
} from "./builder-upload-provider";

export type CleanupRecord = UploadObject & {
  file_url: string | null;
  worker_id: string;
  phase: "pending" | "removing" | "removed";
  owner_token: string | null;
  completed_token: string | null;
};
export type NativeCleanupHooks = {
  queue: () => Promise<unknown>;
  beforeClaim: (
    item: Readonly<CleanupRecord>,
    attempt: Readonly<UploadAttempt>,
  ) => Promise<void>;
};
type Services = {
  workerId: string;
  spool: UploadSpool;
  rpc: (name: string, args: Record<string, unknown>) => Promise<any>;
  provider: ReturnType<typeof uploadStorageProvider>;
  fileLockId: (project: string, asset: string) => string;
  native?: NativeCleanupHooks;
};
const retry = () =>
  new Error(
    "Stored file cleanup needs reconciliation. Its records and charges are retained.",
  );

export class AssetCleanupWorker {
  constructor(private services: Services) {}
  private rpc(name: string, args: Record<string, unknown>) {
    return this.services.rpc(name, { ...args, worker: this.services.workerId });
  }
  private checkedIds(ids: unknown): string[] {
    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      ids.some((id) => !accountId(id))
    )
      throw retry();
    return ids;
  }
  private async list(name: string): Promise<string[]> {
    return this.checkedIds(await this.rpc(name, { batch_size: 20 }));
  }
  async queue() {
    if (this.services.native)
      return this.checkedIds(await this.services.native.queue());
    return this.list("builder_asset_cleanup_queue");
  }
  discoveryQueue() {
    return this.list("builder_asset_discovery_queue");
  }
  private async observation(id: string): Promise<StorageProbe | null> {
    const item = await this.rpc("builder_asset_discovery_read", {
      request_id: id,
    });
    if (item === null) return null;
    if (
      item?.id !== id ||
      item.worker_id !== this.services.workerId ||
      !validProjectId(item.project_id) ||
      !accountId(item.asset_id) ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 0 ||
      item.bytes > MAX_UPLOAD_BYTES ||
      item.phase !== "pending" ||
      item.object_scope !== "orphan"
    )
      throw retry();
    return item;
  }
  /** Read-only discovery cannot create library metadata or authorize removal. */
  async discover(id: string): Promise<boolean> {
    const initial = await this.observation(id);
    if (!initial) return false;
    return this.services.spool.withUpload(
      this.services.fileLockId(initial.project_id, initial.asset_id),
      async () => {
        const item = await this.observation(id);
        if (!item) return false;
        if (
          item.project_id !== initial.project_id ||
          item.asset_id !== initial.asset_id ||
          item.bucket_id !== initial.bucket_id ||
          item.object_name !== initial.object_name
        )
          throw retry();
        const measured = await this.services.provider.measure(item);
        const verification = {
          present: measured !== null,
          ...measured,
          verifiedAt: new Date().toISOString(),
        };
        try {
          const result = await this.rpc("builder_asset_discovery_finish", {
            request_id: id,
            verification,
          });
          if (typeof result?.catalogued !== "boolean") throw retry();
          return result.catalogued;
        } catch (error) {
          // A completed observation can lose its reply. A fresh read confirms
          // no pending work without inventing a new catalogue entry or receipt.
          if (await this.observation(id)) throw error;
          return false;
        }
      },
    );
  }
  private async read(id: string): Promise<CleanupRecord> {
    const item = await this.rpc("builder_asset_cleanup_read", {
      request_id: id,
    });
    if (
      item?.id !== id ||
      item.worker_id !== this.services.workerId ||
      !validProjectId(item.project_id) ||
      !accountId(item.asset_id) ||
      !(
        item.file_url === null ||
        (typeof item.file_url === "string" && item.file_url.length <= 8192)
      ) ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 0 ||
      item.bytes > MAX_UPLOAD_BYTES ||
      !["pending", "removing", "removed"].includes(item.phase) ||
      (item.owner_token !== null && !accountId(item.owner_token)) ||
      (item.completed_token !== null && !accountId(item.completed_token))
    )
      throw retry();
    return item;
  }
  private async tidy(item: CleanupRecord) {
    if (await this.services.spool.state(item.id)) {
      await this.services.spool.release(item.id);
      await this.services.spool.forget(item.id);
    }
    await this.rpc("builder_asset_cleanup_ack", {
      request_id: item.id,
      completed: item.completed_token,
    });
  }
  private async own(item: CleanupRecord): Promise<UploadAttempt> {
    const { spool } = this.services;
    // No file body is created. Empty legacy files still need a bounded recovery record.
    await spool.reserve(item.id, Math.max(1, item.bytes), true);
    let attempt = (await spool.state(item.id))?.attempt;
    if (item.owner_token) {
      const owner = await spool.attempt(item.id, item.owner_token);
      if (
        !owner ||
        owner.host !== hostname() ||
        (owner.pid !== process.pid && !uploadAttemptStopped(owner))
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
      await spool.setAttempt(item.id, attempt);
    }
    try {
      await this.services.native?.beforeClaim(item, attempt);
      await this.rpc("builder_asset_cleanup_claim", {
        request_id: item.id,
        token: attempt.token,
        previous_owner:
          item.owner_token === attempt.token ? null : item.owner_token,
      });
    } catch (error) {
      const current = await this.read(item.id);
      if (
        current.phase !== "removing" ||
        current.owner_token !== attempt.token
      ) {
        if (current.phase === "pending" && current.owner_token === null) {
          // A fresh reference can postpone a not-yet-claimed removal. Confirmed
          // pending state proves this attempt never had provider deletion authority.
          await spool.release(item.id);
          await spool.forget(item.id);
        }
        throw error;
      }
    }
    return attempt;
  }
  async run(id: string) {
    const { spool } = this.services,
      initial = await this.read(id);
    // Serialize against ordinary upload/adoption as well as another cleanup.
    return spool.withUpload(
      this.services.fileLockId(initial.project_id, initial.asset_id),
      () =>
        spool.withUpload(id, async () => {
          const item = await this.read(id);
          if (
            item.project_id !== initial.project_id ||
            item.asset_id !== initial.asset_id
          )
            throw retry();
          if (item.phase === "removed") {
            await this.tidy(item);
            return;
          }
          const attempt = await this.own(item);
          await this.services.provider.remove(item);
          await spool.release(id);
          const receipt = {
            id,
            attemptId: attempt.token,
            localRemoved: true,
            providerRemoved: true,
            verifiedAt: new Date().toISOString(),
          };
          await spool.setCompletion(id, attempt.token, receipt);
          try {
            await this.rpc("builder_asset_cleanup_finish", {
              request_id: id,
              token: attempt.token,
              verification: receipt,
            });
          } catch (error) {
            const current = await this.read(id);
            if (
              current.phase !== "removed" ||
              current.completed_token !== attempt.token
            )
              throw error;
          }
          const current = await this.read(id);
          if (
            current.phase !== "removed" ||
            current.completed_token !== attempt.token
          )
            throw retry();
          await this.tidy(current);
        }),
    );
  }
}
