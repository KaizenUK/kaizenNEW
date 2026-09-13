import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { HostedHelperError } from "./builder-hosted-auth";
import {
  privateDirectory,
  privateFile,
  unlinkedPath,
  type HostedWebsiteFolders,
} from "./builder-hosted-folders";

const limit = 4 * 1024 * 1024;
const digest = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const receiptError = () =>
  new HostedHelperError(
    503,
    "Saved website operation records need an operator check. Existing files and commits are kept.",
  );

/** Private, bounded, durable records. Call only while holding the project lock. */
export class HostedReceiptStore<T> {
  private observed = new Map<string, string | null>();
  constructor(
    private folders: HostedWebsiteFolders,
    private name:
      | "save-receipts.json"
      | "publication-receipts.json"
      | "build-receipts.json",
    private decode: (data: unknown, projectId: string) => T,
    private empty: () => T,
  ) {
    if (
      ![
        "save-receipts.json",
        "publication-receipts.json",
        "build-receipts.json",
      ].includes(name)
    )
      throw receiptError();
  }
  private file(id: string) {
    this.folders.admission(id);
    return path.join(this.folders.projectDirectory(id), this.name);
  }
  private async bytes(id: string) {
    const file = this.file(id);
    await unlinkedPath(file);
    const info = await lstat(file).catch((error) => {
      if (error.code !== "ENOENT") throw receiptError();
      return null;
    });
    if (!info) return null;
    await privateDirectory(this.folders.directory);
    await privateDirectory(path.join(this.folders.directory, "projects"));
    await privateDirectory(this.folders.projectDirectory(id));
    await privateFile(file, limit);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.ino !== info.ino ||
        opened.dev !== info.dev ||
        opened.nlink !== 1 ||
        (opened.mode & 0o777) !== 0o600 ||
        (process.getuid && opened.uid !== process.getuid()) ||
        !opened.size ||
        opened.size > limit
      )
        throw receiptError();
      // Bound allocation and reads even if the file grows after its size check.
      const bytes = Buffer.alloc(opened.size + 1);
      let length = 0;
      while (length < bytes.length) {
        const result = await handle.read(
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      const after = await handle.stat(),
        current = await lstat(file);
      if (
        length !== opened.size ||
        current.ino !== opened.ino ||
        current.dev !== opened.dev ||
        after.mtimeMs !== opened.mtimeMs ||
        after.ctimeMs !== opened.ctimeMs ||
        after.size !== opened.size
      )
        throw receiptError();
      return bytes.subarray(0, length);
    } finally {
      await handle.close();
    }
  }
  async read(id: string): Promise<T> {
    try {
      const bytes = await this.bytes(id);
      if (!bytes) {
        this.observed.set(id, null);
        return this.empty();
      }
      const value = JSON.parse(bytes.toString("utf8"));
      if (
        value?.version !== 1 ||
        value.projectId !== id ||
        Object.keys(value).some(
          (key) => !["version", "projectId", "data"].includes(key),
        )
      )
        throw receiptError();
      const decoded = this.decode(value.data, id);
      this.observed.set(id, digest(bytes));
      return decoded;
    } catch {
      this.observed.delete(id);
      throw receiptError();
    }
  }
  async write(id: string, data: T) {
    let temporary: string | undefined;
    try {
      if (!this.observed.has(id)) throw receiptError();
      const encoded = Buffer.from(
        JSON.stringify({ version: 1, projectId: id, data }),
      );
      if (encoded.length > limit) throw receiptError();
      this.decode(JSON.parse(encoded.toString("utf8")).data, id);
      const before = await this.bytes(id);
      if ((before ? digest(before) : null) !== this.observed.get(id))
        throw receiptError();
      if (before?.equals(encoded)) return;
      await privateDirectory(this.folders.directory);
      await privateDirectory(path.join(this.folders.directory, "projects"));
      const directory = this.folders.projectDirectory(id);
      await privateDirectory(directory);
      temporary = path.join(directory, `.${this.name}.${randomUUID()}.tmp`);
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(encoded);
        await file.sync();
      } finally {
        await file.close();
      }
      // Refuse a concurrent operator edit before replacing the previous record.
      const current = await this.bytes(id);
      if ((current ? digest(current) : null) !== this.observed.get(id))
        throw receiptError();
      await rename(temporary, this.file(id));
      temporary = undefined;
      const parent = await open(directory, "r");
      try {
        await parent.sync();
      } finally {
        await parent.close();
      }
      this.observed.set(id, digest(encoded));
    } catch {
      throw receiptError();
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
}
