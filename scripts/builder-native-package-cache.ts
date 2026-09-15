/** Maintenance of the fixed native worker's private pnpm 10 store. The caller
 * holds the deployment lock and native operation, with all prior commands stopped. */
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { link, lstat, open, opendir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { privateDirectory, unlinkedPath } from "./builder-hosted-folders";

type Identity = { dev: number; ino: number };
type Ownership = {
  version: 1;
  id: string;
  root: string;
  state: string;
  store: Identity;
  cache: Identity;
};
const problem = () =>
  new Error(
    "Deployment package cache needs an ownership or layout check. Its files are preserved.",
  );
const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
const stat = (file: string) =>
  lstat(file).catch((error) => {
    if (missing(error)) return null;
    throw error;
  });
const same = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;
const sync = async (directory: string) => {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

export class NativePackageCache {
  readonly store: string;
  readonly cache: string;
  readonly trigger: number;
  private readonly record: string;
  constructor(
    private root: string,
    private state: string,
    environment: NodeJS.ProcessEnv,
  ) {
    this.store = path.join(state, "dependencies");
    this.cache = path.join(state, "cache/pnpm");
    this.record = path.join(state, "package-cache.json");
    const value =
      environment.BUILDER_NATIVE_CACHE_PRUNE_BYTES ?? String(2 * 1024 ** 3);
    if (
      !/^[1-9][0-9]*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > 1024 ** 4
    )
      throw problem();
    this.trigger = Number(value);
  }
  /** The same locations and non-global virtual-store mode apply to both installs. */
  arguments() {
    return [
      "--store-dir",
      this.store,
      `--config.cache-dir=${this.cache}`,
      "--config.enable-global-virtual-store=false",
      "--config.manage-package-manager-versions=false",
    ];
  }
  private async read(): Promise<Ownership | null> {
    await privateDirectory(this.state);
    const info = await stat(this.record);
    if (!info) return null;
    if (
      !info.isFile() ||
      info.uid !== process.getuid?.() ||
      info.mode & 0o077 ||
      info.size > 2048 ||
      ![1, 2].includes(info.nlink)
    )
      throw problem();
    const handle = await open(
      this.record,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    let value: Ownership;
    try {
      if (!same(info, await handle.stat())) throw problem();
      const bytes = Buffer.alloc(2049);
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      const after = await handle.stat();
      if (
        bytesRead !== info.size ||
        after.size !== info.size ||
        after.mtimeMs !== info.mtimeMs ||
        after.ctimeMs !== info.ctimeMs
      )
        throw problem();
      value = JSON.parse(bytes.subarray(0, bytesRead).toString());
    } catch {
      throw problem();
    } finally {
      await handle.close();
    }
    if (
      !value ||
      value.version !== 1 ||
      !/^[a-f0-9-]{36}$/.test(value.id) ||
      value.root !== this.root ||
      value.state !== this.state ||
      [value.store, value.cache].some(
        (item) =>
          !item ||
          !Number.isSafeInteger(item.dev) ||
          !Number.isSafeInteger(item.ino),
      )
    )
      throw problem();
    if (info.nlink === 2) {
      // The first durable publication can be interrupted between link/unlink.
      const temporary = path.join(
        this.state,
        `.package-cache-${value.id}.json.tmp`,
      );
      const peer = await stat(temporary);
      if (!peer || !same(peer, info) || peer.nlink !== 2) throw problem();
      await unlink(temporary);
      await sync(this.state);
    }
    for (const [directory, identity] of [
      [this.store, value.store],
      [this.cache, value.cache],
    ] as const) {
      await unlinkedPath(directory);
      const current = await stat(directory);
      if (
        !current ||
        !current.isDirectory() ||
        current.uid !== process.getuid?.() ||
        current.mode & 0o077 ||
        !same(current, identity)
      )
        throw problem();
    }
    return value;
  }
  /** Never adopt populated, unrecorded directories. No pnpm command precedes this record. */
  async prepare() {
    if (await this.read()) return;
    for (const directory of [this.store, path.dirname(this.cache), this.cache])
      await privateDirectory(directory);
    for (const directory of [this.store, this.cache]) {
      for await (const _entry of await opendir(directory)) throw problem();
    }
    const identity = async (directory: string) => {
      const { dev, ino } = await lstat(directory);
      return { dev, ino };
    };
    const value: Ownership = {
      version: 1,
      id: randomUUID(),
      root: this.root,
      state: this.state,
      store: await identity(this.store),
      cache: await identity(this.cache),
    };
    const temporary = path.join(
      this.state,
      `.package-cache-${value.id}.json.tmp`,
    );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Empty roots can be reused after a crash before publication. An unlinked
    // temporary record is retained and counted; it grants no pruning authority.
    await sync(this.store);
    await sync(this.cache);
    await sync(path.dirname(this.cache));
    await link(temporary, this.record);
    await sync(this.state);
    await unlink(temporary);
    await sync(this.state);
  }
  private async inspect(signal: AbortSignal) {
    if (process.platform !== "linux") throw problem();
    // pnpm registers installations even with global virtual storage disabled.
    // Its prune never reads those links when the global links directory is absent.
    if (await stat(path.join(this.store, "v10/links"))) throw problem();
    const mounts = await readFile("/proc/self/mountinfo", "utf8");
    if (mounts.length > 2 * 1024 ** 2) throw problem();
    for (const line of mounts.trim().split("\n")) {
      const mounted = line
        .split(" ")[4]
        ?.replace(/\\([0-7]{3})/g, (_, octal) =>
          String.fromCharCode(parseInt(octal, 8)),
        );
      if (
        !mounted ||
        [this.store, this.cache].some(
          (root) => mounted === root || mounted.startsWith(root + path.sep),
        )
      )
        throw problem();
    }
    let bytes = 0,
      entries = 0;
    const walk = async (
      directory: string,
      base: string,
      device: number,
      depth: number,
    ) => {
      signal.throwIfAborted();
      if (depth > 128) throw problem();
      for await (const entry of await opendir(directory)) {
        signal.throwIfAborted();
        if (++entries > 200000) throw problem();
        const file = path.join(directory, entry.name),
          info = await lstat(file);
        const relative = path.relative(base, file);
        const registryLink =
          base === this.store &&
          /^v10\/projects\/[a-f0-9]{32}$/.test(relative) &&
          info.isSymbolicLink();
        if (
          info.dev !== device ||
          info.uid !== process.getuid?.() ||
          (!info.isDirectory() && !info.isFile() && !registryLink)
        )
          throw problem();
        // pnpm prune follows stat() in its CAS and JSON readers. Refuse alien
        // filenames and all links before allowing that command to delete data.
        if (base === this.store) {
          if (/^v10\/(files|index|tmp)$/.test(relative) && !info.isDirectory())
            throw problem();
          if (/^v10\/(files|index)\//.test(relative)) {
            const parts = relative.split("/");
            if (
              !/^[a-f0-9]{2}$/.test(parts[2]) ||
              (parts.length === 3
                ? !info.isDirectory()
                : parts.length !== 4 ||
                  !info.isFile() ||
                  !(
                    parts[1] === "files"
                      ? /^[a-f0-9]{126}(?:-exec|-index\.json)?$/
                      : /^[a-f0-9]{62}-.+\.json$/
                  ).test(parts[3]))
            )
              throw problem();
          }
        } else if (
          relative.split(path.sep)[0].startsWith("metadata") &&
          !/^metadata(?:-full)?-v1\.3(?:\/|$)/.test(relative)
        )
          throw problem();
        bytes += info.size;
        if (!Number.isSafeInteger(bytes)) throw problem();
        if (info.isDirectory()) await walk(file, base, device, depth + 1);
      }
    };
    for (const base of [this.store, this.cache])
      await walk(base, base, (await lstat(base)).dev, 0);
    return bytes;
  }
  async prune(input: {
    signal: AbortSignal;
    pressured: boolean;
    run: (args: string[], environment: NodeJS.ProcessEnv) => Promise<void>;
    log: (text: string) => void;
  }) {
    if (!(await this.read())) return false;
    let bytes: number;
    try {
      bytes = await this.inspect(input.signal);
    } catch (error) {
      input.signal.throwIfAborted();
      input.log(
        "Package cache cleanup skipped: unsupported retained data is preserved and remains counted.\n",
      );
      return false;
    }
    if (
      (!input.pressured && bytes < this.trigger) ||
      !(await stat(path.join(this.store, "v10")))
    )
      return false;
    if (!(await this.read())) throw problem();
    // No build environment/secrets or project hooks are required for pruning.
    await input.run(
      [
        ...this.arguments(),
        "--config.ignore-pnpmfile=true",
        "--config.ignore-scripts=true",
        "--config.userconfig=/dev/null",
        "--config.globalconfig=/dev/null",
        "store",
        "prune",
      ],
      {
        PATH: process.env.PATH,
        HOME: this.state,
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        XDG_CACHE_HOME: path.dirname(this.cache),
        XDG_DATA_HOME: path.join(this.state, "data"),
      },
    );
    return true;
  }
}
