/** Physical release-store admission. Call while holding the store's operation
 * lock; measurements include retained, incomplete and unknown files. */
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, opendir, realpath, statfs } from "node:fs/promises";
import path from "node:path";
import { StorageAdmission } from "./storage-admission.mjs";

const GiB = 1024 ** 3;
export const defaultReleaseStorageLimits = Object.freeze({
  storeBytes: 8 * GiB,
  immutableBytes: 4 * GiB,
  freeBytes: 2 * GiB,
});
export function releaseStorageLimits(environment = process.env) {
  const result = { ...defaultReleaseStorageLimits };
  for (const [key, variable] of [
    ["storeBytes", "BUILDER_RELEASE_STORAGE_MAX_BYTES"],
    ["immutableBytes", "BUILDER_RELEASE_IMMUTABLE_MAX_BYTES"],
    ["freeBytes", "BUILDER_RELEASE_MIN_FREE_BYTES"],
  ]) {
    const value = environment[variable];
    if (value === undefined) continue;
    if (!/^(0|[1-9][0-9]*)$/.test(value)) throw configuration();
    result[key] = Number(value);
  }
  return validate(result);
}
const configuration = () =>
  new Error("Configure valid release-store capacity limits.");
function validate(limits) {
  if (
    Object.keys(limits).sort().join(",") !==
      "freeBytes,immutableBytes,storeBytes" ||
    !Object.values(limits).every(
      (value) =>
        Number.isSafeInteger(value) && value >= 0 && value <= 1024 * GiB,
    ) ||
    limits.storeBytes < 1 ||
    limits.immutableBytes < 1 ||
    limits.immutableBytes > limits.storeBytes
  )
    throw configuration();
  return Object.freeze({ ...limits });
}
export async function measureReleaseStorage(root) {
  if (!path.isAbsolute(root) || (await realpath(root)) !== root)
    throw configuration();
  const base = await lstat(root);
  if (!base.isDirectory()) throw configuration();
  let bytes = base.size,
    immutableBytes = 0,
    entries = 0;
  const walk = async (directory, depth) => {
    if (depth > 128)
      throw new Error("Release storage exceeds its directory inventory limit.");
    for await (const entry of await opendir(directory)) {
      if (++entries > 1000000)
        throw new Error("Release storage exceeds its file inventory limit.");
      const file = path.join(directory, entry.name),
        info = await lstat(file);
      if (
        info.dev !== base.dev ||
        (!info.isDirectory() && !info.isFile() && !info.isSymbolicLink())
      )
        throw new Error(
          "Release storage contains an unsupported filesystem entry. Existing files are preserved.",
        );
      bytes += info.size;
      if (
        file === path.join(root, "immutable") ||
        file.startsWith(path.join(root, "immutable") + path.sep)
      )
        immutableBytes += info.size;
      if (!Number.isSafeInteger(bytes)) throw configuration();
      // Charge hard links at every path and sparse files at their apparent
      // size. Unknown symlinks remain charged without following their targets.
      if (info.isDirectory()) await walk(file, depth + 1);
    }
  };
  await walk(root, 0);
  const disk = await statfs(root, { bigint: true });
  return { bytes, immutableBytes, freeBytes: disk.bavail * disk.bsize };
}
/** Reserve a known copy size against other producers sharing the filesystem.
 * Returns null when shared admission is not configured. */
export async function reserveReleaseStorage(
  root,
  limits,
  bytes,
  environment = process.env,
) {
  const admission = await StorageAdmission.fromEnvironment(
    "release-store",
    environment,
  );
  return admission
    ? admission.reserve(root, {
        minimum: bytes,
        maximum: bytes,
        floor: validate(limits).freeBytes,
      })
    : null;
}
export async function checkReleaseStorage(
  root,
  limits = releaseStorageLimits(),
  reserve = {},
) {
  limits = validate(limits);
  const bytes = reserve.bytes ?? 0,
    immutableBytes = reserve.immutableBytes ?? 0;
  if (
    ![bytes, immutableBytes].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    immutableBytes > bytes
  )
    throw configuration();
  const sample = await measureReleaseStorage(root);
  const admission = await StorageAdmission.fromEnvironment("release-store");
  if (admission)
    sample.freeBytes -= await admission.reserved(root, reserve.reservationId);
  if (sample.bytes + bytes > limits.storeBytes)
    throw new Error(
      "The release store has reached its storage limit. Existing releases are preserved.",
    );
  if (sample.immutableBytes + immutableBytes > limits.immutableBytes)
    throw new Error(
      "The retained release assets have reached their storage limit. Existing assets are preserved.",
    );
  if (sample.freeBytes < BigInt(limits.freeBytes) + BigInt(bytes))
    throw new Error(
      "The release store is short of free disk space. Existing releases are preserved.",
    );
  return sample;
}
const unchanged = (before, after) =>
  before.dev === after.dev &&
  before.ino === after.ino &&
  before.size === after.size &&
  before.mtimeMs === after.mtimeMs &&
  before.ctimeMs === after.ctimeMs;
