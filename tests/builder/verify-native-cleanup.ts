/** Actual root/systemd/filesystem proof with a private simulated RPC/provider.
 * The driver kills the first invocation after provider removal; the next must
 * reconcile its durable attempt through the same CLI composition. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  mkdir,
  readFile,
  readdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { nativeAssetInventory } from "../../scripts/builder-native-asset-cleanup";
import {
  readNativeCleanupInventory,
  runNativeCleanupCli,
} from "../../scripts/builder-native-cleanup-host";

assert.equal(process.getuid?.(), 0);
const stateDirectory = process.env.KAIZEN_NATIVE_CLEANUP_FIXTURE || "";
assert.match(
  stateDirectory,
  /^\/var\/lib\/kaizen-native-cleanup-check-[a-f0-9]{12}\/state$/,
);
const mode = (await readFile(path.join(stateDirectory, "mode"), "utf8")).trim();
assert.ok(["hold", "recover"].includes(mode));
const inventoryPath = process.env.BUILDER_NATIVE_CLEANUP_INVENTORY || "";
const parsed = nativeAssetInventory(
  await readNativeCleanupInventory(inventoryPath),
);
const inventory = parsed.configuration,
  fingerprint = parsed.fingerprint;
const recordPath = path.join(stateDirectory, "provider.json");
const spool = process.env.BUILDER_NATIVE_CLEANUP_DIRECTORY || "";
const bytes = Buffer.from("native cleanup fixture bytes");
const asset = "91111111-1111-4111-8111-111111111111";
const job = "92222222-2222-4222-8222-222222222222";
type RecordState = {
  phase: "pending" | "removing" | "removed";
  present: boolean;
  owner: string | null;
  pid: number | null;
  completed: string | null;
  clearance: string | null;
  acknowledged: boolean;
  scans: number;
  deletes: number;
};
let record: RecordState;
if (mode === "hold") {
  record = {
    phase: "pending",
    present: true,
    owner: null,
    pid: null,
    completed: null,
    clearance: null,
    acknowledged: false,
    scans: 0,
    deletes: 0,
  };
  await writeFile(recordPath, JSON.stringify(record), { mode: 0o600 });
  // Exercise the real root-owned loader, including trusted parent traversal.
  const config = path.join(stateDirectory, "config-check.json");
  await writeFile(config, JSON.stringify(inventory), { mode: 0o600 });
  assert.deepEqual(await readNativeCleanupInventory(config), inventory);
  await chmod(config, 0o644);
  await assert.rejects(readNativeCleanupInventory(config));
  await chmod(config, 0o600);
  const second = path.join(stateDirectory, "config-check-link.json");
  await link(config, second);
  await assert.rejects(readNativeCleanupInventory(config));
  await unlink(second);
  await symlink(config, second);
  await assert.rejects(readNativeCleanupInventory(second));
  await unlink(second);
  await writeFile(config, Buffer.alloc(262145, 32));
  await assert.rejects(readNativeCleanupInventory(config));
  await writeFile(config, JSON.stringify(inventory));
  const unsafe = path.join(stateDirectory, "untrusted-parent");
  await mkdir(unsafe, { mode: 0o700 });
  await writeFile(
    path.join(unsafe, "inventory.json"),
    JSON.stringify(inventory),
    { mode: 0o600 },
  );
  await chmod(unsafe, 0o777);
  await assert.rejects(
    readNativeCleanupInventory(path.join(unsafe, "inventory.json")),
  );
  await chmod(unsafe, 0o700);
  await assert.rejects(
    readNativeCleanupInventory(
      path.join(stateDirectory, "missing", "..", "config-check.json") +
        "/../config-check.json",
    ),
  );
  await unlink(config);
  await writeFile(
    path.join(stateDirectory, "configuration-verified"),
    "verified\n",
    { mode: 0o600 },
  );
} else {
  record = JSON.parse(await readFile(recordPath, "utf8"));
  assert.equal(record.phase, "removing");
  assert.equal(record.present, false);
  assert.equal(record.scans, 1);
  assert.equal(record.deletes, 1);
  assert.notEqual(record.pid, process.pid);
}
const save = () =>
  writeFile(recordPath, JSON.stringify(record), { mode: 0o600 });
const object = {
  id: job,
  project_id: "kaizen",
  asset_id: asset,
  bucket_id: "builder-media",
  object_name: asset,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  mime: "image/png",
  file_url: "/older-native-fixture-file.png",
  worker_id: inventory.workerId,
};
const result = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const absent = () => result({ code: "NoSuchKey" }, 404);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://native-cleanup-fixture.example.test");
  const method = init?.method || "GET";
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    assert.equal(method, "POST");
    const rpc = url.pathname.slice("/rest/v1/rpc/".length);
    const args = JSON.parse(String(init?.body));
    assert.equal(args.worker, inventory.workerId);
    if (
      [
        "builder_native_asset_cleanup_queue",
        "builder_native_cleanup_observe",
        "builder_native_cleanup_clearance",
      ].includes(rpc)
    )
      assert.equal(args.fingerprint, fingerprint);
    if (rpc === "builder_native_asset_cleanup_queue")
      return result(record.acknowledged ? [] : [job]);
    if (rpc === "builder_native_cleanup_observe") {
      record.scans++;
      await save();
      return result({
        epoch: "1",
        configuration: fingerprint,
        projects: inventory.projects,
      });
    }
    assert.equal(args.request_id, job);
    if (rpc === "builder_native_cleanup_clearance") {
      assert.equal(args.scan_epoch, "1");
      assert.match(args.inventory_hash, /^[a-f0-9]{64}$/);
      assert.equal(record.phase, "pending");
      record.clearance = args.token;
      await save();
      return result(null);
    }
    if (rpc === "builder_asset_cleanup_read")
      return result({
        ...object,
        phase: record.phase,
        owner_token: record.owner,
        completed_token: record.completed,
      });
    if (rpc === "builder_asset_cleanup_claim") {
      const saved = JSON.parse(
        await readFile(path.join(spool, "states", job + ".json"), "utf8"),
      );
      assert.equal(saved.attempt.pid, process.pid);
      assert.equal(saved.attempt.host, hostname());
      assert.equal(saved.attempt.token, args.token);
      if (record.phase === "pending") {
        assert.equal(args.token, record.clearance);
        assert.equal(args.previous_owner, null);
      } else {
        assert.equal(record.phase, "removing");
        assert.equal(args.previous_owner, record.owner);
        assert.notEqual(args.token, record.owner);
        assert.throws(
          () => process.kill(record.pid!, 0),
          (error: NodeJS.ErrnoException) => error.code === "ESRCH",
        );
      }
      record.phase = "removing";
      record.owner = args.token;
      record.pid = process.pid;
      await save();
      return result(null);
    }
    if (rpc === "builder_asset_cleanup_finish") {
      assert.equal(args.token, record.owner);
      assert.equal(record.present, false);
      assert.equal(args.verification.attemptId, record.owner);
      assert.equal(args.verification.localRemoved, true);
      assert.equal(args.verification.providerRemoved, true);
      if (mode === "hold") {
        await writeFile(
          path.join(stateDirectory, "ready-to-kill"),
          "provider removed; completion pending\n",
          { mode: 0o600 },
        );
        await new Promise((resolve) => setTimeout(resolve, 120000));
        return result({}, 503);
      }
      record.phase = "removed";
      record.completed = args.token;
      await save();
      return result(null);
    }
    if (rpc === "builder_asset_cleanup_ack") {
      assert.equal(record.phase, "removed");
      assert.equal(args.completed, record.completed);
      await assert.rejects(readFile(path.join(spool, "states", job + ".json")));
      record.acknowledged = true;
      await save();
      return result(null);
    }
    throw new Error("Unexpected fixture RPC");
  }
  const providerPath = `/storage/v1/object/builder-media/${asset}`;
  if (url.pathname === `/storage/v1/object/info/builder-media/${asset}`) {
    assert.equal(method, "GET");
    return record.present
      ? result({
          name: asset,
          bucket_id: "builder-media",
          size: bytes.length,
          version: "fixture-v1",
          etag: "fixture-etag",
        })
      : absent();
  }
  assert.equal(url.pathname, providerPath);
  assert.equal(url.searchParams.get("versionId"), "fixture-v1");
  assert.equal(record.present, true);
  if (method === "GET")
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.length),
      },
    });
  assert.equal(method, "DELETE");
  assert.equal(record.phase, "removing");
  assert.equal(record.pid, process.pid);
  record.present = false;
  record.deletes++;
  await save();
  return result({});
};

try {
  await runNativeCleanupCli();
  assert.equal(
    mode,
    "recover",
    "The driver must kill the first invocation at the completion boundary.",
  );
  assert.equal(process.exitCode || 0, 0);
  assert.equal(record.phase, "removed");
  assert.equal(record.acknowledged, true);
  assert.equal(record.present, false);
  assert.equal(
    record.scans,
    1,
    "An owned interrupted removal reuses its existing clearance.",
  );
  assert.equal(
    record.deletes,
    1,
    "The missing original version is not removed again.",
  );
  assert.deepEqual(await readdir(path.join(spool, "states")), []);
  await writeFile(path.join(stateDirectory, "recovered"), "verified\n", {
    mode: 0o600,
  });
  process.stdout.write(
    "Native cleanup CLI recovered the stopped root attempt with fixture provider evidence.\n",
  );
} finally {
  globalThis.fetch = originalFetch;
}
