/** Explicit recovery of a local process lock. Never infer ownership from age. */
import {
  mkdir,
  lstat,
  readFile,
  writeFile,
  unlink,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

export async function inspectProcessLock(directory) {
  let stat;
  try {
    stat = await lstat(directory);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("Recovery requires an ordinary lock directory.");
  const file = path.join(directory, "owner.json"),
    metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 16384)
    throw new Error(
      "Preserve the invalid lock metadata for operator inspection.",
    );
  const text = await readFile(file, "utf8"),
    owner = JSON.parse(text);
  if (
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0 ||
    typeof owner.host !== "string"
  )
    throw new Error(
      "Lock process identity is missing. Operator inspection is required.",
    );
  let stopped = false;
  if (owner.host === os.hostname()) {
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") stopped = true;
    }
  }
  return { owner, text, stopped };
}

export async function withRecoveryLock(
  directory,
  operation,
  expectedJobId,
  depth = 0,
) {
  // Keep the original lock in place throughout reconciliation. A separate
  // exclusive guard prevents two recoverers from using the same stopped owner.
  const guard = `${directory}.recovery`,
    token = randomUUID();
  try {
    await mkdir(guard);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const previous = await inspectProcessLock(guard);
    if (!previous?.stopped)
      throw new Error(
        "Another recovery owns the recovery guard. Its process must be proven stopped on this host before retrying.",
      );
    if (depth >= 8)
      throw new Error(
        "Repeated interrupted recovery guards require operator inspection. All lock files were preserved.",
      );
    // Keep the stopped guard intact. Protect it with its own exclusive guard,
    // then recheck ownership under that guard before touching the original lock.
    // Concurrent retries meet a live guard owner and cannot steal this attempt.
    return withRecoveryLock(
      guard,
      () => withHeldProcessLock(directory, operation, expectedJobId),
      undefined,
      depth + 1,
    );
  }
  const ownerFile = path.join(guard, "owner.json");
  const ownerText = JSON.stringify({
    pid: process.pid,
    host: os.hostname(),
    token,
  });
  let recorded = false;
  try {
    await writeFile(ownerFile, ownerText, { flag: "wx" });
    recorded = true;
    return await withHeldProcessLock(directory, operation, expectedJobId);
  } finally {
    if (recorded) {
      if ((await readFile(ownerFile, "utf8")) !== ownerText)
        throw new Error(
          "Recovery guard ownership changed. Its files were preserved for operator inspection.",
        );
      await unlink(ownerFile);
      await rmdir(guard);
    }
  }
}

async function withHeldProcessLock(directory, operation, expectedJobId) {
  const token = randomUUID();
  let created = false,
    complete = false,
    held;
  try {
    held = await inspectProcessLock(directory);
    if (held) {
      if (!held.stopped)
        throw new Error(
          "The recorded publication process is still running or cannot be proven stopped on this host.",
        );
      if (expectedJobId && held.owner.jobId !== expectedJobId)
        throw new Error(
          "The destination lock belongs to a different publication job.",
        );
    } else {
      await mkdir(directory);
      created = true;
      await writeFile(
        path.join(directory, "owner.json"),
        JSON.stringify({
          pid: process.pid,
          host: os.hostname(),
          token,
          ...(expectedJobId ? { jobId: expectedJobId } : {}),
        }),
        { flag: "wx" },
      );
      held = await inspectProcessLock(directory);
    }
    const result = await operation(held.owner);
    complete = true;
    return result;
  } finally {
    if (held && (created || complete)) {
      if (
        (await readFile(path.join(directory, "owner.json"), "utf8")) !==
        held.text
      )
        throw new Error(
          "Lock ownership changed during recovery. Its files were preserved.",
        );
      await unlink(path.join(directory, "owner.json"));
      await rmdir(directory);
    }
  }
}
