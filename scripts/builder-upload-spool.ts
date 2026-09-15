/** Private, bounded temporary storage for the hosted upload service. */
import { FileStore } from "@tus/file-store";
import { Upload } from "@tus/server";
import { constants } from "node:fs";
import { lstat, open, readdir, rename, statfs, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { privateDirectory, privateFile } from "./builder-hosted-folders";
import { HostedHelperError, accountId } from "./builder-hosted-auth";
import { withRecoveryLock } from "./release-recovery.mjs";

export const MAX_UPLOAD_BYTES = 50 * 1024 ** 2;
const STATE_ALLOWANCE = 64 * 1024;
const unavailable = () =>
  new HostedHelperError(
    503,
    "Temporary upload storage needs an operator check. Your files have been kept.",
  );
const busy = () =>
  new HostedHelperError(
    409,
    "This upload is already being processed. Resume after that request finishes.",
  );
export type UploadAttempt = {
  token: string;
  pid: number;
  host: string;
  receipt: Record<string, unknown> | null;
};
export type UploadSpoolState = {
  version: 1;
  id: string;
  bytes: number;
  released: boolean;
  attempt: UploadAttempt | null;
  previousAttempts: UploadAttempt[];
};
export type UploadSpoolLimits = {
  bytes: number;
  files: number;
  freeBytes: number;
};
const defaults: UploadSpoolLimits = {
  bytes: 2 * 1024 ** 3,
  files: 1024,
  freeBytes: 2 * 1024 ** 3,
};
const validBytes = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  Number(value) >= 1 &&
  Number(value) <= MAX_UPLOAD_BYTES;
function validateState(value: any): asserts value is UploadSpoolState {
  const attempt = value?.attempt;
  if (
    !value ||
    Object.keys(value).sort().join(",") !==
      "attempt,bytes,id,previousAttempts,released,version" ||
    value.version !== 1 ||
    !accountId(value.id) ||
    !validBytes(value.bytes) ||
    typeof value.released !== "boolean" ||
    !Array.isArray(value.previousAttempts) ||
    value.previousAttempts.length > 64 ||
    new Set(value.previousAttempts.map((item: any) => item?.token)).size !==
      value.previousAttempts.length ||
    (attempt !== null &&
      (!attempt ||
        Object.keys(attempt).sort().join(",") !== "host,pid,receipt,token" ||
        !accountId(attempt.token) ||
        !Number.isSafeInteger(attempt.pid) ||
        attempt.pid <= 0 ||
        typeof attempt.host !== "string" ||
        !attempt.host ||
        attempt.host.length > 255 ||
        (attempt.receipt !== null &&
          (typeof attempt.receipt !== "object" ||
            Array.isArray(attempt.receipt)))))
  )
    throw unavailable();
  for (const previous of value.previousAttempts) {
    if (!previous || previous.token === attempt?.token) throw unavailable();
    validateState({ ...value, attempt: previous, previousAttempts: [] });
  }
}
export function uploadAttemptStopped(attempt: UploadAttempt) {
  if (attempt.host !== os.hostname()) return false;
  try {
    process.kill(attempt.pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}

/** All operations run beneath a private service-owned root, never a project checkout. */
export class UploadSpool {
  readonly store: FileStore;
  private readonly limits: Readonly<UploadSpoolLimits>;
  private readonly active = new Set<string>();
  private constructor(
    readonly directory: string,
    limits: UploadSpoolLimits,
  ) {
    this.limits = Object.freeze({ ...limits });
    this.store = new ReservedUploadStore(this, path.join(directory, "files"));
  }
  static async create(directory: string, limits: UploadSpoolLimits = defaults) {
    if (
      Object.keys(limits).sort().join(",") !== "bytes,files,freeBytes" ||
      !Object.values(limits).every(Number.isSafeInteger) ||
      limits.bytes < 1 ||
      limits.bytes > 1024 ** 4 ||
      limits.files < 1 ||
      limits.files > 10000 ||
      limits.freeBytes < 0 ||
      limits.freeBytes > 1024 ** 4
    )
      throw unavailable();
    await privateDirectory(directory);
    for (const name of ["files", "states", "locks"])
      await privateDirectory(path.join(directory, name));
    return new UploadSpool(directory, limits);
  }
  private file(id: string, kind: "files" | "states" | "locks") {
    if (!accountId(id))
      throw new HostedHelperError(400, "Invalid upload address.");
    return path.join(
      this.directory,
      kind,
      kind === "states" ? `${id}.json` : id,
    );
  }
  async state(id: string): Promise<UploadSpoolState | null> {
    const file = this.file(id, "states");
    try {
      await lstat(file);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw unavailable();
    }
    await privateFile(file, STATE_ALLOWANCE);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const value = JSON.parse(await handle.readFile("utf8"));
      validateState(value);
      if (value.id !== id) throw unavailable();
      return value;
    } finally {
      await handle.close();
    }
  }
  private async save(value: UploadSpoolState) {
    validateState(value);
    const bytes = JSON.stringify(value) + "\n";
    if (Buffer.byteLength(bytes) > STATE_ALLOWANCE) throw unavailable();
    const destination = this.file(value.id, "states"),
      temporary = `${destination}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
      const parent = await open(
        path.dirname(destination),
        constants.O_RDONLY | constants.O_DIRECTORY,
      );
      try {
        await parent.sync();
      } finally {
        await parent.close();
      }
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  /** The account/database reservation must exist first. This bounds additional VPS temporary copies. */
  async reserve(id: string, bytes: number, removalOnly = false) {
    this.file(id, "states");
    if (!validBytes(bytes))
      throw new HostedHelperError(400, "Invalid upload file size.");
    return this.lock("capacity", async () => {
      const existing = await this.state(id);
      if (existing) {
        if (existing.bytes !== bytes || (existing.released && !removalOnly))
          throw new HostedHelperError(
            409,
            "This upload reservation changed or was released.",
          );
        return existing;
      }
      // A reservation whose POST never created a local file still needs a
      // durable cleanup receipt, but must not reserve the file's bytes again.
      if (removalOnly) {
        const orphan = await lstat(this.file(id, "files")).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (orphan) throw unavailable();
      }
      const additionalBytes = removalOnly ? 0 : bytes;
      const names = await readdir(path.join(this.directory, "states"));
      // Orphaned transaction files remain charged and require reconciliation.
      let total = 0,
        count = 0,
        outstanding = 0;
      for (const name of names) {
        if (!/^[a-f0-9-]{36}\.json$/.test(name)) throw unavailable();
        const item = await this.state(name.slice(0, -5));
        if (!item) throw unavailable();
        total += STATE_ALLOWANCE;
        if (item.released) continue;
        total += item.bytes;
        count++;
        const current = await this.inspect(item.id);
        outstanding += item.bytes - (current?.size || 0);
      }
      if (
        (!removalOnly && count >= this.limits.files) ||
        total + additionalBytes + STATE_ALLOWANCE > this.limits.bytes
      )
        throw new HostedHelperError(
          429,
          "Temporary upload storage is full. Finish or cancel a pending import before starting another.",
        );
      const disk = await statfs(this.directory, { bigint: true });
      if (
        disk.bavail * disk.bsize <
        BigInt(
          (removalOnly ? 0 : this.limits.freeBytes + outstanding) +
            additionalBytes +
            STATE_ALLOWANCE,
        )
      )
        throw new HostedHelperError(
          503,
          "The upload service is short of free disk space. Resume after storage is available.",
        );
      const item: UploadSpoolState = {
        version: 1,
        id,
        bytes,
        released: removalOnly,
        attempt: null,
        previousAttempts: [],
      };
      await this.save(item);
      return item;
    });
  }
  private async lock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.active.has(id)) throw busy();
    this.active.add(id);
    try {
      await privateDirectory(this.directory);
      await privateDirectory(path.join(this.directory, "locks"));
      // Uses existing process-lock recovery: never take over by lock age.
      return await withRecoveryLock(
        path.join(this.directory, "locks", id),
        operation,
        id,
      );
    } finally {
      this.active.delete(id);
    }
  }
  async withUpload<T>(id: string, operation: () => Promise<T>): Promise<T> {
    this.file(id, "locks");
    return this.lock(id, async () => {
      await privateDirectory(path.join(this.directory, "files"));
      await privateDirectory(path.join(this.directory, "states"));
      return operation();
    });
  }
  requireOperation(id: string) {
    if (!this.active.has(id)) throw unavailable();
  }
  /** Call inside withUpload, before claiming the corresponding database owner token. */
  async setAttempt(id: string, attempt: UploadAttempt) {
    if (!this.active.has(id)) throw unavailable();
    const state = await this.state(id);
    if (!state) throw unavailable();
    if (
      state.attempt &&
      state.attempt.token !== attempt.token &&
      !uploadAttemptStopped(state.attempt)
    )
      throw busy();
    if (
      state.attempt?.token === attempt.token &&
      (state.attempt.pid !== attempt.pid || state.attempt.host !== attempt.host)
    )
      throw unavailable();
    const previousAttempts =
      state.attempt && state.attempt.token !== attempt.token
        ? [...state.previousAttempts, state.attempt]
        : state.previousAttempts;
    await this.save({ ...state, attempt, previousAttempts });
  }
  async attempt(id: string, token: string) {
    const state = await this.state(id);
    return state?.attempt?.token === token
      ? state.attempt
      : state?.previousAttempts.find((item) => item.token === token) || null;
  }
  async setCompletion(
    id: string,
    token: string,
    receipt: Record<string, unknown>,
  ) {
    this.requireOperation(id);
    const state = await this.state(id);
    if (!state?.attempt || state.attempt.token !== token) throw unavailable();
    await this.setAttempt(id, { ...state.attempt, receipt });
  }
  async inspect(id: string) {
    const info = await lstat(this.file(id, "files")).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return null;
    const state = await this.state(id);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1 ||
      info.mode & 0o077 ||
      info.uid !== process.getuid?.() ||
      !state ||
      state.released ||
      info.size > state.bytes
    )
      throw unavailable();
    return info;
  }
  async verify(id: string, expectedHash: string) {
    if (!this.active.has(id) || !/^[a-f0-9]{64}$/.test(expectedHash))
      throw unavailable();
    const state = await this.state(id),
      info = await this.inspect(id),
      upload = await this.store.getUpload(id);
    if (
      !state ||
      !info ||
      info.size !== state.bytes ||
      upload.size !== state.bytes ||
      upload.offset !== state.bytes
    )
      throw new HostedHelperError(
        409,
        "This upload is incomplete. Resume the original import.",
      );
    const hash = createHash("sha256");
    const source = await open(
      this.file(id, "files"),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      for await (const chunk of source.createReadStream({ autoClose: false }))
        hash.update(chunk);
    } finally {
      await source.close();
    }
    if (hash.digest("hex") !== expectedHash)
      throw new HostedHelperError(
        409,
        "The uploaded file did not match its checksum. Cancel this import and select the file again.",
      );
    return {
      path: this.file(id, "files"),
      bytes: state.bytes,
      sha256: expectedHash,
    };
  }
  /** Remove bytes and metadata under the operation lock; only then release the local reservation. */
  async release(id: string) {
    if (!this.active.has(id)) throw unavailable();
    const state = await this.state(id);
    if (!state) throw unavailable();
    if (state.released) return;
    await this.inspect(id);
    await unlink(this.file(id, "files")).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await this.store.configstore.delete(id);
    if (
      await lstat(this.file(id, "files")).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      })
    )
      throw unavailable();
    const parent = await open(
      path.join(this.directory, "files"),
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
    await this.save({ ...state, released: true });
  }
  /** Only after the service has acknowledged terminal database completion. */
  async forget(id: string) {
    this.requireOperation(id);
    const state = await this.state(id);
    if (!state?.released) throw unavailable();
    if (
      await lstat(this.file(id, "files")).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      })
    )
      throw unavailable();
    await unlink(this.file(id, "states"));
    const parent = await open(
      path.join(this.directory, "states"),
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  }
}

/** The stock FileStore truncates on create. This store requires a prior reservation and exclusive creation. */
class ReservedUploadStore extends FileStore {
  constructor(
    private spool: UploadSpool,
    directory: string,
  ) {
    super({
      directory,
      expirationPeriodInMilliseconds: 0,
      // The durable reservation is the only metadata authority. Reconstructing
      // TUS metadata avoids a second mutable/truncatable JSON file and survives
      // a crash between exclusive byte-file creation and the POST response.
      configstore: {
        get: async (id) => {
          const state = await spool.state(id);
          if (!state || state.released) return undefined;
          return new Upload({
            id,
            size: state.bytes,
            offset: 0,
            metadata: { reservation: id },
          });
        },
        set: async (id, upload) => {
          const state = await spool.state(id);
          if (
            !state ||
            state.released ||
            upload.size !== state.bytes ||
            upload.metadata?.reservation !== id
          )
            throw unavailable();
        },
        // Metadata disappears when release marks the reservation released.
        delete: async () => {},
      },
    });
    this.extensions = ["creation"];
  }
  override async create(upload: Upload) {
    this.spool.requireOperation(upload.id);
    const state = await this.spool.state(upload.id);
    if (
      !state ||
      state.released ||
      upload.size !== state.bytes ||
      upload.offset !== 0 ||
      upload.metadata?.reservation !== upload.id ||
      Object.keys(upload.metadata).join(",") !== "reservation"
    )
      throw unavailable();
    const file = path.join(this.directory, upload.id);
    const handle = await open(file, "wx", 0o600);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await this.configstore.set(upload.id, upload);
    return upload;
  }
  override async getUpload(id: string) {
    await this.spool.inspect(id);
    const upload = await super.getUpload(id),
      state = await this.spool.state(id);
    if (
      !state ||
      state.released ||
      upload.size !== state.bytes ||
      upload.metadata?.reservation !== id ||
      Object.keys(upload.metadata).join(",") !== "reservation"
    )
      throw unavailable();
    return upload;
  }
  override async write(readable: Readable, id: string, offset: number) {
    this.spool.requireOperation(id);
    const upload = await this.getUpload(id);
    if (!Number.isSafeInteger(offset) || offset !== upload.offset)
      throw new HostedHelperError(
        409,
        "The upload offset changed. Resume the original import.",
      );
    const file = await open(
      path.join(this.directory, id),
      constants.O_RDWR | constants.O_NOFOLLOW,
    );
    let received = 0;
    try {
      if ((await file.stat()).size !== offset) throw unavailable();
      for await (const value of readable) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (received + chunk.length > upload.size! - offset)
          throw new HostedHelperError(
            413,
            "This upload exceeds its reserved file size.",
          );
        let written = 0;
        while (written < chunk.length) {
          const result = await file.write(
            chunk,
            written,
            chunk.length - written,
            offset + received + written,
          );
          if (!result.bytesWritten) throw unavailable();
          written += result.bytesWritten;
        }
        received += chunk.length;
      }
      await file.sync();
      return offset + received;
    } finally {
      await file.close();
    }
  }
  override async declareUploadLength(): Promise<void> {
    throw new HostedHelperError(400, "Choose the file size before uploading.");
  }
  override async remove(): Promise<void> {
    throw new HostedHelperError(
      409,
      "Cancel the import through the upload service before removing its data.",
    );
  }
}
