/** Private retirement records. Call mutations only while holding the release
 * store lock and the applicable native operation. These records alone never
 * authorize deletion; the coordinator must obtain and recheck the SQL claim. */
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  link,
  lstat,
  mkdir,
  open,
  opendir,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { readReleaseFile, verifyReleaseMounts } from "./release-storage.mjs";

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const maximumAttempt = 8 * 1024 ** 2;
const maximumTombstones = 10000;
const record = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) =>
  record(value) &&
  Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = () =>
  new Error(
    "Release retirement ownership or recovery state could not be verified. Existing files are preserved.",
  );
async function stat(file) {
  return lstat(file).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
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
async function names(directory, maximum) {
  const found = [];
  for await (const entry of await opendir(directory)) {
    if (found.length >= maximum) throw fail();
    found.push(entry.name);
  }
  return found.sort();
}
function identity(info) {
  return {
    dev: info.dev,
    ino: info.ino,
    uid: info.uid,
    gid: info.gid,
    mode: info.mode,
    nlink: info.nlink,
    size: info.size,
    mtimeMs: info.mtimeMs,
    ctimeMs: info.ctimeMs,
  };
}
function same(a, b) {
  return (
    exactKeys(a, Object.keys(b)) &&
    Object.keys(b).every((key) => a[key] === b[key])
  );
}
function validateBinding(value, root, base) {
  if (
    !exactKeys(value, [
      "version",
      "projectId",
      "scope",
      "workerId",
      "origin",
      "store",
      "releases",
      "fingerprint",
    ]) ||
    value.version !== 1 ||
    !(value.projectId === "kaizen" || uuid.test(value.projectId)) ||
    !(
      value.scope === "repository:production" ||
      value.scope === "repository:staging" ||
      (value.scope?.startsWith("client:") && uuid.test(value.scope.slice(7)))
    ) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.workerId || "") ||
    typeof value.origin !== "string" ||
    value.origin.length > 2048 ||
    !same(value.store, {
      root,
      dev: base.dev,
      ino: base.ino,
      uid: base.uid,
      gid: base.gid,
    })
  )
    throw fail();
  if (
    !exactKeys(value.releases, ["dev", "ino", "uid", "gid", "mode"]) ||
    !Object.values(value.releases).every(Number.isSafeInteger) ||
    value.releases.dev !== base.dev ||
    value.releases.uid !== base.uid ||
    value.releases.gid !== base.gid ||
    value.releases.mode & 0o002 ||
    (value.releases.mode & constants.S_IFMT) !== constants.S_IFDIR
  )
    throw fail();
  let origin;
  try {
    origin = new URL(value.origin);
  } catch {
    throw fail();
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== value.origin
  )
    throw fail();
  const fingerprint = digest(
    JSON.stringify({
      schemaVersion: 1,
      projectId: value.projectId,
      scope: value.scope,
      workerId: value.workerId,
      ...value.store,
    }),
  );
  if (value.fingerprint !== fingerprint) throw fail();
  return value;
}
function validateOwner(value) {
  if (!exactKeys(value, ["operation", "controller"])) throw fail();
  const op = value.operation,
    controller = value.controller;
  if (
    !exactKeys(op, [
      "id",
      "workerId",
      "configuration",
      "projectId",
      "processId",
      "host",
      "instanceId",
    ]) ||
    !uuid.test(op.id) ||
    !uuid.test(op.instanceId) ||
    !hash.test(op.configuration) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(op.workerId || "") ||
    !(op.projectId === "kaizen" || uuid.test(op.projectId)) ||
    !Number.isSafeInteger(op.processId) ||
    op.processId < 1 ||
    op.processId > 2147483647 ||
    !/^[a-zA-Z0-9_.-]{1,253}$/.test(op.host || "") ||
    !exactKeys(controller, ["kind", "unit", "invocationId"]) ||
    controller.kind !== "systemd" ||
    !/^[a-zA-Z0-9_-]{1,180}\.service$/.test(controller.unit || "") ||
    !/^[a-f0-9]{32}$/.test(controller.invocationId || "")
  )
    throw fail();
}
function validateEntry(value) {
  if (
    !exactKeys(value, ["path", "type", "identity"]) ||
    !["directory", "file"].includes(value.type) ||
    typeof value.path !== "string" ||
    Buffer.byteLength(value.path) > 2048 ||
    value.path.startsWith("/") ||
    value.path.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(value.path) ||
    (value.path !== "" &&
      value.path
        .split("/")
        .some((part) => !part || part === "." || part === "..")) ||
    !exactKeys(value.identity, [
      "dev",
      "ino",
      "uid",
      "gid",
      "mode",
      "nlink",
      "size",
      "mtimeMs",
      "ctimeMs",
    ])
  )
    throw fail();
  const info = value.identity;
  if (
    !Object.values(info).every(
      (number) => Number.isFinite(number) && number >= 0,
    ) ||
    !["dev", "ino", "uid", "gid", "mode", "nlink", "size"].every((key) =>
      Number.isSafeInteger(info[key]),
    ) ||
    info.size > 1024 ** 4 ||
    info.mode & 0o002 ||
    (value.type === "file"
      ? (info.mode & constants.S_IFMT) !== constants.S_IFREG || info.nlink !== 1
      : (info.mode & constants.S_IFMT) !== constants.S_IFDIR)
  )
    throw fail();
}
function validateAttempt(value, binding) {
  if (
    !exactKeys(value, [
      "version",
      "token",
      "generation",
      "artifactId",
      "manifestSha256",
      "bytes",
      "fingerprint",
      "owner",
      "entries",
    ]) ||
    value.version !== 1 ||
    !uuid.test(value.token) ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 0 ||
    value.generation > 2147483647 ||
    !idPattern.test(value.artifactId) ||
    !hash.test(value.manifestSha256) ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    value.bytes > 1024 ** 4 ||
    value.fingerprint !== binding.fingerprint ||
    !Array.isArray(value.entries) ||
    value.entries.length < 4 ||
    value.entries.length > 20000
  )
    throw fail();
  validateOwner(value.owner);
  if (value.owner.operation.projectId !== binding.projectId) throw fail();
  const entries = new Map();
  let bytes = 0;
  for (const entry of value.entries) {
    validateEntry(entry);
    if (
      entries.has(entry.path) ||
      entry.identity.dev !== binding.store.dev ||
      entry.identity.uid !== binding.store.uid ||
      entry.identity.gid !== binding.store.gid
    )
      throw fail();
    entries.set(entry.path, entry);
    bytes += entry.identity.size;
  }
  if (
    bytes !== value.bytes ||
    entries.get("")?.type !== "directory" ||
    entries.get("site")?.type !== "directory" ||
    entries.get("release.json")?.type !== "file" ||
    entries.get("redirects.conf")?.type !== "file"
  )
    throw fail();
  for (const entry of entries.values()) {
    if (!entry.path) continue;
    if (
      !["site", "release.json", "redirects.conf"].includes(entry.path) &&
      !entry.path.startsWith("site/")
    )
      throw fail();
    const parent = path.posix.dirname(entry.path);
    if (entries.get(parent === "." ? "" : parent)?.type !== "directory")
      throw fail();
  }
  return value;
}
function tombstone(attempt) {
  return {
    version: 1,
    artifactId: attempt.artifactId,
    token: attempt.token,
    generation: attempt.generation,
    fingerprint: attempt.fingerprint,
    manifestSha256: attempt.manifestSha256,
    bytes: attempt.bytes,
  };
}
function validateTombstone(value, binding, artifactId) {
  if (
    !exactKeys(value, [
      "version",
      "artifactId",
      "token",
      "generation",
      "fingerprint",
      "manifestSha256",
      "bytes",
    ]) ||
    value.version !== 1 ||
    value.artifactId !== artifactId ||
    !uuid.test(value.token) ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 0 ||
    value.generation > 2147483647 ||
    value.fingerprint !== binding.fingerprint ||
    !hash.test(value.manifestSha256) ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    value.bytes > 1024 ** 4
  )
    throw fail();
  return value;
}

