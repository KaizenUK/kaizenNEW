/** Retained-release eligibility. This observes database grace but never deletes
 * files or claims removal. The scoped session keeps later coordinator work
 * inside the existing staging/activation lock. */
import { createHash } from "node:crypto";
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  checkLive,
  readReleaseSelection,
  validateClientDestination,
  verifyRelease,
  withReleaseStoreLock,
} from "./kaizen-releases.mjs";
import {
  measureReleaseStorage,
  readReleaseFile,
  verifyReleaseMounts,
} from "./release-storage.mjs";
import { ReleaseRetirementState } from "./release-retirement-state.mjs";
export { validateReleaseMounts } from "./release-storage.mjs";
import {
  generatedAge,
  generatedLimits,
  inventoryGeneratedTree,
  removeGeneratedEntries,
} from "./release-generated-files.mjs";

const stagingPattern =
  /^\.staging-[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

const day = 86400000;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const uuidPattern = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const unavailable = (reason) =>
  new Error(
    `Release retention could not be fully verified: ${reason}. Existing files are kept.`,
  );
export const defaultReleaseRetention = Object.freeze({
  keepCount: 5,
  minAgeDays: 30,
  visitorGraceDays: 7,
});
function policy(value) {
  if (
    !value ||
    Object.keys(value).sort().join(",") !==
      "keepCount,minAgeDays,visitorGraceDays" ||
    !Object.values(value).every(Number.isSafeInteger) ||
    value.keepCount < 2 ||
    value.keepCount > 1000 ||
    value.minAgeDays < 1 ||
    value.minAgeDays > 3650 ||
    value.visitorGraceDays < 1 ||
    value.visitorGraceDays > 365
  )
    throw unavailable("configure valid release retention limits");
  return Object.freeze({ ...value });
}
export function releaseRetentionPolicy(environment = process.env) {
  const value = { ...defaultReleaseRetention };
  for (const [key, name] of [
    ["keepCount", "BUILDER_RELEASE_KEEP_COUNT"],
    ["minAgeDays", "BUILDER_RELEASE_MIN_AGE_DAYS"],
    ["visitorGraceDays", "BUILDER_RELEASE_VISITOR_GRACE_DAYS"],
  ]) {
    if (environment[name] === undefined) continue;
    if (!/^[1-9][0-9]*$/.test(environment[name]))
      throw unavailable("configure valid release retention limits");
    value[key] = Number(environment[name]);
  }
  return policy(value);
}
function timestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw unavailable("invalid retained timestamp");
  return Date.parse(value);
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
function unchanged(a, b) {
  return Object.keys(a).every((key) => a[key] === b[key]);
}
async function names(directory) {
  const result = [];
  for await (const entry of await opendir(directory)) {
    if (result.length >= 100000)
      throw unavailable("too many entries in one directory");
    result.push(entry.name);
  }
  return result.sort();
}
const terminal = new Set(["live", "failed", "rolled_back", "reconciled"]);
const statuses = new Set([
  ...terminal,
  "prepared",
  "checking",
  "activating",
  "verifying",
  "recovery_required",
  "reconciling",
]);
function transaction(value, name) {
  const allowed = new Set([
    "schemaVersion",
    "id",
    "releaseId",
    "previousReleaseId",
    "previousSelectedReleaseId",
    "startedAt",
    "status",
    "updatedAt",
    "error",
    "recoveryError",
    "recoveredOwner",
  ]);
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !uuidPattern.test(value.id) ||
    name !== `${value.id}.json` ||
    !idPattern.test(value.releaseId) ||
    !statuses.has(value.status) ||
    Object.keys(value).some((key) => !allowed.has(key)) ||
    [value.previousReleaseId, value.previousSelectedReleaseId].some(
      (id) => id !== undefined && !idPattern.test(id),
    )
  )
    throw unavailable("unknown or incomplete activation journal");
  const startedAt = timestamp(value.startedAt),
    updatedAt = timestamp(value.updatedAt || value.startedAt);
  if (updatedAt < startedAt)
    throw unavailable("activation journal timestamps disagree");
  return { ...value, lastUse: Math.max(startedAt, updatedAt) };
}

