/** Private native reference inventory. A snapshot is not deletion authority. */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import { gunzipSync, brotliDecompressSync } from "node:zlib";
import { unzipSync } from "fflate";
import path from "node:path";
import { accountId } from "./builder-hosted-auth";
import { HostedWebsiteFolders, unlinkedPath } from "./builder-hosted-folders";
import { measureRepositorySource } from "./builder-repository-usage.mjs";

export type NativeAssetIdentity = { assetId: string; url: string | null };
/** Host-only proof for a quiescent Git index lock held by its current producer. */
export type OwnedGitIndexLock = { dev: number; ino: number; contents: string };
type Source = "source" | "history" | "recovery" | "releases";
export type NativeAssetReferences = {
  references: { assetId: string; sources: Source[] }[];
  fingerprint: string;
  files: number;
  bytes: number;
  historyObjects: number;
};
type Limits = {
  files: number;
  bytes: number;
  historyBytes: number;
  historyObjects: number;
};
const defaults: Limits = {
  files: 100000,
  bytes: 2 * 1024 ** 3,
  historyBytes: 2 * 1024 ** 3,
  historyObjects: 200000,
};
const unavailable = () =>
  new Error(
    "Website file references could not be fully verified. Existing files are kept.",
  );
const archive = (name: string) => /\.(zip|gz|br)$/i.test(name);
const archiveInputLimit = 35 * 1024 ** 2;

/** Retained backups and precompressed public files can contain live URLs too.
 * Decode in memory only, with bounded input, expansion, entries and nesting. */
function expandReferences(
  name: string,
  bytes: Uint8Array,
  source: Source,
  matcher: NativeAssetMatcher,
  allowance: number,
  depth = 0,
): number {
  if (!archive(name)) return 0;
  if (depth >= 3 || bytes.byteLength > archiveInputLimit || allowance < 1)
    throw unavailable();
  const limit = Math.min(allowance, 200 * 1024 ** 2);
  let expanded: Record<string, Uint8Array>;
  if (/\.zip$/i.test(name)) {
    let total = 0;
    const seen = new Set<string>();
    expanded = unzipSync(bytes, {
      filter(entry) {
        if (
          seen.has(entry.name) ||
          seen.size >= 10000 ||
          !Number.isSafeInteger(entry.originalSize) ||
          entry.originalSize < 0 ||
          (total += entry.originalSize) > limit
        )
          throw unavailable();
        seen.add(entry.name);
        return true;
      },
    });
  } else {
    const decoded = /\.gz$/i.test(name)
      ? gunzipSync(bytes, { maxOutputLength: limit })
      : brotliDecompressSync(bytes, { maxOutputLength: limit });
    expanded = { [name.replace(/\.(gz|br)$/i, "")]: decoded };
  }
  let amount = 0;
  for (const [file, contents] of Object.entries(expanded)) {
    amount += contents.byteLength;
    if (amount > allowance) throw unavailable();
    matcher.stream(source)(contents, true);
    amount += expandReferences(
      file,
      contents,
      source,
      matcher,
      allowance - amount,
      depth + 1,
    );
    if (amount > allowance) throw unavailable();
  }
  return amount;
}
const html = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** One streaming matcher per file/object; never join the end of one file to another. */
export class NativeAssetMatcher {
  private needles: { id: string; values: string[] }[];
  private hits = new Map<string, Set<Source>>();
  private carryLength: number;
  constructor(assets: readonly NativeAssetIdentity[]) {
    if (
      !Array.isArray(assets) ||
      !assets.length ||
      assets.length > 100 ||
      new Set(assets.map((item) => item?.assetId)).size !== assets.length
    )
      throw unavailable();
    this.needles = assets.map((item) => {
      if (
        !accountId(item?.assetId) ||
        (item.url !== null &&
          (typeof item.url !== "string" ||
            !item.url ||
            Buffer.byteLength(item.url) > 8192 ||
            /[\x00-\x1f\x7f]/.test(item.url)))
      )
        throw unavailable();
      let encoded: string;
      try {
        encoded = item.url?.split("/").map(encodeURIComponent).join("/") || "";
      } catch {
        throw unavailable();
      }
      return {
        id: item.assetId,
        values: [
          ...new Set(
            [
              item.assetId,
              item.url || "",
              encoded,
              item.url ? JSON.stringify(item.url).slice(1, -1) : "",
              item.url ? html(item.url) : "",
            ]
              .filter(Boolean)
              .map((value) => value.toLowerCase()),
          ),
        ],
      };
    });
    this.carryLength =
      Math.max(
        ...this.needles.flatMap((item) =>
          item.values.map((value) => value.length),
        ),
      ) - 1;
  }
  stream(source: Source) {
    const decoder = new StringDecoder("utf8");
    let carry = "",
      closed = false;
    return (chunk: Uint8Array, final = false) => {
      if (closed) throw unavailable();
      const text =
        carry +
        (
          decoder.write(Buffer.from(chunk)) + (final ? decoder.end() : "")
        ).toLowerCase();
      for (const item of this.needles)
        if (item.values.some((value) => text.includes(value))) {
          let hit = this.hits.get(item.id);
          if (!hit) this.hits.set(item.id, (hit = new Set()));
          hit.add(source);
        }
      carry = text.slice(-this.carryLength);
      closed = final;
    };
  }
  references() {
    return [...this.hits]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([assetId, sources]) => ({ assetId, sources: [...sources].sort() }));
  }
}