export class ReleaseRetirementState {
  constructor(store) {
    if (
      !path.isAbsolute(store || "") ||
      path.resolve(store) !== store ||
      store === path.parse(store).root
    )
      throw fail();
    this.store = store;
    this.directory = path.join(store, ".retirement");
    this.retired = path.join(this.directory, "retired");
  }
  async root() {
    const base = await lstat(this.store);
    if (
      (await realpath(this.store)) !== this.store ||
      !base.isDirectory() ||
      base.mode & 0o002
    )
      throw fail();
    if (
      this.base &&
      !["dev", "ino", "uid", "gid", "mode"].every(
        (key) => this.base[key] === base[key],
      )
    )
      throw fail();
    await verifyReleaseMounts(this.store);
    this.base = base;
    return base;
  }
  async folder(directory, create = false) {
    if (create) {
      // Maintenance runs as the store's owner. Merely reading a fence through
      // a root-operated manual release command does not adopt/chown the store.
      if (this.base.uid !== process.getuid?.()) throw fail();
      await mkdir(directory, { mode: 0o700 }).catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
    }
    const info = await lstat(directory);
    if (
      (await realpath(directory)) !== directory ||
      !info.isDirectory() ||
      info.dev !== this.base.dev ||
      info.uid !== this.base.uid ||
      info.gid !== this.base.gid ||
      info.mode & 0o077
    )
      throw fail();
    return info;
  }
  async read(file, maximum, allowPublicationPair = false) {
    await this.root();
    await this.folder(path.dirname(file));
    const before = await stat(file);
    if (!before) return null;
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.uid !== this.base.uid ||
      before.gid !== this.base.gid ||
      before.dev !== this.base.dev ||
      before.mode & 0o077 ||
      (before.nlink !== 1 && !(allowPublicationPair && before.nlink === 2)) ||
      before.size < 1
    )
      throw fail();
    if (before.nlink === 2) await this.publicationPair(file, maximum);
    let value;
    const bytes = await readReleaseFile(file, before, maximum);
    if (before.nlink === 2) await this.publicationPair(file, maximum);
    try {
      value = JSON.parse(bytes.toString());
    } catch {
      throw fail();
    }
    return { value, bytes, identity: identity(before) };
  }
  async publish(file, value, maximum) {
    await this.root();
    await this.folder(path.dirname(file));
    const encoded = Buffer.from(JSON.stringify(value));
    if (encoded.length > maximum || this.base.uid !== process.getuid?.())
      throw fail();
    const previous = await this.read(file, maximum);
    if (previous) {
      if (!previous.bytes.equals(encoded)) throw fail();
      return previous;
    }
    // A killed pre-publication writer may leave a private temporary file. It
    // has no deletion authority and stays charged; never overwrite/adopt it.
    const directory = path.dirname(file);
    if (
      (await names(directory, maximumTombstones + 64)).filter((name) =>
        name.startsWith(".write-"),
      ).length >= 32
    )
      throw fail();
    const temporary = path.join(directory, `.write-${randomUUID()}.tmp`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(encoded);
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Rename cannot be used here: it would replace an unexpected existing
    // record. The linked first publication has a recoverable exact inode pair.
    try {
      await link(temporary, file);
      await sync(directory);
    } finally {
      await unlink(temporary);
      await sync(directory);
    }
    return this.read(file, maximum);
  }
  async publicationPair(file, maximum) {
    await this.root();
    await this.folder(path.dirname(file));
    const info = await stat(file);
    if (!info || info.nlink === 1) return null;
    if (
      !info.isFile() ||
      info.nlink !== 2 ||
      info.uid !== this.base.uid ||
      info.gid !== this.base.gid ||
      info.dev !== this.base.dev ||
      info.mode & 0o077 ||
      info.size < 1 ||
      info.size > maximum
    )
      throw fail();
    const siblings = await names(path.dirname(file), maximumTombstones + 64);
    let paired = null;
    for (const name of siblings) {
      if (!/^\.write-[a-f0-9-]{36}\.tmp$/.test(name)) continue;
      const candidate = path.join(path.dirname(file), name),
        other = await lstat(candidate);
      if (other.ino === info.ino && other.dev === info.dev) {
        if (paired || !other.isFile() || other.nlink !== 2) throw fail();
        paired = candidate;
      }
    }
    if (!paired) throw fail();
    // Do not unlink a replaced path after inspecting the pair.
    if (
      !same(identity(await lstat(file)), identity(info)) ||
      !same(identity(await lstat(paired)), identity(info))
    )
      throw fail();
    return { paired, identity: identity(info) };
  }
  async recoverPair(file, maximum) {
    const pair = await this.publicationPair(file, maximum);
    if (!pair) return;
    if (
      !same(identity(await lstat(file)), pair.identity) ||
      !same(identity(await lstat(pair.paired)), pair.identity)
    )
      throw fail();
    await unlink(pair.paired);
    await sync(path.dirname(file));
  }
  async releaseDirectory() {
    const directory = path.join(this.store, "releases"),
      info = await lstat(directory);
    if (
      (await realpath(directory)) !== directory ||
      !info.isDirectory() ||
      info.dev !== this.base.dev ||
      info.uid !== this.base.uid ||
      info.gid !== this.base.gid ||
      info.mode & 0o002
    )
      throw fail();
    const observed = {
      dev: info.dev,
      ino: info.ino,
      uid: info.uid,
      gid: info.gid,
      mode: info.mode,
    };
    if (this.binding && !same(observed, this.binding.releases)) throw fail();
    return observed;
  }
  async bind(input) {
    await this.root();
    const releases = await this.releaseDirectory();
    const expected = validateBinding(
      {
        version: 1,
        projectId: input.projectId,
        scope: input.scope,
        workerId: input.workerId,
        origin: input.origin,
        store: {
          root: this.store,
          dev: this.base.dev,
          ino: this.base.ino,
          uid: this.base.uid,
          gid: this.base.gid,
        },
        releases,
        fingerprint: input.storeFingerprint,
      },
      this.store,
      this.base,
    );
    await this.folder(this.directory, true);
    const file = path.join(this.directory, "binding.json");
    await this.recoverPair(file, 8192);
    const saved = await this.read(file, 8192);
    if (!saved) {
      // No attempt or fence may predate its binding. Unknown files are kept.
      const existing = await names(this.directory, 64);
      if (existing.some((name) => !/^\.write-[a-f0-9-]{36}\.tmp$/.test(name)))
        throw fail();
    }
    this.binding = validateBinding(
      (await this.publish(file, expected, 8192)).value,
      this.store,
      this.base,
    );
    await this.folder(this.retired, true);
    await sync(this.directory);
    await sync(this.store);
    return this.binding;
  }
  async loadBinding() {
    if (!(await stat(this.directory))) return null;
    await this.root();
    await this.folder(this.directory);
    const saved = await this.read(
      path.join(this.directory, "binding.json"),
      8192,
      true,
    );
    if (!saved) throw fail();
    this.binding = validateBinding(saved.value, this.store, this.base);
    await this.releaseDirectory();
    return this.binding;
  }
  /** Read recovery authority before acquiring a stopped activation lock. Exact
   * first-publication pairs may be inspected, but nothing is unlinked here. */
  async peek() {
    if (!(await stat(this.directory))) return null;
    await this.root();
    await this.folder(this.directory);
    const saved = await this.read(
      path.join(this.directory, "binding.json"),
      8192,
      true,
    );
    if (!saved) throw fail();
    this.binding = validateBinding(saved.value, this.store, this.base);
    await this.releaseDirectory();
    const attempt = await this.read(
      path.join(this.directory, "attempt.json"),
      maximumAttempt,
      true,
    );
    return {
      binding: this.binding,
      attempt: attempt ? validateAttempt(attempt.value, this.binding) : null,
    };
  }
  async attempt() {
    if (!this.binding) throw fail();
    const file = path.join(this.directory, "attempt.json");
    await this.recoverPair(file, maximumAttempt);
    const saved = await this.read(file, maximumAttempt);
    return saved ? validateAttempt(saved.value, this.binding) : null;
  }
  async begin(attempt) {
    if (!this.binding) throw fail();
    validateAttempt(attempt, this.binding);
    if (
      attempt.owner.operation.host !== hostname() ||
      attempt.owner.operation.processId !== process.pid
    )
      throw fail();
    const previous = await this.attempt();
    if (!previous && (await this.isFenced(attempt.artifactId))) throw fail();
    if (
      !previous &&
      (await names(this.retired, maximumTombstones + 64)).length >=
        maximumTombstones
    )
      throw fail();
    await this.publish(
      path.join(this.directory, "attempt.json"),
      attempt,
      maximumAttempt,
    );
    return attempt;
  }
  async adopt(attempt, owner) {
    // The coordinator proves the previous invocation stopped first. Record the
    // new executor before another claim/removal, so a second interrupted
    // recovery cannot rely only on the original creator's stopped process.
    const replacement = { ...attempt, owner };
    validateAttempt(replacement, this.binding);
    if (
      owner.operation.processId !== process.pid ||
      owner.operation.host !== hostname() ||
      !["workerId", "configuration", "projectId", "host"].every(
        (key) => owner.operation[key] === attempt.owner.operation[key],
      ) ||
      owner.controller.unit !== attempt.owner.controller.unit
    )
      throw fail();
    const file = path.join(this.directory, "attempt.json"),
      previous = await this.read(file, maximumAttempt);
    if (!previous || JSON.stringify(previous.value) !== JSON.stringify(attempt))
      throw fail();
    const encoded = Buffer.from(JSON.stringify(replacement));
    if (encoded.length > maximumAttempt || this.base.uid !== process.getuid?.())
      throw fail();
    if (
      (await names(this.directory, 64)).filter((name) =>
        name.startsWith(".write-"),
      ).length >= 32
    )
      throw fail();
    const temporary = path.join(this.directory, `.write-${randomUUID()}.tmp`);
    const handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(encoded);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const current = await this.read(file, maximumAttempt);
    if (
      !current ||
      !current.bytes.equals(previous.bytes) ||
      !same(current.identity, previous.identity)
    )
      throw fail();
    await rename(temporary, file);
    await sync(this.directory);
    return replacement;
  }
  async fence(attempt) {
    const saved = await this.attempt();
    if (JSON.stringify(saved) !== JSON.stringify(attempt)) throw fail();
    const file = path.join(this.retired, `${attempt.artifactId}.json`);
    await this.recoverPair(file, 2048);
    return this.publish(file, tombstone(attempt), 2048);
  }
  async isFenced(artifactId) {
    if (!idPattern.test(artifactId) || !this.binding) throw fail();
    const saved = await this.read(
      path.join(this.retired, `${artifactId}.json`),
      2048,
    );
    if (!saved) return false;
    validateTombstone(saved.value, this.binding, artifactId);
    return true;
  }
  async abandon(attempt, receipt) {
    // A server generation advance, under its claim lock, invalidates even an
    // old request still in transit. A plain pending response is insufficient.
    if (
      !this.binding ||
      receipt?.phase !== "cancelled" ||
      receipt.cancelled_token !== attempt.token ||
      receipt.cancelled_generation !== attempt.generation ||
      !Number.isSafeInteger(receipt.attempt_generation) ||
      receipt.attempt_generation <= attempt.generation ||
      receipt.project_id !== this.binding.projectId ||
      receipt.scope !== this.binding.scope ||
      receipt.worker_id !== this.binding.workerId ||
      receipt.artifact_id !== attempt.artifactId ||
      receipt.store_fingerprint !== attempt.fingerprint ||
      receipt.manifest_sha256 !== attempt.manifestSha256 ||
      receipt.bytes !== attempt.bytes ||
      (await this.isFenced(attempt.artifactId))
    )
      throw fail();
    const file = path.join(this.directory, "attempt.json"),
      saved = await this.read(file, maximumAttempt);
    if (!saved) return;
    if (
      JSON.stringify(saved.value) !== JSON.stringify(attempt) ||
      !same(identity(await lstat(file)), saved.identity)
    )
      throw fail();
    await unlink(file);
    await sync(this.directory);
  }
  async forget(attempt, receipt) {
    // Called only after physical absence + the exact server completion receipt.
    if (
      !this.binding ||
      receipt?.phase !== "removed" ||
      receipt.owner_token !== attempt.token ||
      receipt.attempt_generation !== attempt.generation ||
      receipt.project_id !== this.binding.projectId ||
      receipt.scope !== this.binding.scope ||
      receipt.worker_id !== this.binding.workerId ||
      receipt.artifact_id !== attempt.artifactId ||
      receipt.store_fingerprint !== attempt.fingerprint ||
      receipt.manifest_sha256 !== attempt.manifestSha256 ||
      receipt.bytes !== attempt.bytes ||
      !(await this.isFenced(attempt.artifactId))
    )
      throw fail();
    await this.releaseDirectory();
    const fence = await this.read(
      path.join(this.retired, `${attempt.artifactId}.json`),
      2048,
    );
    if (
      !fence ||
      JSON.stringify(fence.value) !== JSON.stringify(tombstone(attempt))
    )
      throw fail();
    if (await stat(path.join(this.store, "releases", attempt.artifactId)))
      throw fail();
    const file = path.join(this.directory, "attempt.json"),
      saved = await this.read(file, maximumAttempt);
    if (!saved) return; // An exact completed retry leaves the permanent fence.
    if (JSON.stringify(saved.value) !== JSON.stringify(attempt)) throw fail();
    if (!same(identity(await lstat(file)), saved.identity)) throw fail();
    await unlink(file);
    await sync(this.directory);
  }
}

/** Direct CLI staging must honor durable retirement even after files vanish.
 * This is read-only: damaged/partial records refuse staging until recovery. */
export async function assertReleaseIdNotRetired(store, artifactId) {
  if (!idPattern.test(artifactId)) throw fail();
  const state = new ReleaseRetirementState(store);
  if (!(await state.loadBinding())) return;
  if (await state.isFenced(artifactId))
    throw new Error(
      "This release ID has been retired. Stage a new release ID.",
    );
  const saved = await state.read(
    path.join(state.directory, "attempt.json"),
    maximumAttempt,
  );
  if (
    saved &&
    validateAttempt(saved.value, state.binding).artifactId === artifactId
  )
    throw new Error(
      "This release ID has an unfinished retirement. Reconcile it before staging.",
    );
}
