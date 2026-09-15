/** Complete operator inventory joins native filesystem evidence to the private
 * cleanup generation. No caller can supply paths, epochs or removal authority. */
import { createHash } from "node:crypto";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { validProjectId } from "../shared/builderProjects";
import { unlinkedPath } from "./builder-hosted-folders";
import {
  scanNativeAssetReferences,
  scanNativeAssetTree,
  type NativeAssetIdentity,
} from "./builder-native-asset-references";
import type {
  CleanupRecord,
  NativeCleanupHooks,
} from "./builder-asset-cleanup";
import type { UploadAttempt } from "./builder-upload-spool";

export type NativeAssetInventory = {
  version: 1;
  workerId: string;
  projects: string[];
  producers: { workerId: string; projectIds: string[] }[];
  roots: {
    kind: "repository" | "tree" | "repository-collection";
    path: string;
    projectIds: string[];
  }[];
};
const invalid = () =>
  new Error(
    "Configure the complete native website inventory before enabling file cleanup.",
  );
const changed = () =>
  new Error(
    "Native website files changed or remain referenced. Existing files and charges are retained.",
  );
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join(",") === keys.sort().join(",");
const worker = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const ordered = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function projects(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 100 ||
    value.some((id) => typeof id !== "string" || !validProjectId(id)) ||
    new Set(value).size !== value.length
  )
    throw invalid();
  return [...value].sort(ordered);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function nativeAssetInventory(value: unknown) {
  if (
    !record(value) ||
    !exact(value, ["version", "workerId", "projects", "producers", "roots"]) ||
    value.version !== 1 ||
    !worker(value.workerId)
  )
    throw invalid();
  const coverage = projects(value.projects);
  if (
    !coverage.includes("kaizen") ||
    !Array.isArray(value.producers) ||
    !value.producers.length ||
    value.producers.length > 100 ||
    !Array.isArray(value.roots) ||
    !value.roots.length ||
    value.roots.length > 100
  )
    throw invalid();
  const producers = value.producers
    .map((item: unknown) => {
      if (
        !record(item) ||
        !exact(item, ["workerId", "projectIds"]) ||
        !worker(item.workerId) ||
        item.workerId === value.workerId
      )
        throw invalid();
      const ids = projects(item.projectIds);
      if (ids.some((id) => !coverage.includes(id))) throw invalid();
      return { workerId: item.workerId, projectIds: ids };
    })
    .sort((a, b) => ordered(a.workerId, b.workerId));
  const roots = value.roots
    .map((item: unknown) => {
      if (
        !record(item) ||
        !exact(item, ["kind", "path", "projectIds"]) ||
        !["repository", "tree", "repository-collection"].includes(item.kind) ||
        typeof item.path !== "string" ||
        !path.isAbsolute(item.path) ||
        path.resolve(item.path) !== item.path ||
        item.path === "/" ||
        item.path.includes("\0") ||
        item.path.length > 4096
      )
        throw invalid();
      const ids = projects(item.projectIds);
      if (ids.some((id) => !coverage.includes(id))) throw invalid();
      return {
        kind: item.kind as NativeAssetInventory["roots"][number]["kind"],
        path: item.path,
        projectIds: ids,
      };
    })
    .sort((a, b) => ordered(a.path, b.path));
  if (
    new Set(producers.map((item) => item.workerId)).size !== producers.length ||
    new Set(roots.map((item) => item.path)).size !== roots.length ||
    coverage.some(
      (id) =>
        !producers.some((item) => item.projectIds.includes(id)) ||
        !roots.some(
          (item) => item.kind === "repository" && item.projectIds.includes(id),
        ),
    )
  )
    throw invalid();
  const configuration: NativeAssetInventory = {
    version: 1,
    workerId: value.workerId,
    projects: coverage,
    producers,
    roots,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(configuration))
    .digest("hex");
  return freeze({ configuration, fingerprint });
}
const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
async function optionalDirectory(root: string) {
  await unlinkedPath(root);
  const info = await lstat(root).catch((error) => {
    if (!missing(error)) throw error;
    return null;
  });
  if (info && !info.isDirectory()) throw changed();
  return !!info;
}
async function collection(root: string) {
  await unlinkedPath(root);
  const before = await lstat(root);
  if (!before.isDirectory()) throw changed();
  const children = await readdir(root, { withFileTypes: true });
  if (
    children.length > 1000 ||
    children.some((item) => !item.isDirectory() || item.isSymbolicLink())
  )
    throw changed();
  const names = children.map((item) => item.name).sort(ordered);
  const after = await lstat(root);
  const stamp = (item: typeof before) =>
    [item.dev, item.ino, item.mtimeMs, item.ctimeMs].join(":");
  if (stamp(before) !== stamp(after)) throw changed();
  return { names, stamp: stamp(after) };
}

