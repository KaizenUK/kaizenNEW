import type { Asset } from "../../shared/visualBuilder";
import type { ImportFile } from "./assets";

export type ImportEntry = {
  path: string;
  size: number;
  state: "pending" | "uploaded" | "duplicate" | "error";
  asset?: Asset;
  uploadUrl?: string;
  error?: string;
};
export type ImportJob = {
  version: 1;
  id: string;
  scope: string;
  pack: string;
  createdAt: string;
  entries: ImportEntry[];
};
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  return (database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("kaizen-builder-imports", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("jobs", { keyPath: "scope" });
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      database = undefined;
      reject(
        new Error(
          "This browser could not open the upload recovery store. Enable website storage and try again.",
        ),
      );
    };
  }));
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode),
      request = work(tx);
    tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          tx.error?.name === "QuotaExceededError"
            ? "There is not enough browser storage to keep this pack for recovery. Free website storage or import a smaller batch. Existing uploaded files stay in the library."
            : "The upload recovery store could not be saved. Reload and resume the import.",
        ),
      );
  });
}
export const importQueue = {
  async load(scope: string): Promise<ImportJob | undefined> {
    return transaction(["jobs"], "readonly", (tx) =>
      tx.objectStore("jobs").get(scope),
    );
  },
  async create(
    scope: string,
    pack: string,
    files: ImportFile[],
  ): Promise<ImportJob> {
    const job: ImportJob = {
      version: 1,
      id: crypto.randomUUID(),
      scope,
      pack: pack.trim() || "Untitled pack",
      createdAt: new Date().toISOString(),
      entries: files.map((file) => ({
        path: file.path,
        size: file.file.size,
        state: "pending",
      })),
    };
    await transaction(["jobs", "files"], "readwrite", (tx) => {
      tx.objectStore("jobs").add(job);
      files.forEach((file, index) =>
        tx.objectStore("files").add(file.file, [job.id, index]),
      );
    });
    return job;
  },
  async save(job: ImportJob) {
    await transaction(["jobs"], "readwrite", (tx) =>
      tx.objectStore("jobs").put(job),
    );
  },
  async file(job: ImportJob, index: number): Promise<Blob> {
    const blob = await transaction<Blob>(["files"], "readonly", (tx) =>
      tx.objectStore("files").get([job.id, index]),
    );
    if (!blob)
      throw new Error(
        "The browser no longer has this file. Discard the pending import and select the pack again; completed files will be skipped.",
      );
    return blob;
  },
  async prepared(job: ImportJob, index: number, blob: Blob) {
    await transaction(["jobs", "files"], "readwrite", (tx) => {
      tx.objectStore("jobs").put(job);
      tx.objectStore("files").put(blob, [job.id, index]);
    });
  },
  async completed(job: ImportJob, index: number) {
    await transaction(["jobs", "files"], "readwrite", (tx) => {
      tx.objectStore("jobs").put(job);
      tx.objectStore("files").delete([job.id, index]);
    });
  },
  async discard(job: ImportJob) {
    await transaction(["jobs", "files"], "readwrite", (tx) => {
      tx.objectStore("jobs").delete(job.scope);
      job.entries.forEach((_, index) =>
        tx.objectStore("files").delete([job.id, index]),
      );
    });
  },
};
export async function withImportLock<T>(
  scope: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "Upload recovery needs a current browser on HTTPS or localhost.",
    );
  return navigator.locks.request(
    `kaizen-import:${scope}`,
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "This import is running in another tab. Pause it there before resuming here.",
        );
      return work();
    },
  );
}
