/** Dedicated checkout updates use a private Git index. Recovery only accepts
 * old/approved source bytes and the exact lock inode owned by this transaction. */
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  lstat,
  open,
  link,
  readdir,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import {
  privateDirectory,
  privateFile,
  unlinkedPath,
} from "./builder-hosted-folders";
import {
  isNativeControllerIdentity,
  type NativeOperationController,
  type NativeControllerIdentity,
} from "./builder-native-controller";
import {
  isNativeOperationIdentity,
  type NativeOperationIdentity,
} from "../shared/builderNativeOperations";
import type { NativeFileProtection } from "./builder-native-operations";

export type CheckoutGit = (args: string[], index?: string) => Promise<string>;
type Receipt = {
  version: 1;
  id: string;
  root: string;
  repository: string;
  branch: string;
  candidate: string;
  before: string;
  after: string;
  originalIndex: string;
  preparedIndex?: string;
  lock?: { dev: number; ino: number };
  stopped: boolean;
  owner: NativeOperationIdentity;
  controller?: NativeControllerIdentity;
};
type Entry = { mode: string; oid: string };
type Options = {
  root: string;
  state: string;
  repository: string;
  branch: string;
  files: NativeFileProtection;
  controller?: NativeOperationController;
  signal: AbortSignal;
  git: CheckoutGit;
};
const absent = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
const problem = () =>
  new Error(
    "The interrupted checkout has changed or is still owned. Source, private files and recovery data are preserved.",
  );
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const sha = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const hash = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
async function stat(file: string) {
  return lstat(file).catch((error) => {
    if (!absent(error)) throw error;
    return null;
  });
}
async function sync(directory: string) {
  const file = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
async function bytes(file: string, max = 64 * 1024 ** 2): Promise<Buffer> {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = await handle.stat();
    if (
      !before.isFile() ||
      before.size > max ||
      before.nlink > 2 ||
      before.uid !== process.getuid?.()
    )
      throw problem();
    const result = Buffer.alloc(before.size);
    let read = 0;
    while (read < result.length) {
      const part = await handle.read(
        result,
        read,
        Math.min(64 * 1024, result.length - read),
        null,
      );
      if (!part.bytesRead) break;
      read += part.bytesRead;
    }
    if (
      read !== result.length ||
      (await handle.read(Buffer.alloc(1), 0, 1, null)).bytesRead
    )
      throw problem();
    const after = await handle.stat(),
      current = await lstat(file);
    if (
      result.length !== before.size ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      before.ino !== current.ino ||
      before.dev !== current.dev
    )
      throw problem();
    return result;
  } finally {
    await handle.close();
  }
}
async function write(file: string, value: Buffer | string) {
  const handle = await open(
    file,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await sync(path.dirname(file));
}
function decode(value: unknown, options: Options): Receipt {
  const item = value as Receipt;
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item) ||
    item.version !== 1 ||
    typeof item.id !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      item.id,
    ) ||
    item.root !== options.root ||
    item.repository !== options.repository ||
    item.branch !== options.branch ||
    typeof item.candidate !== "string" ||
    path.dirname(item.candidate) !== path.join(options.state, "candidates") ||
    !/^checkout-[a-zA-Z0-9_-]{1,100}$/.test(path.basename(item.candidate)) ||
    !sha(item.before) ||
    !sha(item.after) ||
    !hash(item.originalIndex) ||
    (item.preparedIndex !== undefined && !hash(item.preparedIndex)) ||
    (item.lock !== undefined &&
      (!item.lock ||
        !Number.isSafeInteger(item.lock.dev) ||
        !Number.isSafeInteger(item.lock.ino) ||
        Object.keys(item.lock).sort().join(",") !== "dev,ino")) ||
    typeof item.stopped !== "boolean" ||
    !isNativeOperationIdentity(item.owner) ||
    (item.controller !== undefined &&
      !isNativeControllerIdentity(item.controller)) ||
    Object.keys(item).some(
      (key) =>
        ![
          "version",
          "id",
          "root",
          "repository",
          "branch",
          "candidate",
          "before",
          "after",
          "originalIndex",
          "preparedIndex",
          "lock",
          "stopped",
          "owner",
          "controller",
        ].includes(key),
    )
  )
    throw problem();
  const owner = options.files.operation;
  if (
    !owner ||
    item.owner.host !== hostname() ||
    item.owner.workerId !== owner.workerId ||
    item.owner.configuration !== owner.configuration ||
    item.owner.projectId !== owner.projectId
  )
    throw problem();
  return item;
}
async function trees(
  git: CheckoutGit,
  commit: string,
): Promise<Map<string, Entry>> {
  const entries = new Map<string, Entry>();
  for (const line of (await git(["ls-tree", "-rz", "--full-tree", commit]))
    .split("\0")
    .filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(line);
    if (!match) throw problem();
    const [, mode, oid, name] = match;
    if (
      name.includes("\\") ||
      name
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            part.toLowerCase() === ".git",
        ) ||
      entries.has(name) ||
      entries.size >= 10000
    )
      throw problem();
    entries.set(name, { mode, oid });
  }
  return entries;
}
async function compatible(options: Options, item: Receipt, exact = false) {
  const before = await trees(options.git, item.before),
    after = await trees(options.git, item.after);
  const names = new Set([...before.keys(), ...after.keys()]);
  let total = 0;
  async function trackedDirectory(name: string) {
    const entries = await readdir(path.join(options.root, name), {
      withFileTypes: true,
    });
    if (!entries.length) throw problem();
    for (const entry of entries) {
      const relative = name + "/" + entry.name;
      if (entry.isDirectory()) await trackedDirectory(relative);
      else if (!names.has(relative)) throw problem();
    }
  }
  for (const name of names) {
    options.signal.throwIfAborted();
    let info: Awaited<ReturnType<typeof stat>> = null,
      prefix = "";
    for (const part of name.split("/")) {
      prefix = prefix ? prefix + "/" + part : part;
      info = await stat(path.join(options.root, prefix));
      if (!info) break;
      if (info.isSymbolicLink()) throw problem();
      if (!info.isDirectory() && prefix !== name) {
        info = null;
        break;
      }
    }
    const old = before.get(name),
      desired = after.get(name);
    if (info?.isDirectory()) {
      if (exact ? !!desired : !!old && !!desired) throw problem();
      await trackedDirectory(name);
      continue;
    }
    if (!info) {
      if (exact ? !!desired : !!old && !!desired) throw problem();
      continue;
    }
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      (total += info.size) > 200 * 1024 ** 2
    )
      throw problem();
    const data = await bytes(path.join(options.root, name), 200 * 1024 ** 2);
    const oid = createHash("sha1")
      .update("blob " + data.length + "\0")
      .update(data)
      .digest("hex");
    const mode = info.mode & 0o100 ? "100755" : "100644";
    const matches = (entry?: Entry) =>
      entry?.oid === oid && entry.mode === mode;
    if (!matches(desired) && (exact || !matches(old))) throw problem();
  }
}

