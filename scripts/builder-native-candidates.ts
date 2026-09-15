/** One generated candidate per fixed deployment lock. Its intent precedes
 * materialization; only verified stopped work can release its retained bytes. */
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  link,
  lstat,
  mkdir,
  open,
  opendir,
  readFile,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { privateDirectory, unlinkedPath } from "./builder-hosted-folders";
import {
  isNativeOperationIdentity,
  type NativeOperationIdentity,
} from "../shared/builderNativeOperations";
import {
  isNativeControllerIdentity,
  type NativeControllerIdentity,
  type NativeOperationController,
} from "./builder-native-controller";
import type { NativeFileProtection } from "./builder-native-operations";

type Candidate = {
  version: 1;
  id: string;
  root: string;
  repository: string;
  branch: string;
  owner: NativeOperationIdentity;
  controller?: NativeControllerIdentity;
  phase: "allocating" | "running" | "stopped" | "removing";
  directory?: { dev: number; ino: number };
};
type Options = {
  root: string;
  state: string;
  repository: string;
  branch: string;
  files: NativeFileProtection;
  controller?: NativeOperationController;
  protectedCandidate: () => Promise<string | null>;
};
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const absent = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
const problem = () =>
  new Error(
    "The retained deployment candidate is still owned or changed. Its files and checkout recovery have been preserved.",
  );
const same = (a: NativeOperationIdentity, b: NativeOperationIdentity) =>
  [
    "id",
    "workerId",
    "configuration",
    "projectId",
    "processId",
    "host",
    "instanceId",
  ].every((key) => a[key] === b[key]);
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

