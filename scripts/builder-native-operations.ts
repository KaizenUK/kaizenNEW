/** Durable local intent outlives a lost database response. Caller work must
 * await all actual writes/child processes before its promise settles. */
import { constants } from "node:fs";
import { lstat, open, readdir, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import { privateDirectory, privateFile } from "./builder-hosted-folders";
import {
  nativeAssetContentReferences,
  scanNativeAssetTree,
  scanNativeAssetReferences,
  type OwnedGitIndexLock,
} from "./builder-native-asset-references";
import {
  isNativeControllerIdentity,
  type NativeControllerIdentity,
  type NativeOperationController,
} from "./builder-native-controller";
import {
  isNativeOperationIdentity,
  isNativeAssetPage,
  matchesNativeOperation,
  type NativeOperationIdentity,
  type NativeOperationInput,
  type NativeRetiredAsset,
} from "../shared/builderNativeOperations";

export type NativeOperationConnection = {
  nativeOperation: (
    token: string,
    input: NativeOperationInput,
  ) => Promise<unknown>;
};
type SavedOperation = NativeOperationIdentity & {
  localPhase: "intent" | "finished";
  controller?: NativeControllerIdentity;
};
const unavailable = () =>
  new Error(
    "A website operation needs reconciliation. Existing files remain protected.",
  );
const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";
const retiredReference = () =>
  new Error(
    "A file in these changes is being removed or is no longer available. Import a replacement before saving.",
  );

/** Every prospective source/draft/output check uses the retired identities
 * captured while this producer is active. Cleanup cannot add another one. */
export class NativeFileProtection {
  private recovery = false;
  constructor(
    private assets: readonly NativeRetiredAsset[],
    readonly operation?: Readonly<NativeOperationIdentity>,
    readonly controller?: Readonly<NativeControllerIdentity>,
  ) {}
  /** A controller could not confirm that its work stopped or recovered. */
  retainOperation() {
    this.recovery = true;
  }
  get recoveryRequired() {
    return this.recovery;
  }
  private groups() {
    const groups: NativeRetiredAsset[][] = [];
    let group: NativeRetiredAsset[] = [];
    for (const asset of this.assets) {
      if (
        group.length === 100 ||
        group.some((item) => item.assetId === asset.assetId)
      ) {
        groups.push(group);
        group = [];
      }
      group.push(asset);
    }
    if (group.length) groups.push(group);
    return groups;
  }
  async assertTree(root: string, signal?: AbortSignal) {
    for (const assets of this.groups()) {
      const found = await scanNativeAssetTree({ root, assets, signal });
      if (found.references.length) throw retiredReference();
    }
  }
  async assertRepository(
    root: string,
    signal?: AbortSignal,
    ownedIndex?: OwnedGitIndexLock,
  ) {
    for (const assets of this.groups()) {
      const found = await scanNativeAssetReferences({
        root,
        assets,
        recoveryRoots: [],
        releaseStores: [],
        signal,
        ownedIndex,
      });
      if (found.references.length) throw retiredReference();
    }
  }
  assertBytes(bytes: Uint8Array, name = "changes.txt") {
    // Asset UUIDs may appear in both Kaizen and a copied client library, with
    // different historical URLs. Separate groups preserve both spellings.
    for (const group of this.groups()) {
      if (nativeAssetContentReferences(group, bytes, name).length)
        throw retiredReference();
    }
  }
}

export class NativeOperationJournal {
  private instanceId = randomUUID();
  private inFlight = new Set<string>();
  constructor(
    private options: {
      directory: string;
      workerId: string;
      configuration: string;
      connection: NativeOperationConnection;
      controller?: NativeOperationController;
      // Intent recovery requires the actual host/controller to prove all work
      // stopped, including children. A timestamp or dead parent PID is not proof.
      stopped?: (identity: NativeOperationIdentity) => Promise<boolean>;
    },
  ) {
    if (!isNativeOperationIdentity(this.identity("kaizen")))
      throw unavailable();
    if (
      options.controller &&
      !isNativeControllerIdentity(options.controller.identity)
    )
      throw unavailable();
  }
  private identity(projectId: string): NativeOperationIdentity {
    return {
      id: randomUUID(),
      workerId: this.options.workerId,
      configuration: this.options.configuration,
      projectId,
      processId: process.pid,
      host: hostname(),
      instanceId: this.instanceId,
    };
  }
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw unavailable();
    return path.join(this.options.directory, `${id}.json`);
  }
  private async directory() {
    await privateDirectory(this.options.directory);
    const entries = await readdir(this.options.directory);
    return entries;
  }
  private async syncDirectory() {
    const directory = await open(
      this.options.directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  private async write(item: SavedOperation, first = false) {
    const target = this.file(item.id),
      temporary = first ? target : `${target}.${randomUUID()}.tmp`;
    const entries = await this.directory();
    if (first && entries.length >= 1000) throw unavailable();
    const file = await open(
      temporary,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(JSON.stringify(item));
      await file.sync();
    } finally {
      await file.close();
    }
    if (!first) await rename(temporary, target);
    await this.syncDirectory();
  }
  private async read(id: string): Promise<SavedOperation> {
    const target = this.file(id);
    await privateFile(target, 4096);
    const file = await open(
      target,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const before = await file.stat();
      if (
        !before.isFile() ||
        before.nlink !== 1 ||
        before.size > 4096 ||
        before.mode & 0o077 ||
        (process.getuid && before.uid !== process.getuid())
      )
        throw unavailable();
      const item = JSON.parse(await file.readFile("utf8"));
      const after = await lstat(target);
      if (
        before.ino !== after.ino ||
        before.dev !== after.dev ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        !isNativeOperationIdentity(item) ||
        item.id !== id ||
        item.workerId !== this.options.workerId ||
        !["intent", "finished"].includes((item as SavedOperation).localPhase) ||
        ((item as SavedOperation).controller !== undefined &&
          !isNativeControllerIdentity((item as SavedOperation).controller)) ||
        Object.keys(item).some(
          (key) =>
            ![
              "id",
              "workerId",
              "configuration",
              "projectId",
              "processId",
              "host",
              "instanceId",
              "localPhase",
              "controller",
            ].includes(key),
        )
      )
        throw unavailable();
      return item as SavedOperation;
    } finally {
      await file.close();
    }
  }
  private request(
    token: string,
    identity: NativeOperationIdentity,
    action: NativeOperationInput["action"],
    afterKey?: string,
  ) {
    const {
      id,
      workerId,
      configuration,
      projectId,
      processId,
      host,
      instanceId,
    } = identity;
    return this.options.connection.nativeOperation(token, {
      id,
      workerId,
      configuration,
      projectId,
      processId,
      host,
      instanceId,
      action,
      ...(afterKey !== undefined ? { afterKey } : {}),
    });
  }
  private async finish(item: SavedOperation) {
    if (item.localPhase !== "finished") throw unavailable();
    const receipt = await this.request("", item, "native-operation-end");
    if (!matchesNativeOperation(receipt, item) || receipt.phase !== "complete")
      throw unavailable();
    await unlink(this.file(item.id)).catch((error) => {
      if (!missing(error)) throw error;
    });
    await this.syncDirectory();
  }
  private async protection(token: string, identity: SavedOperation) {
    const assets: NativeRetiredAsset[] = [];
    let afterKey = "",
      bytes = 0;
    for (;;) {
      const page = await this.request(
        token,
        identity,
        "native-operation-assets",
        afterKey,
      );
      if (!isNativeAssetPage(page, identity.id)) throw unavailable();
      let last = afterKey;
      for (const item of page.assets) {
        const key = `${item.projectId}:${item.assetId}`;
        if (
          !["kaizen", identity.projectId].includes(item.projectId) ||
          key <= last
        )
          throw unavailable();
        last = key;
        bytes += Buffer.byteLength(item.url || "") + 128;
        if (assets.length >= 10000 || bytes > 16 * 1024 ** 2)
          throw unavailable();
        assets.push(item);
      }
      if (page.cursor === null) break;
      if (
        page.assets.length !== 100 ||
        page.cursor !== last ||
        last <= afterKey
      )
        throw unavailable();
      afterKey = last;
    }
    const { localPhase, controller, ...operation } = identity;
    return new NativeFileProtection(
      assets,
      Object.freeze(operation),
      controller && Object.freeze({ ...controller }),
    );
  }
  async run<T>(
    token: string,
    projectId: string,
    work: (files: NativeFileProtection) => Promise<T>,
  ): Promise<T> {
    const item: SavedOperation = {
      ...this.identity(projectId),
      localPhase: "intent",
      ...(this.options.controller
        ? { controller: { ...this.options.controller.identity } }
        : {}),
    };
    if (!isNativeOperationIdentity(item)) throw unavailable();
    this.inFlight.add(item.id);
    let protection: NativeFileProtection | undefined;
    try {
      await this.write(item, true);
      try {
        const receipt = await this.request(
          token,
          item,
          "native-operation-begin",
        );
        if (
          !matchesNativeOperation(receipt, item) ||
          receipt.phase !== "active"
        )
          throw unavailable();
        protection = await this.protection(token, item);
        return await work(protection);
      } finally {
        if (protection?.recoveryRequired) throw unavailable();
        // The work promise has settled or never started. Persist that fact
        // before asking SQL to release protection, including on a lost begin.
        item.localPhase = "finished";
        await this.write(item);
        await this.finish(item);
      }
    } finally {
      this.inFlight.delete(item.id);
    }
  }
  async recover() {
    let completed = 0,
      deferred = 0;
    for (const name of await this.directory()) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) {
        deferred++;
        continue;
      }
      const id = name.slice(0, -5);
      if (this.inFlight.has(id)) {
        deferred++;
        continue;
      }
      try {
        const item = await this.read(id);
        if (
          item.host !== hostname() ||
          (item.localPhase === "intent" &&
            !(item.controller
              ? await this.options.controller?.stopped(item, item.controller)
              : await this.options.stopped?.(item)))
        ) {
          deferred++;
          continue;
        }
        if (item.localPhase === "intent") {
          item.localPhase = "finished";
          await this.write(item);
        }
        await this.finish(item);
        completed++;
      } catch (error) {
        if (!missing(error)) deferred++;
      }
    }
    return { completed, deferred };
  }
}
