/** Bounded removal of generated release state. Callers hold the lock that
 * every writer of that state uses and have proven it abandoned. Links, mounts,
 * foreign owners and changed identities are refused; unknown entries are left
 * in place and stay charged. No recursive rm is used. */
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

export const generatedLimits = Object.freeze({
  scanEntries: 1000000,
  removeEntries: 20000,
  depth: 64,
});
const keys = [
  "dev",
  "ino",
  "uid",
  "gid",
  "mode",
  "nlink",
  "size",
  "mtimeMs",
  "ctimeMs",
];
const directoryKeys = ["dev", "ino", "uid", "gid", "mode"];
export const generatedFailure = (reason) =>
  Object.assign(
    new Error(
      `Generated state could not be reclaimed safely: ${reason}. Existing files are preserved.`,
    ),
    { generatedRefusal: true },
  );
const snapshot = (info) =>
  Object.fromEntries(keys.map((key) => [key, info[key]]));
async function stat(file) {
  return lstat(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
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

/** Newest change time of an entry; generated state ages from this. */
export const generatedAge = (identity, now) =>
  now - Math.max(identity.mtimeMs, identity.ctimeMs);

/** Inventory an ordinary tree below `base`, owned exactly like `base`. */
export async function inventoryGeneratedTree(
  base,
  relative,
  budget = { entries: generatedLimits.scanEntries },
) {
  const root = await lstat(base);
  if (
    (await realpath(base)) !== base ||
    !root.isDirectory() ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw generatedFailure("the owning directory or path is invalid");
  const entries = [];
  const walk = async (item, depth) => {
    if (depth > generatedLimits.depth || --budget.entries < 0)
      throw generatedFailure("the inventory limit was reached");
    const file = path.join(base, item),
      info = await lstat(file);
    if (
      info.isSymbolicLink() ||
      info.dev !== root.dev ||
      info.uid !== root.uid ||
      info.gid !== root.gid ||
      info.mode & 0o002 ||
      !(info.isDirectory() || info.isFile()) ||
      (info.isFile() && info.nlink !== 1) ||
      (await realpath(file)) !== file
    )
      throw generatedFailure(
        "a generated path is linked, mounted, foreign or not ordinary",
      );
    entries.push({
      path: item,
      type: info.isDirectory() ? "directory" : "file",
      identity: snapshot(info),
    });
    if (info.isDirectory())
      for await (const child of await opendir(file))
        await walk(`${item}/${child.name}`, depth + 1);
  };
  await walk(relative, 0);
  return entries;
}

/** Remove inventoried entries, deepest first, rechecking each identity. A
 * missing entry is an earlier interrupted removal; a new child refuses. */
export async function removeGeneratedEntries(
  base,
  entries,
  guard = async () => {},
  adapters = {},
) {
  await verifyReleaseMounts(base);
  const ordered = [...entries].sort(
    (a, b) =>
      b.path.split("/").length - a.path.split("/").length ||
      b.path.localeCompare(a.path),
  );
  let removed = 0,
    bytes = 0;
  for (const item of ordered) {
    await guard();
    const file = path.join(base, item.path),
      info = await stat(file);
    if (!info) continue;
    const current = snapshot(info);
    if (
      info.isSymbolicLink() ||
      !(item.type === "directory" ? info.isDirectory() : info.isFile()) ||
      !(item.type === "directory" ? directoryKeys : keys).every(
        (key) => current[key] === item.identity[key],
      ) ||
      (await realpath(file)) !== file
    )
      throw generatedFailure("a generated path changed before removal");
    if (item.type === "file") await unlink(file);
    else
      await rmdir(file).catch((error) => {
        if (error.code === "ENOTEMPTY")
          throw generatedFailure("a generated directory gained new entries");
        throw error;
      });
    await sync(path.dirname(file));
    removed++;
    bytes += item.identity.size;
    await adapters.afterRemove?.(item.path);
  }
  return { removed, bytes };
}
