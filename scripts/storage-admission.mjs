/** Shared disk admission for services that write to one filesystem. Each
 * producer publishes the growth it may spend as its own reservation file, then
 * re-sums every live reservation on that filesystem and withdraws if the free
 * floor would be crossed. Two concurrent producers therefore see each other and
 * cannot both spend the same headroom; at worst both back off. A reservation is
 * removed by anyone only when its owner process is proven gone on this host.
 * This bounds admission; commands are still monitored, not hard-quota'd. */
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  readFile,
  readdir,
  rename,
  statfs,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  currentProcessIdentity,
  processStopped,
  validProcessIdentity,
} from "./process-identity.mjs";

const GiB = 1024 ** 3;
const maximumReservations = 1000;
const name =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.json$/;
const temporary =
  /^\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/;
const fail = (reason) =>
  new Error(
    `Shared storage admission could not be verified: ${reason}. Existing files are kept and no work was started.`,
  );
export const admissionRefusal = () =>
  Object.assign(
    new Error(
      "The server is short of free disk space shared with other work. Existing files are kept. Try again after other work finishes.",
    ),
    { admissionRefused: true },
  );

export class StorageAdmission {
  /** Null when no shared admission directory is configured. */
  static async fromEnvironment(service, environment = process.env, adapters) {
    const directory = environment.KAIZEN_STORAGE_ADMISSION_DIRECTORY;
    if (directory === undefined || directory === "") return null;
    const maximum =
      environment.KAIZEN_STORAGE_RESERVATION_MAX_BYTES ?? String(4 * GiB);
    if (!/^[1-9][0-9]*$/.test(maximum) || Number(maximum) > 1024 * GiB)
      throw fail("configure a valid maximum reservation");
    return StorageAdmission.open(directory, service, {
      ...adapters,
      maximumReservationBytes: Number(maximum),
    });
  }
  static async open(directory, service, options = {}) {
    if (
      typeof directory !== "string" ||
      !path.isAbsolute(directory) ||
      path.resolve(directory) !== directory ||
      !/^[a-z0-9-]{1,64}$/.test(service || "")
    )
      throw fail("configure an absolute admission directory and service");
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o002)
      throw fail("the admission directory is linked or world-writable");
    return new StorageAdmission(
      directory,
      service,
      info,
      await currentProcessIdentity(),
      options,
    );
  }
  constructor(directory, service, info, owner, options) {
    this.directory = directory;
    this.service = service;
    this.gid = info.gid;
    this.owner = owner;
    this.statfs = options.statfs || statfs;
    this.maximumReservationBytes = options.maximumReservationBytes ?? 4 * GiB;
  }
  async free(target) {
    const disk = await this.statfs(target, { bigint: true });
    return disk.bavail * disk.bsize;
  }
  /** Live reservations. Proven-stopped owners are removed; anything malformed
   * refuses admission rather than silently discounting shared headroom. */
  async entries() {
    const names = await readdir(this.directory);
    if (names.length > maximumReservations * 2 + 16)
      throw fail("too many reservation records");
    const result = [];
    for (const item of names) {
      const file = path.join(this.directory, item);
      if (temporary.test(item)) {
        const value = await this.read(file).catch(() => null);
        if (value && (await processStopped(value.owner, this.owner)))
          await unlink(file).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        continue;
      }
      if (!name.test(item)) continue;
      const value = await this.read(file);
      if (!value) continue; // Released between listing and reading.
      if (await processStopped(value.owner, this.owner)) {
        await unlink(file).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
        continue;
      }
      result.push(value);
    }
    return result;
  }
  async read(file) {
    const info = await lstat(file).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return null;
    if (
      !info.isFile() ||
      info.nlink !== 1 ||
      info.mode & 0o002 ||
      info.gid !== this.gid ||
      info.size > 4096
    )
      throw fail("a reservation record is unsafe");
    let value;
    try {
      value = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw fail("a reservation record is malformed");
    }
    if (
      !value ||
      Object.keys(value).sort().join(",") !==
        "bytes,createdAt,dev,id,owner,service,version" ||
      value.version !== 1 ||
      `${value.id}.json` !==
        path
          .basename(file)
          .replace(/^\./, "")
          .replace(/\.tmp$/, ".json") ||
      !/^[a-z0-9-]{1,64}$/.test(value.service) ||
      !Number.isSafeInteger(value.dev) ||
      !Number.isSafeInteger(value.bytes) ||
      value.bytes < 0 ||
      value.bytes > 1024 * GiB ||
      !validProcessIdentity(value.owner) ||
      !Number.isFinite(Date.parse(value.createdAt))
    )
      throw fail("a reservation record is malformed");
    return value;
  }
  /** Bytes other live producers reserved on `target`'s filesystem. */
  async reserved(target, excludeId) {
    const { dev } = await lstat(target);
    return (await this.entries())
      .filter((item) => item.dev === dev && item.id !== excludeId)
      .reduce((total, item) => total + BigInt(item.bytes), 0n);
  }
  /** Reserve between `minimum` and `maximum` bytes above `floor`. */
  async reserve(target, { minimum = 0, maximum, floor }) {
    if (
      ![minimum, maximum, floor].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      ) ||
      minimum > maximum
    )
      throw fail("invalid reservation size");
    const { dev } = await lstat(target);
    const shareable = async (excludeId) =>
      (await this.free(target)) -
      (await this.reserved(target, excludeId)) -
      BigInt(floor);
    // The cap limits open-ended reservations, never a known required copy size.
    const ceiling = BigInt(
      Math.max(minimum, Math.min(maximum, this.maximumReservationBytes)),
    );
    const before = await shareable();
    const bytes = Number(
      before < BigInt(minimum) ? -1n : before < ceiling ? before : ceiling,
    );
    if (bytes < minimum) throw admissionRefusal();
    const id = randomUUID(),
      file = path.join(this.directory, `${id}.json`),
      staged = path.join(this.directory, `.${id}.tmp`);
    const value = {
      version: 1,
      id,
      service: this.service,
      dev,
      bytes,
      owner: this.owner,
      createdAt: new Date().toISOString(),
    };
    await writeFile(staged, JSON.stringify(value), { flag: "wx", mode: 0o660 });
    await chmod(staged, 0o660);
    await rename(staged, file);
    const release = () =>
      unlink(file).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    try {
      // Re-sum after publishing: a concurrent producer now sees this one too.
      if ((await shareable(id)) < BigInt(bytes)) throw admissionRefusal();
    } catch (error) {
      await release();
      throw error;
    }
    return Object.freeze({ id, bytes, release });
  }
}
