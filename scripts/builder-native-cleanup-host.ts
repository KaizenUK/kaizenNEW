/** Private root inventory and bounded native-file cleanup service entry. */
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NativeAssetCleanup } from "./builder-native-asset-cleanup";
import { AssetCleanupWorker } from "./builder-asset-cleanup";
import { UploadSpool } from "./builder-upload-spool";
import { uploadStorageProvider } from "./builder-upload-provider";
import { hostedUploadId } from "./builder-hosted-uploads";
import { createReleaseClient } from "./builder-release-worker.mjs";

const invalid = () =>
  new Error(
    "Install the complete private native cleanup configuration and state directory.",
  );

/** The installed root service may read other accounts' retained repositories,
 * but its configuration and state must have no other writers. */
async function trustedDirectory(directory: string) {
  if (
    process.getuid?.() !== 0 ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory ||
    /[\u0000-\u001f]/.test(directory)
  )
    throw invalid();
  let current = directory;
  for (;;) {
    const info = await lstat(current);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== 0 ||
      info.mode & 0o022
    )
      throw invalid();
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function readNativeCleanupInventory(file: string) {
  if (
    !file ||
    !path.isAbsolute(file) ||
    path.resolve(file) !== file ||
    /[\u0000-\u001f]/.test(file)
  )
    throw invalid();
  await trustedDirectory(path.dirname(file));
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.uid !== 0 ||
      before.mode & 0o077 ||
      before.nlink !== 1 ||
      before.size < 1 ||
      before.size > 262144
    )
      throw invalid();
    const bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const part = await handle.read(
        bytes,
        length,
        bytes.length - length,
        length,
      );
      if (!part.bytesRead) break;
      length += part.bytesRead;
    }
    const after = await handle.stat(),
      named = await lstat(file);
    const stamp = (info: typeof before) =>
      [
        info.dev,
        info.ino,
        info.size,
        info.mtimeMs,
        info.ctimeMs,
        info.uid,
        info.mode,
        info.nlink,
      ].join(":");
    if (
      length !== before.size ||
      stamp(before) !== stamp(after) ||
      stamp(after) !== stamp(named)
    )
      throw invalid();
    return JSON.parse(bytes.subarray(0, length).toString("utf8")) as unknown;
  } finally {
    await handle.close();
  }
}

export async function runNativeCleanupBatch(
  worker: Pick<AssetCleanupWorker, "queue" | "run">,
  signal: AbortSignal,
) {
  const result = { examined: 0, removed: 0, deferred: 0, stopped: false };
  if (signal.aborted) return { ...result, stopped: true };
  const jobs = await worker.queue();
  for (const id of jobs) {
    if (signal.aborted) break;
    result.examined++;
    try {
      await worker.run(id);
      result.removed++;
    } catch {
      // A retained reference or an unconfirmed removal retains its record and
      // charge. Finish the bounded batch without losing independent work.
      result.deferred++;
    }
  }
  result.stopped = signal.aborted;
  return result;
}

export async function nativeCleanupService(
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
) {
  const inventory = await readNativeCleanupInventory(
    env.BUILDER_NATIVE_CLEANUP_INVENTORY || "",
  );
  const url = env.BUILDER_NATIVE_CLEANUP_SUPABASE_URL || "",
    key = env.BUILDER_NATIVE_CLEANUP_SERVICE_KEY || "";
  const client = createReleaseClient({ url, key });
  const native = new NativeAssetCleanup(inventory, client.rpc, signal);
  const directory = env.BUILDER_NATIVE_CLEANUP_DIRECTORY || "";
  if (
    !directory ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory ||
    directory === "/" ||
    /[\u0000-\u001f]/.test(directory)
  )
    throw invalid();
  await trustedDirectory(path.dirname(directory));
  const number = (name: string, fallback: number) => {
    const value = env[name];
    if (value !== undefined && !/^(0|[1-9][0-9]*)$/.test(value))
      throw invalid();
    const result = value === undefined ? fallback : Number(value);
    if (!Number.isSafeInteger(result)) throw invalid();
    return result;
  };
  const spool = await UploadSpool.create(directory, {
    bytes: number("BUILDER_NATIVE_CLEANUP_MAX_BYTES", 64 * 1024 ** 2),
    files: number("BUILDER_NATIVE_CLEANUP_MAX_FILES", 1024),
    freeBytes: number("BUILDER_NATIVE_CLEANUP_MIN_FREE_BYTES", 2 * 1024 ** 3),
  });
  return new AssetCleanupWorker({
    workerId: native.inventory.configuration.workerId,
    spool,
    rpc: client.rpc,
    provider: uploadStorageProvider({ url, serviceKey: key }),
    fileLockId: hostedUploadId,
    native,
  });
}

export async function runNativeCleanupCli() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    if (process.argv.length !== 2) throw invalid();
    const worker = await nativeCleanupService(process.env, controller.signal);
    const result = await runNativeCleanupBatch(worker, controller.signal);
    process.stdout.write(
      JSON.stringify({ operation: "native-file-cleanup", ...result }) + "\n",
    );
    if (result.deferred)
      process.stderr.write(
        "Native file cleanup retained deferred files and their charges. Check the private inventory, cleanup records and provider availability.\n",
      );
  } catch {
    process.stderr.write(
      "Native file cleanup could not finish. Check its private configuration, database coordination and state directory. Existing recovery records are retained.\n",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  void runNativeCleanupCli();