/** Hash only the observed regular file, with bounded memory and growth refusal. */
export async function hashReleaseFile(source, expected) {
  expected ??= await lstat(source);
  if (
    !expected.isFile() ||
    !Number.isSafeInteger(expected.size) ||
    expected.size < 0 ||
    expected.size > 1024 ** 4 ||
    (await realpath(source)) !== source
  )
    throw new Error("The retained release file is not an ordinary file.");
  const handle = await open(
    source,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    if (!unchanged(expected, await handle.stat()))
      throw new Error("The retained release file changed before hashing.");
    const hash = createHash("sha256"),
      buffer = Buffer.alloc(1024 * 1024);
    let position = 0;
    for (;;) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, expected.size - position + 1),
        position,
      );
      if (!bytesRead) break;
      if (position + bytesRead > expected.size)
        throw new Error("The retained release file grew while hashing.");
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    if (
      position !== expected.size ||
      !unchanged(expected, await handle.stat()) ||
      !unchanged(expected, await lstat(source))
    )
      throw new Error("The retained release file changed while hashing.");
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}
export async function readReleaseFile(source, expected, maximum) {
  if (
    !expected.isFile() ||
    expected.size > maximum ||
    (await realpath(source)) !== source
  )
    throw new Error(
      "Release metadata exceeds its limit or changed before reading.",
    );
  const handle = await open(
    source,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    if (!unchanged(expected, await handle.stat()))
      throw new Error("Release metadata changed before reading.");
    const bytes = Buffer.alloc(expected.size + 1);
    let position = 0;
    while (position < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        position,
        bytes.length - position,
        position,
      );
      if (!bytesRead) break;
      position += bytesRead;
    }
    if (
      position !== expected.size ||
      !unchanged(expected, await handle.stat()) ||
      !unchanged(expected, await lstat(source))
    )
      throw new Error("Release metadata changed while reading.");
    return bytes.subarray(0, position);
  } finally {
    await handle.close();
  }
}
/** A changed/growing build output cannot consume more than its admitted size. */
export async function copyReleaseFile(source, destination, expected) {
  if ((await realpath(source)) !== source)
    throw new Error("Release source changed before copying.");
  const input = await open(
    source,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  let output;
  try {
    const original = await input.stat();
    if (!original.isFile() || !unchanged(expected, original))
      throw new Error("Release source changed before copying.");
    output = await open(destination, "wx", 0o644);
    const buffer = Buffer.alloc(1024 * 1024);
    let position = 0;
    for (;;) {
      const { bytesRead } = await input.read(
        buffer,
        0,
        Math.min(buffer.length, expected.size - position + 1),
        position,
      );
      if (!bytesRead) break;
      if (position + bytesRead > expected.size)
        throw new Error("Release source grew beyond its admitted size.");
      let written = 0;
      while (written < bytesRead) {
        const result = await output.write(
          buffer,
          written,
          bytesRead - written,
          position + written,
        );
        if (!result.bytesWritten)
          throw new Error("The release copy could not be completed.");
        written += result.bytesWritten;
      }
      position += bytesRead;
    }
    if (
      position !== expected.size ||
      !unchanged(original, await input.stat()) ||
      !unchanged(original, await lstat(source))
    )
      throw new Error("Release source changed while copying.");
    await output.sync();
  } finally {
    await output?.close();
    await input.close();
  }
}

export function validateReleaseMounts(root, table) {
  if (
    typeof table !== "string" ||
    !table.trim() ||
    Buffer.byteLength(table) > 2 * 1024 ** 2
  )
    throw new Error("the host mount inventory is incomplete");
  for (const line of table.trim().split("\n")) {
    const fields = line.split(" ");
    if (fields.length < 10 || !/^\d+$/.test(fields[0]) || !fields.includes("-"))
      throw new Error("the host mount inventory is incomplete");
    const mount = fields[4].replace(/\\([0-7]{3})/g, (_, octal) =>
      String.fromCharCode(parseInt(octal, 8)),
    );
    if (!path.posix.isAbsolute(mount) || path.posix.normalize(mount) !== mount)
      throw new Error("the host mount inventory is incomplete");
    if (mount === root || mount.startsWith(root + path.sep))
      throw new Error("the store contains a mount, including a bind mount");
  }
}
export async function verifyReleaseMounts(root) {
  if (process.platform !== "linux")
    throw new Error("release maintenance requires a Linux host");
  const handle = await open("/proc/self/mountinfo", "r"),
    bytes = Buffer.alloc(2 * 1024 ** 2 + 1);
  try {
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
    if (length === bytes.length)
      throw new Error("the host mount inventory exceeds its limit");
    validateReleaseMounts(root, bytes.subarray(0, length).toString());
  } finally {
    await handle.close();
  }
}