/** The producer checks the actual replacement bytes, including compressed
 * references, before a draft/source/output write becomes durable. */
export function nativeAssetContentReferences(
  assets: readonly NativeAssetIdentity[],
  bytes: Uint8Array,
  name: string,
) {
  const matcher = new NativeAssetMatcher(assets);
  matcher.stream("source")(bytes, true);
  expandReferences(name, bytes, "source", matcher, 200 * 1024 ** 2);
  return matcher.references();
}

function options(input?: Partial<Limits>): Limits {
  const limits = { ...defaults, ...input };
  if (
    Object.keys(limits).some((key) => !(key in defaults)) ||
    Object.entries(limits).some(
      ([key, value]) =>
        !Number.isSafeInteger(value) || value < 1 || value > defaults[key],
    )
  )
    throw unavailable();
  return limits;
}
async function directory(root: string) {
  if (!path.isAbsolute(root) || path.resolve(root) !== root)
    throw unavailable();
  await unlinkedPath(root);
  const stat = await lstat(root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await realpath(root)) !== root
  )
    throw unavailable();
}
const stamp = (stat: Awaited<ReturnType<typeof lstat>>) =>
  [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs].join(
    ":",
  );

/** Metadata inventory also rejects Git alternates, linked roots and concurrent changes. */
async function inventory(
  root: string,
  limit: number,
  signal?: AbortSignal,
  git = false,
  ownedIndex?: OwnedGitIndexLock,
) {
  await directory(root);
  const files: { name: string; stamp: string; size: number }[] = [];
  const fingerprint = createHash("sha256");
  let count = 0;
  async function walk(relative: string) {
    signal?.throwIfAborted();
    const full = path.join(root, relative),
      before = await lstat(full);
    if (
      !before.isDirectory() ||
      before.isSymbolicLink() ||
      (await realpath(full)) !== full
    )
      throw unavailable();
    fingerprint.update(relative).update("\0").update(stamp(before));
    for (const entry of (await readdir(full, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (++count > limit) throw unavailable();
      const name = relative ? `${relative}/${entry.name}` : entry.name,
        file = path.join(root, name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw unavailable();
      let owned = false;
      if (git && name === "index.lock" && ownedIndex) {
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.dev !== ownedIndex.dev ||
          stat.ino !== ownedIndex.ino ||
          stat.size > 1024 ||
          stat.mode & 0o077 ||
          !/^Kaizen checkout [a-f0-9-]{36}\n$/.test(ownedIndex.contents)
        )
          throw unavailable();
        const handle = await open(
          file,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          if (
            stamp(await handle.stat()) !== stamp(stat) ||
            (await handle.readFile("utf8")) !== ownedIndex.contents ||
            stamp(await handle.stat()) !== stamp(stat)
          )
            throw unavailable();
          owned = true;
        } finally {
          await handle.close();
        }
      }
      if (
        git &&
        ((name.endsWith(".lock") && !owned) ||
          [
            "objects/info/alternates",
            "objects/info/http-alternates",
            "commondir",
          ].includes(name))
      )
        throw unavailable();
      if (stat.isDirectory()) await walk(name);
      else {
        if (!Number.isSafeInteger(stat.size) || stat.size < 0)
          throw unavailable();
        files.push({ name, stamp: stamp(stat), size: stat.size });
        fingerprint.update(name).update("\0").update(stamp(stat));
      }
    }
    if (stamp(before) !== stamp(await lstat(full))) throw unavailable();
  }
  await walk("");
  return { files, fingerprint: fingerprint.digest("hex") };
}

async function history(
  root: string,
  matcher: NativeAssetMatcher,
  limits: Limits,
  signal?: AbortSignal,
  archives?: ReadonlyMap<string, Set<string>>,
  ownedIndex?: OwnedGitIndexLock,
) {
  const gitRoot = path.join(root, ".git"),
    before = await inventory(
      gitRoot,
      limits.historyObjects * 3,
      signal,
      true,
      ownedIndex,
    );
  signal?.throwIfAborted();
  const process = spawn(
    "git",
    [
      "--no-replace-objects",
      "-c",
      `safe.directory=${root}`,
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "gc.auto=0",
      "-c",
      "maintenance.auto=false",
      "-c",
      "credential.helper=",
      "-c",
      "protocol.allow=never",
      "-C",
      root,
      "cat-file",
      ...(archives ? [] : ["--batch-all-objects"]),
      "--batch",
    ],
    {
      stdio: ["pipe", "pipe", "ignore"],
      env: {
        PATH: globalThis.process.env.PATH,
        LANG: "C",
        LC_ALL: "C",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_LAZY_FETCH: "1",
      },
    },
  );
  const completed = new Promise<boolean>((resolve) => {
    process.once("error", () => resolve(false));
    process.once("close", (code) => resolve(code === 0));
  });
  process.stdin.on("error", () => {});
  process.stdin.end(
    archives ? [...archives.keys()].sort().join("\n") + "\n" : undefined,
  );
  const cancel = () => process.kill("SIGKILL");
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 60000);
  timer.unref();
  let pending = Buffer.alloc(0),
    remaining: number | null = null,
    newline = false,
    objects = 0,
    bytes = 0,
    expanded = 0;
  let consume: ReturnType<NativeAssetMatcher["stream"]>,
    objectHash: ReturnType<typeof createHash>,
    expectedHash = "",
    objectType = "",
    prefix = Buffer.alloc(0),
    captured: Buffer[] | undefined;
  const names = new Map<string, Set<string>>(),
    seen = new Set<string>();
  function remember(id: string, name: string) {
    let saved = names.get(id);
    if (!saved) names.set(id, (saved = new Set()));
    saved.add(name);
  }
  const fingerprint = createHash("sha256");
  try {
    for await (const value of process.stdout) {
      signal?.throwIfAborted();
      pending = Buffer.concat([pending, value]);
      while (pending.length) {
        if (newline) {
          if (pending[0] !== 10) throw unavailable();
          pending = pending.subarray(1);
          newline = false;
        } else if (remaining === null) {
          const end = pending.indexOf(10);
          if (end === -1) {
            if (pending.length > 128) throw unavailable();
            break;
          }
          const header = pending.subarray(0, end).toString("ascii");
          const match =
            /^([a-f0-9]{40}|[a-f0-9]{64}) (blob|tree|commit|tag) (0|[1-9][0-9]*)$/.exec(
              header,
            );
          if (!match || ++objects > limits.historyObjects) throw unavailable();
          remaining = Number(match[3]);
          if (
            !Number.isSafeInteger(remaining) ||
            bytes + remaining > limits.historyBytes
          )
            throw unavailable();
          bytes += remaining;
          expectedHash = match[1];
          if (
            seen.has(expectedHash) ||
            (archives && !archives.has(expectedHash))
          )
            throw unavailable();
          seen.add(expectedHash);
          objectType = match[2];
          prefix = Buffer.alloc(0);
          captured = objectType === "tree" || archives ? [] : undefined;
          if (captured && remaining > archiveInputLimit) throw unavailable();
          objectHash = createHash(
            expectedHash.length === 40 ? "sha1" : "sha256",
          ).update(`${match[2]} ${remaining}\0`);
          consume = matcher.stream("history");
          fingerprint.update(header).update("\0");
          pending = pending.subarray(end + 1);
        } else {
          const count = Math.min(remaining, pending.length),
            part = pending.subarray(0, count);
          objectHash.update(part);
          consume(part);
          if (prefix.length < 4)
            prefix = Buffer.concat([
              prefix,
              part.subarray(0, 4 - prefix.length),
            ]);
          captured?.push(Buffer.from(part));
          pending = pending.subarray(count);
          remaining -= count;
          if (!remaining) {
            consume(new Uint8Array(), true);
            if (objectHash.digest("hex") !== expectedHash) throw unavailable();
            if (archives) {
              if (objectType !== "blob") throw unavailable();
              const contents = Buffer.concat(captured!);
              for (const name of archives.get(expectedHash)!)
                expanded += expandReferences(
                  name,
                  contents,
                  "history",
                  matcher,
                  limits.historyBytes - expanded,
                );
            } else if (objectType === "tree") {
              const contents = Buffer.concat(captured!);
              let offset = 0;
              while (offset < contents.length) {
                const space = contents.indexOf(32, offset),
                  zero = contents.indexOf(0, space + 1),
                  hashBytes = expectedHash.length / 2;
                if (
                  space < offset ||
                  zero < space ||
                  zero + 1 + hashBytes > contents.length
                )
                  throw unavailable();
                const mode = contents.subarray(offset, space).toString("ascii"),
                  name = contents.subarray(space + 1, zero).toString("utf8");
                if (mode === "160000") throw unavailable(); // A nested repository needs its own complete history inventory.
                if (["100644", "100755"].includes(mode) && archive(name))
                  remember(
                    contents
                      .subarray(zero + 1, zero + 1 + hashBytes)
                      .toString("hex"),
                    name,
                  );
                offset = zero + 1 + hashBytes;
              }
            } else if (objectType === "blob") {
              // Unreachable archives have no remaining tree filename. ZIP and
              // gzip still identify themselves; named Brotli blobs come from trees.
              if (
                prefix[0] === 0x50 &&
                prefix[1] === 0x4b &&
                [3, 5, 7].includes(prefix[2])
              )
                remember(expectedHash, "retained.zip");
              else if (prefix[0] === 0x1f && prefix[1] === 0x8b)
                remember(expectedHash, "retained.gz");
            }
            remaining = null;
            newline = true;
          }
        }
      }
    }
    signal?.throwIfAborted();
    if (!(await completed) || pending.length || remaining !== null || newline)
      throw unavailable();
    if (archives && seen.size !== archives.size) throw unavailable();
    if (!archives && names.size) {
      // Decode selected archive blobs only after every retained tree has been
      // read, so object ordering cannot hide a Brotli filename found later.
      const decoded = await history(
        root,
        matcher,
        limits,
        signal,
        names,
        ownedIndex,
      );
      expanded += decoded.expanded;
    }
    if (bytes + expanded > limits.historyBytes) throw unavailable();
    const after = await inventory(
      gitRoot,
      limits.historyObjects * 3,
      signal,
      true,
      ownedIndex,
    );
    if (after.fingerprint !== before.fingerprint) throw unavailable();
    return {
      objects,
      bytes: bytes + expanded,
      expanded,
      fingerprint: fingerprint.digest("hex"),
      metadata: after.fingerprint,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (process.exitCode === null) cancel();
    await completed;
  }
}

async function tree(
  root: string,
  source: Source,
  matcher: NativeAssetMatcher,
  limits: Limits,
  signal?: AbortSignal,
) {
  const before = await inventory(root, limits.files, signal);
  const hash = createHash("sha256");
  let bytes = 0;
  for (const item of before.files) {
    signal?.throwIfAborted();
    if (bytes + item.size > limits.bytes) throw unavailable();
    const full = path.join(root, item.name);
    if ((await realpath(full)) !== full) throw unavailable();
    const file = await open(
      full,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      if (stamp(await file.stat()) !== item.stamp) throw unavailable();
      const contents = createHash("sha256"),
        consume = matcher.stream(source);
      const archived: Buffer[] | undefined = archive(item.name)
        ? []
        : undefined;
      let read = 0;
      const buffer = Buffer.alloc(65536);
      while (true) {
        signal?.throwIfAborted();
        const part = await file.read(
          buffer,
          0,
          Math.min(buffer.length, item.size - read + 1),
          null,
        );
        if (!part.bytesRead) break;
        read += part.bytesRead;
        if (read > item.size) throw unavailable();
        const chunk = buffer.subarray(0, part.bytesRead);
        contents.update(chunk);
        consume(chunk);
        if (archived) {
          if (read > archiveInputLimit) throw unavailable();
          archived.push(Buffer.from(chunk));
        }
      }
      if (read !== item.size || stamp(await file.stat()) !== item.stamp)
        throw unavailable();
      consume(new Uint8Array(), true);
      bytes += read;
      if (archived)
        bytes += expandReferences(
          item.name,
          Buffer.concat(archived),
          source,
          matcher,
          limits.bytes - bytes,
        );
      hash.update(item.name).update("\0").update(contents.digest("hex"));
    } finally {
      await file.close();
    }
  }
  if (
    (await inventory(root, limits.files, signal)).fingerprint !==
    before.fingerprint
  )
    throw unavailable();
  return {
    files: before.files.length,
    bytes,
    fingerprint: hash.digest("hex"),
    metadata: before.fingerprint,
  };
}

/** Operator-configured roots only. The caller must serialize future writes with
 * cleanup; returning this snapshot alone never enables native file removal. */
/** Candidate output or retained artifact, before staging or activation. Uses
 * the same bounded byte/archive reader and stable filesystem inventory. */
export async function scanNativeAssetTree(input: {
  root: string;
  assets: readonly NativeAssetIdentity[];
  signal?: AbortSignal;
}) {
  try {
    const matcher = new NativeAssetMatcher(input.assets);
    const found = await tree(
      input.root,
      "releases",
      matcher,
      defaults,
      input.signal,
    );
    return { ...found, references: matcher.references() };
  } catch {
    throw unavailable();
  }
}

export async function scanNativeAssetReferences(input: {
  root: string;
  assets: readonly NativeAssetIdentity[];
  recoveryRoots: readonly string[];
  releaseStores: readonly string[];
  limits?: Partial<Limits>;
  signal?: AbortSignal;
  ownedIndex?: OwnedGitIndexLock;
}): Promise<NativeAssetReferences> {
  try {
    const limits = options(input.limits),
      matcher = new NativeAssetMatcher(input.assets);
    if (
      !Array.isArray(input.recoveryRoots) ||
      !Array.isArray(input.releaseStores) ||
      input.recoveryRoots.length > 20 ||
      input.releaseStores.length > 20
    )
      throw unavailable();
    await directory(input.root);
    input.signal?.throwIfAborted();
    const streams = new Map<string, ReturnType<NativeAssetMatcher["stream"]>>();
    let files = 0,
      sourceBytes = 0,
      expandedBytes = 0;
    const sourceArchives = new Map<string, Buffer[]>();
    const source = await measureRepositorySource(input.root, new Map(), {
      onBytes(name, bytes, final) {
        input.signal?.throwIfAborted();
        sourceBytes += bytes.byteLength;
        if (sourceBytes + expandedBytes > limits.bytes) throw unavailable();
        let consume = streams.get(name);
        if (!consume) {
          streams.set(name, (consume = matcher.stream("source")));
          if (++files > limits.files) throw unavailable();
        }
        consume(bytes, final);
        if (archive(name)) {
          let chunks = sourceArchives.get(name);
          if (!chunks) sourceArchives.set(name, (chunks = []));
          if (
            chunks.reduce((sum, item) => sum + item.length, 0) +
              bytes.byteLength >
            archiveInputLimit
          )
            throw unavailable();
          chunks.push(Buffer.from(bytes));
          if (final) {
            expandedBytes += expandReferences(
              name,
              Buffer.concat(chunks),
              "source",
              matcher,
              limits.bytes - sourceBytes - expandedBytes,
            );
            sourceArchives.delete(name);
          }
        }
        if (final) streams.delete(name);
      },
    });
    if (source.bytes > limits.bytes) throw unavailable();
    const git = await history(
      input.root,
      matcher,
      limits,
      input.signal,
      undefined,
      input.ownedIndex,
    );
    const hash = createHash("sha256")
      .update(source.revision)
      .update(git.fingerprint);
    let bytes = source.bytes + expandedBytes + git.bytes;
    const inventories: { root: string; metadata: string }[] = [];
    for (const [kind, roots] of [
      ["recovery", input.recoveryRoots],
      ["releases", input.releaseStores],
    ] as const) {
      for (const root of [...new Set(roots)].sort()) {
        const found = await tree(
          root,
          kind,
          matcher,
          { ...limits, bytes: limits.bytes - bytes + git.bytes },
          input.signal,
        );
        files += found.files;
        bytes += found.bytes;
        if (files > limits.files || bytes - git.bytes > limits.bytes)
          throw unavailable();
        hash.update(kind).update(root).update(found.fingerprint);
        inventories.push({ root, metadata: found.metadata });
      }
    }
    // The hosted folder lock normally prevents this; recheck external changes too.
    if (
      (
        await measureRepositorySource(input.root, new Map(), {
          onBytes() {
            input.signal?.throwIfAborted();
          },
        })
      ).revision !== source.revision
    )
      throw unavailable();
    if (
      (
        await inventory(
          path.join(input.root, ".git"),
          limits.historyObjects * 3,
          input.signal,
          true,
          input.ownedIndex,
        )
      ).fingerprint !== git.metadata
    )
      throw unavailable();
    for (const previous of inventories)
      if (
        (await inventory(previous.root, limits.files, input.signal))
          .fingerprint !== previous.metadata
      )
        throw unavailable();
    return {
      references: matcher.references(),
      fingerprint: hash.digest("hex"),
      files,
      bytes,
      historyObjects: git.objects,
    };
  } catch {
    throw unavailable();
  }
}

/** The helper's ordinary folder/build locks also fence this read-only inventory. */
export async function scanHostedNativeAssetReferences(
  folders: HostedWebsiteFolders,
  projectId: string,
  assets: readonly NativeAssetIdentity[],
  releaseStores: readonly string[],
  signal?: AbortSignal,
) {
  folders.admission(projectId);
  return folders.locked(projectId, async () => {
    await folders.assertNotBuilding(projectId);
    const root = await folders.check(projectId),
      recoveryRoots: string[] = [];
    for (const candidate of [
      path.join(folders.projectDirectory(projectId), "drafts"),
      path.join(root, ".kaizen", "recovery"),
      path.join(root, ".kaizen", "build-recovery"),
      path.join(root, ".kaizen-builder"),
      path.join(root, "dist"),
    ]) {
      const exists = await lstat(candidate).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      if (exists) recoveryRoots.push(candidate);
    }
    return scanNativeAssetReferences({
      root,
      assets,
      recoveryRoots,
      releaseStores,
      signal,
    });
  });
}