export class NativeCandidates {
  private directory: string;
  private file: string;
  private observed: Buffer | null | undefined;
  private owner: NativeOperationIdentity;
  constructor(private options: Options) {
    const owner = options.files.operation;
    if (
      !owner ||
      !isNativeOperationIdentity(owner) ||
      owner.host !== hostname() ||
      owner.processId !== process.pid ||
      !path.isAbsolute(options.state) ||
      path.resolve(options.state) !== options.state ||
      !path.isAbsolute(options.root) ||
      path.resolve(options.root) !== options.root
    )
      throw problem();
    this.owner = Object.freeze({ ...owner });
    this.directory = path.join(options.state, "candidates");
    this.file = path.join(options.state, "candidate.json");
  }
  private location(item: Candidate) {
    return path.join(this.directory, "checkout-" + item.id);
  }
  private decode(value: unknown): Candidate {
    const item = value as Candidate;
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      item.version !== 1 ||
      !uuid.test(item.id) ||
      item.root !== this.options.root ||
      item.repository !== this.options.repository ||
      item.branch !== this.options.branch ||
      !isNativeOperationIdentity(item.owner) ||
      item.owner.host !== this.owner.host ||
      item.owner.workerId !== this.owner.workerId ||
      item.owner.configuration !== this.owner.configuration ||
      item.owner.projectId !== this.owner.projectId ||
      (item.controller !== undefined &&
        !isNativeControllerIdentity(item.controller)) ||
      !["allocating", "running", "stopped", "removing"].includes(item.phase) ||
      (item.directory !== undefined &&
        (!item.directory ||
          !Number.isSafeInteger(item.directory.dev) ||
          !Number.isSafeInteger(item.directory.ino) ||
          Object.keys(item.directory).sort().join(",") !== "dev,ino")) ||
      (item.phase !== "allocating" && !item.directory) ||
      Object.keys(item).some(
        (key) =>
          ![
            "version",
            "id",
            "root",
            "repository",
            "branch",
            "owner",
            "controller",
            "phase",
            "directory",
          ].includes(key),
      )
    )
      throw problem();
    return item;
  }
  private async bytes(): Promise<Buffer | null> {
    await privateDirectory(this.options.state);
    if (!(await stat(this.file))) return null;
    const handle = await open(
      this.file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const before = await handle.stat();
      if (
        !before.isFile() ||
        before.uid !== process.getuid?.() ||
        before.mode & 0o077 ||
        before.nlink < 1 ||
        before.nlink > 2 ||
        before.size < 1 ||
        before.size > 16384
      )
        throw problem();
      const data = Buffer.alloc(before.size + 1);
      let size = 0;
      while (size < data.length) {
        const part = await handle.read(data, size, data.length - size, null);
        if (!part.bytesRead) break;
        size += part.bytesRead;
      }
      const after = await handle.stat(),
        current = await lstat(this.file);
      if (
        size !== before.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs ||
        current.ino !== before.ino ||
        current.dev !== before.dev
      )
        throw problem();
      const result = data.subarray(0, size);
      const item = this.decode(JSON.parse(result.toString()));
      if (before.nlink === 2) {
        // A synced first intent was published with link(); its temporary name
        // may survive a crash before unlink. Recognise only that exact pair.
        const temporary = path.join(
          this.options.state,
          "candidate-" + item.id + ".json.tmp",
        );
        const paired = await lstat(temporary);
        if (
          !paired.isFile() ||
          paired.ino !== before.ino ||
          paired.dev !== before.dev ||
          paired.nlink !== 2
        )
          throw problem();
        await unlink(temporary);
        await sync(this.options.state);
      }
      return result;
    } finally {
      await handle.close();
    }
  }
  private async read() {
    this.observed = await this.bytes();
    return this.observed
      ? this.decode(JSON.parse(this.observed.toString()))
      : null;
  }
  private async unchanged() {
    if (this.observed === undefined) throw problem();
    const current = await this.bytes();
    if (current ? !this.observed?.equals(current) : this.observed !== null)
      throw problem();
  }
  private async save(item: Candidate, first = false) {
    this.decode(item);
    const encoded = Buffer.from(JSON.stringify(item));
    if (encoded.length > 16384) throw problem();
    await this.unchanged();
    const temporary = path.join(
      this.options.state,
      "candidate-" + (first ? item.id : randomUUID()) + ".json.tmp",
    );
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
    await this.unchanged();
    if (first) {
      await link(temporary, this.file);
      await unlink(temporary);
    } else await rename(temporary, this.file);
    await sync(this.options.state);
    this.observed = encoded;
  }
  private async forget() {
    await this.unchanged();
    await unlink(this.file);
    await sync(this.options.state);
    this.observed = null;
  }
  async create() {
    await privateDirectory(this.directory);
    if (await this.read()) throw problem();
    // Unknown/legacy candidates remain untouched and counted by the disk guard.
    let retained = 0;
    for await (const _entry of await opendir(this.directory)) {
      if (++retained >= 64) throw problem();
    }
    const item: Candidate = {
      version: 1,
      id: randomUUID(),
      root: this.options.root,
      repository: this.options.repository,
      branch: this.options.branch,
      owner: { ...this.owner },
      phase: "allocating",
      ...(this.options.files.controller
        ? { controller: { ...this.options.files.controller } }
        : {}),
    };
    await this.save(item, true);
    const directory = this.location(item);
    await mkdir(directory, { mode: 0o700 });
    await sync(this.directory);
    const info = await lstat(directory);
    item.directory = { dev: info.dev, ino: info.ino };
    item.phase = "running";
    await this.save(item);
    return directory;
  }
  /** Only the creating invocation may certify its controlled commands stopped. */
  async stopped(directory: string) {
    const item = await this.read();
    if (
      !item ||
      this.location(item) !== directory ||
      !same(item.owner, this.owner) ||
      item.phase !== "running"
    )
      throw problem();
    item.phase = "stopped";
    await this.save(item);
  }
  private async removable(item: Candidate) {
    const directory = this.location(item),
      info = await stat(directory);
    if (!info) return null;
    await unlinkedPath(directory);
    if (
      !info.isDirectory() ||
      info.uid !== process.getuid?.() ||
      info.mode & 0o077 ||
      (item.directory &&
        (info.dev !== item.directory.dev || info.ino !== item.directory.ino))
    )
      throw problem();
    // An operator mount must not turn recursive deletion of owned generated
    // files into deletion of another filesystem, including same-device binds.
    if (process.platform !== "linux") throw problem();
    const mounts = await readFile("/proc/self/mountinfo", "utf8");
    if (mounts.length > 2 * 1024 ** 2) throw problem();
    for (const line of mounts.trim().split("\n")) {
      const mount = line
        .split(" ")[4]
        ?.replace(/\\([0-7]{3})/g, (_, octal) =>
          String.fromCharCode(parseInt(octal, 8)),
        );
      if (
        !mount ||
        mount === directory ||
        mount.startsWith(directory + path.sep)
      )
        throw problem();
    }
    let entries = 0;
    const walk = async (folder: string, depth: number) => {
      if (depth > 128) throw problem();
      for await (const entry of await opendir(folder)) {
        if (++entries > 200000) throw problem();
        const file = path.join(folder, entry.name),
          child = await lstat(file);
        if (child.uid !== process.getuid?.() || child.dev !== info.dev)
          throw problem();
        if (child.isDirectory()) await walk(file, depth + 1);
        else if (!child.isFile() && !child.isSymbolicLink()) throw problem();
      }
    };
    await walk(directory, 0);
    const current = await lstat(directory);
    if (current.ino !== info.ino || current.dev !== info.dev) throw problem();
    return info;
  }
  /** Called inside a current native operation and the outer deployment lock. */
  async prune() {
    await privateDirectory(this.directory);
    const item = await this.read();
    if (!item) return true;
    const directory = this.location(item);
    if ((await this.options.protectedCandidate()) === directory) return false;
    if (!["stopped", "removing"].includes(item.phase)) {
      if (
        !item.controller ||
        !(await this.options.controller?.stopped(item.owner, item.controller))
      )
        return false;
    }
    const info = await this.removable(item);
    if (item.phase === "allocating") {
      // No package/Git command runs until the directory inode is recorded.
      // A crash in that narrow gap permits only rmdir of an empty directory.
      if (info) await rmdir(directory);
    } else {
      item.phase = "removing";
      await this.save(item);
      if (info) await rm(directory, { recursive: true });
    }
    await sync(this.directory);
    await this.forget();
    return true;
  }
}
