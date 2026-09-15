import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { nativeWorkerConnection } from "../../scripts/builder-native-worker";
import { runReleaseWorker } from "../../scripts/builder-release-worker.mjs";

it("rejects altered native worker receipts and malformed operations before they can release protection", async () => {
  const identity = {
    id: randomUUID(),
    workerId: "fixture-release",
    configuration: "a".repeat(64),
    projectId: "kaizen",
    processId: process.pid,
    host: "fixture",
    instanceId: randomUUID(),
  };
  let calls = 0;
  const connection = nativeWorkerConnection({
    rpc: async () => {
      calls++;
      return { ...identity, id: randomUUID(), phase: "complete" };
    },
  });
  await expect(
    connection.nativeOperation("", {
      ...identity,
      action: "native-operation-end",
    }),
  ).rejects.toThrow("could not be confirmed");
  expect(calls).toBe(1);
  await expect(
    connection.nativeOperation("", {
      ...identity,
      workerId: "../other",
      action: "native-operation-begin",
    }),
  ).rejects.toThrow("Invalid native worker");
  expect(calls).toBe(1);
});

it("refuses the legacy release entry when native coordination is configured", async () => {
  let requested = false;
  await expect(
    runReleaseWorker({ BUILDER_NATIVE_WORKER_ID: "fixture-release" }, [], {
      client: {
        rpc: async () => {
          requested = true;
        },
      },
    }),
  ).rejects.toThrow("installed native release worker");
  expect(requested).toBe(false);
});