export class NativeCheckoutRecovery {
  private directory: string;
  private receipt: string;
  constructor(private options: Options) {
    this.directory = path.join(options.state, "checkout");
    this.receipt = path.join(this.directory, "receipt.json");
  }
  private async save(item: Receipt, first = false) {
    const temporary = path.join(this.directory, randomUUID() + ".json.tmp");
    await write(temporary, JSON.stringify(item));
    if (first) {
      await link(temporary, this.receipt);
      await unlink(temporary);
    } else await rename(temporary, this.receipt);
    await sync(this.directory);
  }
  private async read(): Promise<Receipt | null> {
    await privateDirectory(this.directory);
    const metadata = await stat(this.receipt);
    if (!metadata) return null;
    if (metadata.nlink === 1) await privateFile(this.receipt, 16384);
    else {
      // First publication links a completely synced receipt into place. A
      // crash before unlinking its temporary name leaves this exact inode pair.
      if (
        !metadata.isFile() ||
        metadata.nlink !== 2 ||
        metadata.size < 1 ||
        metadata.size > 16384 ||
        metadata.uid !== process.getuid?.() ||
        metadata.mode & 0o077
      )
        throw problem();
      const names = await readdir(this.directory);
      if (names.length > 1000) throw problem();
      let paired = 0;
      for (const name of names.filter((name) =>
        /^[a-f0-9-]{36}\.json\.tmp$/.test(name),
      )) {
        const temporary = await lstat(path.join(this.directory, name));
        if (
          temporary.isFile() &&
          temporary.ino === metadata.ino &&
          temporary.dev === metadata.dev &&
          temporary.nlink === 2
        )
          paired++;
      }
      if (paired !== 1) throw problem();
    }
    return decode(
      JSON.parse((await bytes(this.receipt, 16384)).toString()),
      this.options,
    );
  }
  async recover() {
    const item = await this.read();
    if (!item) return null;
    if (
      !item.stopped &&
      !(
        item.controller &&
        (await this.options.controller?.stopped(item.owner, item.controller))
      )
    )
      throw problem();
    await this.finish(item);
    return { commit: item.after, previousCommit: item.before };
  }
  async protectedCandidate() {
    if (!(await stat(this.directory))) return null;
    const item = await this.read();
    if (!item && (await readdir(this.directory)).length) throw problem();
    return item?.candidate || null;
  }
  async apply(before: string, after: string, candidate: string) {
    if (await this.read()) throw problem();
    const operation = this.options.files.operation;
    if (!operation || !isNativeOperationIdentity(operation)) throw problem();
    const index = path.join(this.options.root, ".git/index");
    if ((await lstat(index)).nlink !== 1) throw problem();
    const item: Receipt = {
      version: 1,
      id: operation.id,
      root: this.options.root,
      repository: this.options.repository,
      branch: this.options.branch,
      candidate,
      before,
      after,
      originalIndex: digest(await bytes(index)),
      stopped: false,
      owner: { ...operation },
      ...(this.options.files.controller
        ? { controller: { ...this.options.files.controller } }
        : {}),
    };
    await this.save(item, true);
    await this.finish(item);
  }
  private async finish(item: Receipt) {
    const { root, git, files, signal } = this.options;
    const gitDirectory = path.join(root, ".git"),
      rootIndex = path.join(gitDirectory, "index");
    const sentinel = path.join(
      gitDirectory,
      "kaizen-checkout-" + item.id + ".owner",
    );
    const indexLock = path.join(gitDirectory, "index.lock");
    const temporary = path.join(
      gitDirectory,
      "kaizen-checkout-" + item.id + ".index",
    );
    const privateIndex = path.join(this.directory, "index");
    const token = Buffer.from("Kaizen checkout " + item.id + "\n");
    try {
      await unlinkedPath(gitDirectory);
      signal.throwIfAborted();
      item.stopped = false;
      item.owner = { ...files.operation! };
      item.controller = files.controller ? { ...files.controller } : undefined;
      await this.save(item);
      const head = (await git(["rev-parse", "HEAD"])).trim();
      if (![item.before, item.after].includes(head)) throw problem();
      const indexData = await bytes(rootIndex),
        indexHash = digest(indexData);
      if (![item.originalIndex, item.preparedIndex].includes(indexHash))
        throw problem();
      let owner = await stat(sentinel);
      if (
        owner &&
        (!owner.isFile() ||
          owner.mode & 0o077 ||
          !(await bytes(sentinel, 1024)).equals(token))
      )
        throw problem();
      let lock = await stat(indexLock);
      if (lock) {
        const paired =
          owner &&
          lock.ino === owner.ino &&
          lock.dev === owner.dev &&
          owner.nlink === 2;
        const recorded =
          item.lock?.ino === lock.ino &&
          item.lock?.dev === lock.dev &&
          lock.nlink === 1 &&
          !owner;
        if (
          !lock.isFile() ||
          lock.mode & 0o077 ||
          (!paired && !recorded) ||
          !(await bytes(indexLock, 1024)).equals(token)
        )
          throw problem();
      } else {
        if (!owner) {
          await write(sentinel, token);
          owner = await lstat(sentinel);
        }
        if (owner.nlink !== 1) throw problem();
        await link(sentinel, indexLock);
        await sync(gitDirectory);
        lock = await lstat(indexLock);
      }
      item.lock = { dev: lock.dev, ino: lock.ino };
      await this.save(item);
      // Persist the exact inode before removing the temporary second link.
      // Subsequent readers see the ordinary single-link Git lock file.
      if (owner) {
        await unlink(sentinel);
        await sync(gitDirectory);
      }
      await compatible(this.options, item);
      const ownedIndex = { ...item.lock, contents: token.toString() };
      await files.assertRepository(root, signal, ownedIndex);
      // The actual index is never passed to Git's incremental worktree update.
      // Private index/lock files can be recreated after the owner is stopped.
      for (const file of [privateIndex, privateIndex + ".lock"]) {
        const info = await stat(file);
        if (
          info &&
          (!info.isFile() ||
            info.isSymbolicLink() ||
            info.nlink !== 1 ||
            info.uid !== process.getuid?.())
        )
          throw problem();
        if (info) await unlink(file);
      }
      await write(privateIndex, indexData);
      await git(["read-tree", "--reset", "-u", item.after], privateIndex);
      await compatible(this.options, item, true);
      await files.assertRepository(root, signal, ownedIndex);
      const desiredIndex = await bytes(privateIndex);
      item.preparedIndex = digest(desiredIndex);
      await this.save(item);
      if (digest(await bytes(rootIndex)) !== indexHash) throw problem();
      const leftover = await stat(temporary);
      if (leftover) {
        if (
          !leftover.isFile() ||
          leftover.nlink !== 1 ||
          leftover.uid !== process.getuid?.() ||
          leftover.mode & 0o077
        )
          throw problem();
        await unlink(temporary);
      }
      await write(temporary, desiredIndex);
      await rename(temporary, rootIndex);
      await sync(gitDirectory);
      const current = (await git(["rev-parse", "HEAD"])).trim();
      if (current === item.before && current !== item.after)
        await git([
          "update-ref",
          "-m",
          "Kaizen verified deployment",
          "HEAD",
          item.after,
          item.before,
        ]);
      else if (current !== item.after) throw problem();
      if ((await git(["status", "--porcelain", "--untracked-files=no"])).trim())
        throw problem();
      const held = await lstat(indexLock);
      if (
        held.ino !== item.lock.ino ||
        held.dev !== item.lock.dev ||
        held.nlink !== 1 ||
        !(await bytes(indexLock, 1024)).equals(token)
      )
        throw problem();
      await unlink(indexLock);
      await sync(gitDirectory);
      // Candidate ownership predates this checkout receipt. Its own journal
      // reclaims the verified stopped directory after this receipt is gone.
      await rm(this.directory, { recursive: true });
      await sync(this.options.state);
    } catch (error) {
      if (
        (error as { nativeRecoveryRequired?: boolean })?.nativeRecoveryRequired
      )
        files.retainOperation();
      else {
        item.stopped = true;
        await this.save(item);
      }
      throw error;
    }
  }
}
