import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const generated = new Set([
  "node_modules",
  ".git",
  ".kaizen-builder",
  ".sanity",
  ".astro",
  ".vite",
  "dist",
  "coverage",
  "test-results",
]);
const excluded = (name) =>
  name.split("/").some((part) => generated.has(part)) ||
  /^\.kaizen\/(?:build-recovery|recovery)(?:\/|$)/.test(name);

/** Measure source bytes actually read, including untracked files. Generated
 * dependencies/output/recovery have independent operational retention limits.
 * @param {string} root
 * @param {ReadonlyMap<string, Uint8Array | null>} replacements
 * @param {{onBytes?: (file: string, bytes: Uint8Array, final: boolean) => void}} observers
 */
export async function measureRepositorySource(
  root,
  replacements = new Map(),
  observers = {},
) {
  if ((await realpath(root)) !== path.resolve(root))
    throw new Error("Website usage needs a real source directory.");
  const hash = createHash("sha256");
  const sizes = new Map();
  let bytes = 0,
    entries = 0;
  async function walk(folder) {
    for (const entry of (
      await readdir(path.join(root, folder), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = folder ? `${folder}/${entry.name}` : entry.name;
      if (excluded(name)) continue;
      if (++entries > 10000)
        throw new Error("Build review supports up to 10,000 source files.");
      if (entry.isSymbolicLink())
        throw new Error(`Build review does not follow source links: ${name}`);
      if (entry.isDirectory()) {
        if ((await lstat(path.join(root, name))).isSymbolicLink())
          throw new Error("Website source changed during its storage check.");
        await walk(name);
      } else {
        if (!entry.isFile())
          throw new Error("Website usage requires regular source files.");
        const file = await open(
          path.join(root, name),
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const before = await file.stat();
          if (!before.isFile() || before.size + bytes > 200 * 1024 * 1024)
            throw new Error(
              "Build review supports up to 200 MB of regular source files.",
            );
          const contents = createHash("sha256");
          const buffer = Buffer.alloc(64 * 1024);
          let read = 0;
          while (true) {
            const { bytesRead } = await file.read(
              buffer,
              0,
              Math.min(buffer.length, before.size - read + 1),
              null,
            );
            if (!bytesRead) break;
            read += bytesRead;
            if (read > before.size)
              throw new Error(
                "Website source changed during its storage check.",
              );
            contents.update(buffer.subarray(0, bytesRead));
            observers.onBytes?.(name, buffer.subarray(0, bytesRead), false);
          }
          const after = await file.stat();
          if (
            before.size !== after.size ||
            before.mtimeMs !== after.mtimeMs ||
            read !== before.size
          )
            throw new Error("Website source changed during its storage check.");
          bytes += read;
          observers.onBytes?.(name, new Uint8Array(), true);
          sizes.set(name, read);
          hash.update(name).update("\0").update(contents.digest("hex"));
        } finally {
          await file.close();
        }
      }
    }
  }
  await walk("");
  let projectedBytes = bytes;
  for (const [name, replacement] of replacements) {
    if (
      !name ||
      name.includes("\\") ||
      name.split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Invalid website usage path.");
    if (excluded(name)) continue;
    projectedBytes += (replacement?.byteLength || 0) - (sizes.get(name) || 0);
  }
  return { bytes, projectedBytes, revision: hash.digest("hex") };
}

/** Counts rendered HTML, including generated routes, from the same frozen bytes
 * the preview serves. It does not infer pages from source route filenames.
 * @param {ReadonlyMap<string, Uint8Array>} files
 */
export function measureRepositoryOutput(files) {
  let pages = 0,
    bytes = 0;
  for (const [name, contents] of files) {
    if (/\.html$/i.test(name)) pages++;
    bytes += contents.byteLength;
  }
  return { pages, bytes };
}