export class NativeAssetCleanup implements NativeCleanupHooks {
  readonly inventory: ReturnType<typeof nativeAssetInventory>;
  constructor(
    inventory: unknown,
    private rpc: (name: string, args: Record<string, unknown>) => Promise<any>,
    private signal: AbortSignal = new AbortController().signal,
  ) {
    this.inventory = nativeAssetInventory(inventory);
  }
  private get common() {
    return {
      worker: this.inventory.configuration.workerId,
      fingerprint: this.inventory.fingerprint,
    };
  }
  async queue() {
    this.signal.throwIfAborted();
    return this.rpc("builder_native_asset_cleanup_queue", {
      ...this.common,
      batch_size: 20,
    });
  }
  private async observation() {
    this.signal.throwIfAborted();
    const value = await this.rpc("builder_native_cleanup_observe", this.common);
    if (
      !record(value) ||
      !exact(value, ["epoch", "configuration", "projects"]) ||
      typeof value.epoch !== "string" ||
      !/^(0|[1-9][0-9]{0,18})$/.test(value.epoch) ||
      BigInt(value.epoch) > 9223372036854775807n ||
      value.configuration !== this.inventory.fingerprint ||
      !Array.isArray(value.projects) ||
      JSON.stringify(value.projects) !==
        JSON.stringify(this.inventory.configuration.projects)
    )
      throw changed();
    return value.epoch;
  }
  private async scan(asset: NativeAssetIdentity) {
    const fingerprint = createHash("sha256").update(this.inventory.fingerprint);
    let referenced = false,
      bytes = 0,
      files = 0,
      objects = 0;
    const collections: { root: string; names: string[]; stamp: string }[] = [];
    const count = (value: {
      bytes: number;
      files: number;
      fingerprint: string;
      references: unknown[];
      historyObjects?: number;
    }) => {
      bytes += value.bytes;
      files += value.files;
      objects += value.historyObjects || 0;
      if (bytes > 8 * 1024 ** 3 || files > 250000 || objects > 500000)
        throw changed();
      referenced ||= value.references.length > 0;
      fingerprint.update(value.fingerprint);
    };
    const repository = async (root: string) => {
      const recoveryRoots: string[] = [];
      for (const suffix of [
        ".kaizen",
        ".kaizen-builder",
        "dist",
        "apps/studio/dist",
      ]) {
        const candidate = path.join(root, suffix);
        if (await optionalDirectory(candidate)) recoveryRoots.push(candidate);
      }
      count(
        await scanNativeAssetReferences({
          root,
          assets: [asset],
          recoveryRoots,
          releaseStores: [],
          signal: this.signal,
        }),
      );
    };
    // Every retained scope is scanned for this exact identity, including roots
    // belonging to another project which may retain an imported reference.
    for (const entry of this.inventory.configuration.roots) {
      this.signal.throwIfAborted();
      fingerprint
        .update(entry.kind)
        .update("\0")
        .update(entry.path)
        .update("\0");
      if (entry.kind === "repository") await repository(entry.path);
      else if (entry.kind === "tree")
        count(
          await scanNativeAssetTree({
            root: entry.path,
            assets: [asset],
            signal: this.signal,
          }),
        );
      else {
        const initial = await collection(entry.path);
        collections.push({ root: entry.path, ...initial });
        fingerprint.update(JSON.stringify(initial.names));
        for (const name of initial.names)
          await repository(path.join(entry.path, name));
      }
    }
    for (const previous of collections) {
      const current = await collection(previous.root);
      if (
        current.stamp !== previous.stamp ||
        JSON.stringify(current.names) !== JSON.stringify(previous.names)
      )
        throw changed();
    }
    return { referenced, fingerprint: fingerprint.digest("hex") };
  }
  async beforeClaim(
    item: Readonly<CleanupRecord>,
    attempt: Readonly<UploadAttempt>,
  ) {
    if (
      item.worker_id !== this.inventory.configuration.workerId ||
      !this.inventory.configuration.projects.includes(item.project_id)
    )
      throw changed();
    // A prior successful claim already retired this identity. New native work
    // cannot reintroduce it; replay keeps the existing provider/version proof.
    if (item.phase !== "pending") return;
    const epoch = await this.observation();
    const found = await this.scan({
      assetId: item.asset_id,
      url: item.file_url,
    });
    this.signal.throwIfAborted();
    const evidence = {
      ...this.common,
      request_id: item.id,
      scan_epoch: epoch,
      inventory_hash: found.fingerprint,
    };
    if (found.referenced) {
      await this.rpc("builder_native_cleanup_referenced", evidence);
      throw changed();
    }
    await this.rpc("builder_native_cleanup_clearance", {
      ...evidence,
      token: attempt.token,
    });
  }
}
