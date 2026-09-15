/** Remove only entries from an already claimed, durably recorded retirement.
 * The coordinator supplies a live store/native-operation guard. No recursive
 * rm and no filename supplied by an HTTP request is used here. */
import { constants } from "node:fs";
import {
  lstat,
  open,
  opendir,
  realpath,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { verifyReleaseMounts } from "./release-storage.mjs";

const fail = () =>
  new Error(
    "Retained release files changed or remain protected. Removal needs reconciliation.",
  );
const stableDirectory = ["dev", "ino", "uid", "gid", "mode"];
async function stat(file) {
  return lstat(file).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
}
function equal(info, expected, partial, type) {
  if (
    !info ||
    !expected ||
    !stableDirectory.every((key) => Number.isFinite(expected[key])) ||
    !(type === "directory" ? info.isDirectory() : info.isFile()) ||
    info.isSymbolicLink()
  )
    return false;
  const keys =
    type === "directory" && partial ? stableDirectory : Object.keys(expected);
  return keys.every((key) => info[key] === expected[key]);
}
async function roots(binding) {
  const root = binding.store.root,
    releases = path.join(root, "releases");
  const base = await lstat(root),
    container = await lstat(releases);
  if (
    (await realpath(root)) !== root ||
    (await realpath(releases)) !== releases ||
    !base.isDirectory() ||
    !container.isDirectory() ||
    base.mode & 0o002 ||
    !["dev", "ino", "uid", "gid"].every(
      (key) => base[key] === binding.store[key],
    ) ||
    !stableDirectory.every((key) => container[key] === binding.releases[key])
  )
    throw fail();
  await verifyReleaseMounts(root);
  return releases;
}
function entriesFor(binding, attempt) {
  if (
    attempt.fingerprint !== binding.fingerprint ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(attempt.artifactId) ||
    !Array.isArray(attempt.entries) ||
    attempt.entries.length < 4 ||
    attempt.entries.length > 20000
  )
    throw fail();
  const entries = new Map();
  for (const item of attempt.entries) {
    if (
      !item ||
      !["file", "directory"].includes(item.type) ||
      typeof item.path !== "string" ||
      item.path.startsWith("/") ||
      item.path.includes("\\") ||
      Buffer.byteLength(item.path) > 2048 ||
      /[\x00-\x1f\x7f]/.test(item.path) ||
      (item.path &&
        item.path.split("/").some((p) => !p || p === "." || p === "..")) ||
      entries.has(item.path) ||
      !item.identity ||
      item.identity.dev !== binding.store.dev ||
      item.identity.uid !== binding.store.uid ||
      item.identity.gid !== binding.store.gid ||
      item.identity.mode & 0o002 ||
      (item.type === "file" && item.identity.nlink !== 1)
    )
      throw fail();
    entries.set(item.path, item);
  }
  if (
    entries.get("")?.type !== "directory" ||
    entries.get("site")?.type !== "directory" ||
    entries.get("release.json")?.type !== "file" ||
    entries.get("redirects.conf")?.type !== "file"
  )
    throw fail();
  for (const item of entries.values()) {
    if (!item.path) continue;
    if (
      !["site", "release.json", "redirects.conf"].includes(item.path) &&
      !item.path.startsWith("site/")
    )
      throw fail();
    const parent = path.posix.dirname(item.path);
    if (entries.get(parent === "." ? "" : parent)?.type !== "directory")
      throw fail();
  }
  return entries;
}
async function sync(directory) {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function inspectRetiringFiles(binding, attempt, partial = false) {
  const container = await roots(binding),
    directory = path.join(container, attempt.artifactId);
  const expected = entriesFor(binding, attempt),
    present = new Set();
  const walk = async (relative, depth = 0) => {
    if (depth > 128) throw fail();
    const target = path.join(directory, relative),
      info = await stat(target),
      item = expected.get(relative);
    if (!info) {
      if (!partial) throw fail();
      return;
    }
    if (
      !item ||
      !equal(info, item.identity, partial, item.type) ||
      (await realpath(target)) !== target
    )
      throw fail();
    present.add(relative);
    if (present.size > 20000) throw fail();
    if (item.type === "directory") {
      for await (const child of await opendir(target))
        await walk(
          relative ? `${relative}/${child.name}` : child.name,
          depth + 1,
        );
    }
  };
  await walk("");
  if (!partial && present.size !== expected.size) throw fail();
  await roots(binding);
  return {
    absent: !present.has(""),
    complete: present.size === expected.size,
    present,
  };
}

export async function removeRetiringFiles(
  binding,
  attempt,
  guard,
  adapters = {},
) {
  if (typeof guard !== "function") throw fail();
  await guard();
  await inspectRetiringFiles(binding, attempt, true);
  const container = path.join(binding.store.root, "releases"),
    directory = path.join(container, attempt.artifactId);
  const entries = entriesFor(binding, attempt);
  // Children precede their parent. Each surviving path is checked again, with
  // a canonical unchanged ancestor chain, immediately before unlink/rmdir.
  const ordered = [...entries.values()].sort(
    (a, b) =>
      b.path.split("/").length - a.path.split("/").length ||
      b.path.localeCompare(a.path),
  );
  ordered.sort((a, b) => (a.path === "" ? 1 : b.path === "" ? -1 : 0));
  for (const item of ordered) {
    await guard();
    await roots(binding);
    const parts = item.path ? item.path.split("/") : [];
    let missingParent = false;
    for (let n = 0; n < parts.length; n++) {
      const relative = parts.slice(0, n).join("/"),
        target = path.join(directory, relative),
        parent = await stat(target);
      if (!parent) {
        missingParent = true;
        break;
      }
      if (
        !equal(
          parent,
          entries.get(relative)?.identity || {},
          true,
          "directory",
        ) ||
        (await realpath(target)) !== target
      )
        throw fail();
    }
    if (missingParent) continue;
    const target = path.join(directory, item.path),
      info = await stat(target);
    if (!info) continue;
    if (
      !equal(info, item.identity, true, item.type) ||
      (await realpath(target)) !== target
    )
      throw fail();
    if (item.type === "file") await unlink(target);
    else await rmdir(target);
    await sync(path.dirname(target));
    await adapters.afterRemove?.(item.path);
  }
  await guard();
  const result = await inspectRetiringFiles(binding, attempt, true);
  if (!result.absent) throw fail();
  await sync(container);
  return { artifactAbsent: true };
}