/** The connection must be the configured server RPC transport. Its observe
 * response is scope-bound, never a caller-supplied list of supposedly safe IDs.
 * No store is created/adopted. Unknown files stay charged and are never targets. */
export async function withReleaseRetentionStore(
  {
    store,
    origin,
    projectId,
    scope,
    workerId,
    connection,
    retention = releaseRetentionPolicy(),
  },
  work,
  adapters = {},
) {
  if (typeof work !== "function")
    throw unavailable("a held-lock operation is required");
  const selectedPolicy = policy(retention);
  if (
    !path.isAbsolute(store || "") ||
    path.resolve(store) !== store ||
    store === path.parse(store).root ||
    store === os.homedir() ||
    (await realpath(store)) !== store ||
    !(projectId === "kaizen" || uuidPattern.test(projectId)) ||
    !(
      scope === "repository:staging" ||
      scope === "repository:production" ||
      (scope?.startsWith("client:") && uuidPattern.test(scope.slice(7)))
    ) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(workerId || "") ||
    typeof connection?.rpc !== "function"
  )
    throw unavailable("configure the exact existing store and worker identity");
  const base = await lstat(store);
  if (!base.isDirectory() || base.isSymbolicLink() || base.mode & 0o002)
    throw unavailable("store ownership or type is unsafe");
  const now = (adapters.now || Date.now)();
  if (!Number.isSafeInteger(now) || now < 0)
    throw unavailable("invalid inspection clock");
  const storeIdentity = {
    root: store,
    dev: base.dev,
    ino: base.ino,
    uid: base.uid,
    gid: base.gid,
  };
  const storeFingerprint = digest(
    JSON.stringify({
      schemaVersion: 1,
      projectId,
      scope,
      workerId,
      ...storeIdentity,
    }),
  );
  await verifyReleaseMounts(store);
  return withReleaseStoreLock(store, async () => {
    // Validate an existing client assignment before any callback can publish
    // permanent retirement metadata for a wrongly configured project/scope.
    const clientFile = path.join(store, "client-destination.json");
    const clientInfo = await lstat(clientFile).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (clientInfo) {
      if (
        !clientInfo.isFile() ||
        clientInfo.isSymbolicLink() ||
        clientInfo.nlink !== 1 ||
        clientInfo.dev !== base.dev ||
        clientInfo.uid !== base.uid ||
        clientInfo.gid !== base.gid ||
        clientInfo.mode & 0o002
      )
        throw unavailable("the client binding is unsafe");
      const client = validateClientDestination(
        JSON.parse(
          (await readReleaseFile(clientFile, clientInfo, 16384)).toString(),
        ),
      );
      if (
        client.projectId !== projectId ||
        scope !== `client:${client.destinationId}` ||
        client.origin !== origin
      )
        throw unavailable(
          "store binding does not match the configured destination",
        );
    } else if (scope.startsWith("client:"))
      throw unavailable(
        "store binding does not match the configured destination",
      );
    let alive = true,
      lastSnapshots = null,
      lastPlan = null,
      lastCandidates = new Map();
    const assertOpen = () => {
      if (!alive) throw unavailable("the store lock has ended");
    };
    const inspect = async () => {
      assertOpen();
      lastSnapshots = null;
      lastPlan = null;
      const bound = await new ReleaseRetirementState(store).loadBinding();
      if (
        bound &&
        (bound.fingerprint !== storeFingerprint || bound.origin !== origin)
      )
        throw unavailable("the persistent retirement binding differs");
      const snapshots = new Map();
      let entries = 0,
        observedBytes = 0;
      async function entry(relative, type) {
        const file = path.join(store, relative),
          info = await lstat(file);
        if (
          info.dev !== base.dev ||
          info.uid !== base.uid ||
          info.gid !== base.gid ||
          info.mode & 0o002 ||
          info.isSymbolicLink() ||
          !(type === "directory" ? info.isDirectory() : info.isFile()) ||
          (info.isFile() && info.nlink !== 1)
        )
          throw unavailable(
            "a generated path is linked, mounted, foreign or not ordinary",
          );
        const previous = snapshots.get(relative);
        if (previous && !unchanged(previous, identity(info)))
          throw unavailable("retained files changed during inspection");
        if (!previous) {
          if (++entries > 1000000)
            throw unavailable("retained inventory exceeds its entry limit");
          observedBytes += info.size;
          if (!Number.isSafeInteger(observedBytes) || observedBytes > 1024 ** 4)
            throw unavailable("retained inventory exceeds its byte limit");
        }
        snapshots.set(relative, identity(info));
        return info;
      }
      async function json(relative, maximum) {
        const info = await entry(relative, "file"),
          bytes = await readReleaseFile(
            path.join(store, relative),
            info,
            maximum,
          );
        let value;
        try {
          value = JSON.parse(bytes.toString());
        } catch {
          throw unavailable("invalid retained metadata");
        }
        return { value, sha256: digest(bytes), bytes: info.size };
      }
      async function tree(
        relative,
        depth = 0,
        total = { bytes: 0, lastUse: 0 },
      ) {
        if (depth > 128)
          throw unavailable("retained directory depth exceeds its limit");
        const directory = await entry(relative, "directory");
        total.bytes += directory.size;
        total.lastUse = Math.max(
          total.lastUse,
          directory.mtimeMs,
          directory.ctimeMs,
        );
        for (const name of await names(path.join(store, relative))) {
          const child = `${relative}/${name}`,
            info = await lstat(path.join(store, child));
          if (info.isDirectory()) await tree(child, depth + 1, total);
          else {
            const file = await entry(child, "file");
            total.bytes += file.size;
            total.lastUse = Math.max(total.lastUse, file.mtimeMs, file.ctimeMs);
          }
        }
        return total;
      }
      for (const name of ["releases", "transactions", "immutable"])
        await entry(name, "directory");
      const rootEntries = await names(store);
      if (
        rootEntries.some((name) => name.startsWith(".activation-lock.recovery"))
      )
        throw unavailable("release recovery is unfinished");
      let binding = null;
      if (rootEntries.includes("client-destination.json"))
        binding = validateClientDestination(
          (await json("client-destination.json", 16384)).value,
        );
      if (
        binding
          ? binding.projectId !== projectId ||
            scope !== `client:${binding.destinationId}` ||
            binding.origin !== origin
          : scope.startsWith("client:")
      )
        throw unavailable(
          "store binding does not match the configured destination",
        );
      await entry("active.conf", "file");
      const selected = await readReleaseSelection(store);
      if (!selected) throw unavailable("the store has no selected release");
      const releaseNames = await names(path.join(store, "releases"));
      if (
        releaseNames.length > 10000 ||
        releaseNames.some((name) => !idPattern.test(name))
      )
        throw unavailable("unknown retained release directories");
      const releases = [],
        byId = new Map(),
        immutable = new Map();
      for (const id of releaseNames) {
        const directory = `releases/${id}`;
        const observation = await tree(directory);
        if (
          (await names(path.join(store, directory))).join(",") !==
          "redirects.conf,release.json,site"
        )
          throw unavailable("unexpected retained release contents");
        const metadata = await json(
          `${directory}/release.json`,
          64 * 1024 ** 2,
        );
        const manifest = await verifyRelease(store, id);
        if (JSON.stringify(manifest) !== JSON.stringify(metadata.value))
          throw unavailable("the retained manifest changed during inspection");
        const createdAt = timestamp(manifest.createdAt);
        const bytes = observation.bytes,
          lastUse = Math.max(createdAt, observation.lastUse);
        const release = {
          id,
          manifest,
          manifestSha256: metadata.sha256,
          bytes,
          createdAt,
          lastUse,
          identity: snapshots.get(directory),
          reasons: new Set(),
        };
        releases.push(release);
        byId.set(id, release);
        for (const file of manifest.files) {
          if (
            !file.path.startsWith("_astro/") &&
            !(binding && file.path.startsWith("assets/"))
          )
            continue;
          const references = immutable.get(file.path) || [];
          references.push({
            artifactId: id,
            sha256: file.sha256,
            bytes: file.size,
          });
          immutable.set(file.path, references);
        }
      }
      const journals = [];
      for (const name of await names(path.join(store, "transactions"))) {
        if (!name.endsWith(".json") || !uuidPattern.test(name.slice(0, -5)))
          throw unavailable("unknown or incomplete activation journal");
        journals.push(
          transaction(
            (await json(`transactions/${name}`, 1024 ** 2)).value,
            name,
          ),
        );
      }
      const protect = (id, reason) => {
        if (!byId.has(id))
          throw unavailable("a serving or recoverable release is missing");
        byId.get(id).reasons.add(reason);
      };
      protect(selected.id, "selected");
      for (const journal of journals) {
        const ids = [
          journal.releaseId,
          journal.previousReleaseId,
          journal.previousSelectedReleaseId,
        ].filter(Boolean);
        for (const id of ids) {
          const release = byId.get(id);
          if (release)
            release.lastUse = Math.max(release.lastUse, journal.lastUse);
          if (!terminal.has(journal.status)) protect(id, "recovery");
          // A failed attempt may have switched before an uncertain write. Retain
          // recent source and destination files even for terminal failures.
          if (now - journal.lastUse < selectedPolicy.visitorGraceDays * day)
            protect(id, "visitor-grace");
        }
      }
      // Preserve the latest known good baseline for the selected artifact. A
      // reconciliation may name a separate previous selection; retain that too.
      const successful = journals
        .filter(
          (item) =>
            item.releaseId === selected.id &&
            ["live", "reconciled"].includes(item.status),
        )
        .sort((a, b) => b.lastUse - a.lastUse || b.id.localeCompare(a.id));
      const baseline = successful.find((item) => item.previousReleaseId);
      // Equal timestamps do not establish an ordering. Keep all possible
      // baselines at that boundary rather than using a random journal UUID.
      for (const item of successful) {
        if (item.previousReleaseId && item.lastUse === baseline?.lastUse)
          protect(item.previousReleaseId, "rollback");
        if (
          item.previousSelectedReleaseId &&
          item.lastUse === successful[0]?.lastUse
        )
          protect(item.previousSelectedReleaseId, "rollback");
      }
      for (const release of [...releases]
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        .slice(0, selectedPolicy.keepCount))
        release.reasons.add("minimum-count");
      for (const release of releases)
        if (now - release.lastUse < selectedPolicy.minAgeDays * day)
          release.reasons.add("minimum-age");
      // active.conf is a selection, not proof of what the web server still serves.
      await (adapters.checkLive || checkLive)(
        origin,
        byId.get(selected.id).manifest,
      );
      const candidates = [],
        recovery = [];
      for (const release of releases) {
        if (release.reasons.size) continue;
        const response = await connection.rpc(
          "builder_release_retention_observe",
          {
            target: projectId,
            release_scope: scope,
            artifact: release.id,
            worker: workerId,
            fingerprint: storeFingerprint,
            manifest: release.manifestSha256,
            stored_bytes: release.bytes,
          },
        );
        if (response?.artifact_id !== release.id)
          throw unavailable(
            "retirement observation belongs to another artifact",
          );
        if (response.phase === "protected") {
          release.reasons.add("publication");
          continue;
        }
        if (
          !response ||
          !["pending", "removing"].includes(response.phase) ||
          response.project_id !== projectId ||
          response.scope !== scope ||
          response.worker_id !== workerId ||
          response.store_fingerprint !== storeFingerprint ||
          response.manifest_sha256 !== release.manifestSha256 ||
          response.bytes !== release.bytes ||
          !Number.isSafeInteger(response.attempt_generation) ||
          response.attempt_generation < 0 ||
          response.attempt_generation > 2147483647
        )
          throw unavailable(
            "retirement identity differs or the files were already retired",
          );
        if (
          response.phase === "pending"
            ? response.owner_token !== null
            : !uuidPattern.test(response.owner_token)
        )
          throw unavailable("invalid retirement ownership receipt");
        timestamp(response.eligible_at);
        const result = {
          artifactId: release.id,
          manifestSha256: release.manifestSha256,
          bytes: release.bytes,
          identity: release.identity,
          lastUse: new Date(release.lastUse).toISOString(),
          receipt: response,
        };
        if (response.phase === "removing") recovery.push(result);
        else candidates.push(result);
      }
      // A delayed provider reply must not return eligibility for changed files.
      for (const [relative, recorded] of snapshots)
        if (
          !unchanged(
            recorded,
            identity(await lstat(path.join(store, relative))),
          )
        )
          throw unavailable("retained files changed during inspection");
      const finalRoot = await lstat(store);
      if (
        (await realpath(store)) !== store ||
        finalRoot.dev !== base.dev ||
        finalRoot.ino !== base.ino ||
        finalRoot.uid !== base.uid ||
        finalRoot.gid !== base.gid ||
        finalRoot.mode !== base.mode
      )
        throw unavailable(
          "the release store identity changed during inspection",
        );
      const storage = await measureReleaseStorage(store);
      await verifyReleaseMounts(store);
      const result = {
        schemaVersion: 1,
        projectId,
        scope,
        workerId,
        storeFingerprint,
        storeIdentity,
        inspectedAt: new Date(now).toISOString(),
        selectedArtifactId: selected.id,
        retention: selectedPolicy,
        storage: { ...storage, freeBytes: storage.freeBytes.toString() },
        candidates,
        recovery,
        retained: releases
          .filter((item) => item.reasons.size)
          .map((item) => ({
            artifactId: item.id,
            reasons: [...item.reasons].sort(),
          })),
        immutableReferences: [...immutable].map(([relative, references]) => ({
          path: relative,
          references,
        })),
        releaseIds: releases.map((item) => item.id),
        journals: journals.map((item) => ({
          id: item.id,
          status: item.status,
          lastUse: item.lastUse,
          releaseIds: [
            item.releaseId,
            item.previousReleaseId,
            item.previousSelectedReleaseId,
          ].filter(Boolean),
        })),
        ignoredEntries: rootEntries.filter(
          (name) =>
            ![
              "releases",
              "transactions",
              "immutable",
              "active.conf",
              "client-destination.json",
              ".activation-lock",
            ].includes(name),
        ),
      };
      lastSnapshots = snapshots;
      assertOpen();
      lastPlan = result;
      lastCandidates = new Map(
        [...result.candidates, ...result.recovery].map((candidate) => [
          candidate,
          JSON.stringify(candidate),
        ]),
      );
      return result;
    };
    const assertUnchanged = async () => {
      assertOpen();
      if (!lastSnapshots)
        throw unavailable("inspect the store before using its files");
      const root = await lstat(store);
      if (
        (await realpath(store)) !== store ||
        !["dev", "ino", "uid", "gid", "mode"].every(
          (key) => root[key] === base[key],
        )
      )
        throw unavailable("the store changed after inspection");
      await verifyReleaseMounts(store);
      for (const [relative, recorded] of lastSnapshots)
        if (
          !unchanged(
            recorded,
            identity(await lstat(path.join(store, relative))),
          )
        )
          throw unavailable("retained files changed after inspection");
    };
    const capture = async (candidate) => {
      assertOpen();
      if (
        !lastPlan ||
        lastCandidates.get(candidate) !== JSON.stringify(candidate)
      )
        throw unavailable("the candidate is not from this locked inspection");
      await assertUnchanged();
      const prefix = `releases/${candidate.artifactId}`;
      return [...lastSnapshots]
        .filter(
          ([relative]) =>
            relative === prefix || relative.startsWith(prefix + "/"),
        )
        .map(([relative, info]) => ({
          path: relative === prefix ? "" : relative.slice(prefix.length + 1),
          type: (info.mode & 0o170000) === 0o040000 ? "directory" : "file",
          identity: { ...info },
        }));
    };
    // This protection read deliberately does not traverse the claimed target:
    // an interrupted owned removal may already have removed its manifest.
    const guardRecovery = async (artifactId) => {
      assertOpen();
      if (!idPattern.test(artifactId))
        throw unavailable("invalid recovery artifact");
      const controls = new Map();
      const control = async (
        relative,
        directory = false,
        maximum = 1024 ** 2,
      ) => {
        const file = path.join(store, relative),
          info = await lstat(file);
        if (
          (await realpath(file)) !== file ||
          info.dev !== base.dev ||
          info.uid !== base.uid ||
          info.gid !== base.gid ||
          info.mode & 0o002 ||
          !(directory ? info.isDirectory() : info.isFile()) ||
          (!directory && info.nlink !== 1)
        )
          throw unavailable("recovery control files are unsafe");
        controls.set(relative, identity(info));
        return directory ? null : readReleaseFile(file, info, maximum);
      };
      if (
        (await names(store)).some((name) =>
          name.startsWith(".activation-lock.recovery"),
        )
      )
        throw unavailable("release recovery is unfinished");
      const bindingFile = path.join(store, "client-destination.json");
      const hasClient = await lstat(bindingFile).then(
        () => true,
        (error) => {
          if (error.code !== "ENOENT") throw error;
          return false;
        },
      );
      if (hasClient) {
        const binding = validateClientDestination(
          JSON.parse(
            (await control("client-destination.json", false, 16384)).toString(),
          ),
        );
        if (
          binding.projectId !== projectId ||
          scope !== `client:${binding.destinationId}` ||
          binding.origin !== origin
        )
          throw unavailable("the configured destination changed");
      } else if (scope.startsWith("client:"))
        throw unavailable("the destination binding is missing");
      await control("active.conf", false, 16384);
      const selected = await readReleaseSelection(store);
      if (!selected) throw unavailable("the selected release is missing");
      await control("transactions", true);
      const journals = [];
      for (const name of await names(path.join(store, "transactions"))) {
        if (!name.endsWith(".json") || !uuidPattern.test(name.slice(0, -5)))
          throw unavailable("unknown activation recovery journal");
        let value;
        try {
          value = JSON.parse(
            (await control(`transactions/${name}`)).toString(),
          );
        } catch {
          throw unavailable("invalid activation recovery journal");
        }
        journals.push(transaction(value, name));
      }
      const protectedIds = new Set([selected.id]);
      for (const item of journals) {
        if (
          !terminal.has(item.status) ||
          now - item.lastUse < selectedPolicy.visitorGraceDays * day
        )
          for (const id of [
            item.releaseId,
            item.previousReleaseId,
            item.previousSelectedReleaseId,
          ].filter(Boolean))
            protectedIds.add(id);
      }
      const successful = journals
        .filter(
          (item) =>
            item.releaseId === selected.id &&
            ["live", "reconciled"].includes(item.status),
        )
        .sort((a, b) => b.lastUse - a.lastUse || b.id.localeCompare(a.id));
      const baseline = successful.find((item) => item.previousReleaseId);
      for (const item of successful) {
        if (item.previousReleaseId && item.lastUse === baseline?.lastUse)
          protectedIds.add(item.previousReleaseId);
        if (
          item.previousSelectedReleaseId &&
          item.lastUse === successful[0]?.lastUse
        )
          protectedIds.add(item.previousSelectedReleaseId);
      }
      if (protectedIds.has(artifactId))
        throw unavailable(
          "a serving, rollback or recovery release is protected",
        );
      let manifest;
      for (const id of protectedIds) {
        await control(`releases/${id}/release.json`, false, 64 * 1024 ** 2);
        const current = await verifyRelease(store, id);
        if (id === selected.id) manifest = current;
      }
      await (adapters.checkLive || checkLive)(origin, manifest);
      const guard = async () => {
        assertOpen();
        const root = await lstat(store);
        if (
          (await realpath(store)) !== store ||
          !["dev", "ino", "uid", "gid", "mode"].every(
            (key) => root[key] === base[key],
          )
        )
          throw unavailable("the release store changed during recovery");
        await verifyReleaseMounts(store);
        for (const [relative, recorded] of controls)
          if (
            !unchanged(
              recorded,
              identity(await lstat(path.join(store, relative))),
            )
          )
            throw unavailable(
              "serving or recovery controls changed during retirement",
            );
      };
      await guard();
      return guard;
    };
    // Generated state whose every writer holds this lock, so a leftover entry is
    // abandoned. Nothing is reclaimed while a retirement attempt is unfinished:
    // its partial manifest no longer lists immutable files it may still need.
    const reclaimGenerated = async (adapters = {}) => {
      assertOpen();
      const saved = await new ReleaseRetirementState(store).peek();
      if (saved?.attempt) return null;
      const plan = await inspect();
      lastPlan = null;
      lastCandidates = new Map();
      const floor =
        Math.max(selectedPolicy.minAgeDays, selectedPolicy.visitorGraceDays) *
        day;
      const scan = { entries: generatedLimits.scanEntries },
        targets = [];
      const add = (category, entries) => targets.push({ category, entries });
      for (const name of plan.ignoredEntries)
        if (stagingPattern.test(name))
          add("staging", await inventoryGeneratedTree(store, name, scan));
      if (saved)
        for (const directory of [".retirement", ".retirement/retired"])
          for (const name of await names(path.join(store, directory))) {
            if (!/^\.write-[a-f0-9-]{36}\.tmp$/.test(name)) continue;
            const info = await lstat(path.join(store, directory, name));
            // A two-name record is an interrupted publication its owner repairs.
            if (!info.isFile() || info.nlink !== 1) continue;
            add(
              "records",
              await inventoryGeneratedTree(store, `${directory}/${name}`, scan),
            );
          }
      const referenced = new Set(
        plan.immutableReferences.map((item) => item.path),
      );
      const client = Boolean(
        await lstat(path.join(store, "client-destination.json")).catch(
          () => null,
        ),
      );
      for (const entry of await inventoryGeneratedTree(
        store,
        "immutable",
        scan,
      )) {
        const relative = entry.path.slice("immutable/".length);
        if (
          entry.type !== "file" ||
          !(
            relative.startsWith("_astro/") ||
            (client && relative.startsWith("assets/"))
          )
        )
          continue;
        const interrupted =
          /\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/.test(
            relative,
          );
        // Visitors with an older page open keep their assets for the grace.
        if (
          (interrupted || !referenced.has(relative)) &&
          generatedAge(entry.identity, now) >= floor
        )
          add("immutable", [entry]);
      }
      // Journals protect retained releases only; once every release a
      // finished journal names is gone, it is no longer a recovery receipt.
      const present = new Set(plan.releaseIds);
      for (const item of plan.journals)
        if (
          terminal.has(item.status) &&
          now - item.lastUse >= floor &&
          item.releaseIds.every((id) => !present.has(id))
        )
          add(
            "journals",
            await inventoryGeneratedTree(
              store,
              `transactions/${item.id}.json`,
              scan,
            ),
          );
      const summary = {
        staging: 0,
        records: 0,
        immutable: 0,
        journals: 0,
        removedEntries: 0,
        bytes: 0,
      };
      const guard = async () => {
        assertOpen();
        const root = await lstat(store);
        if (
          (await realpath(store)) !== store ||
          !["dev", "ino", "uid", "gid", "mode"].every(
            (key) => root[key] === base[key],
          )
        )
          throw unavailable("the store changed during reclamation");
      };
      for (const target of targets) {
        if (
          summary.removedEntries &&
          summary.removedEntries + target.entries.length >
            generatedLimits.removeEntries
        )
          break;
        const result = await removeGeneratedEntries(
          store,
          target.entries,
          guard,
          adapters,
        );
        summary[target.category]++;
        summary.removedEntries += result.removed;
        summary.bytes += result.bytes;
      }
      lastSnapshots = null;
      return summary;
    };
    try {
      return await work(
        Object.freeze({
          store,
          projectId,
          scope,
          workerId,
          origin,
          storeFingerprint,
          storeIdentity,
          inspect,
          capture,
          assertUnchanged,
          guardRecovery,
          reclaimGenerated,
        }),
      );
    } finally {
      alive = false;
      lastSnapshots = null;
      lastPlan = null;
    }
  });
}

export async function inspectReleaseRetention(options, adapters = {}) {
  return withReleaseRetentionStore(
    options,
    (session) => session.inspect(),
    adapters,
  );
}
