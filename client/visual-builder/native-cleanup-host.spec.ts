import { expect, it } from "vitest";
import { runNativeCleanupBatch } from "../../scripts/builder-native-cleanup-host";

it("continues independent cleanup after a retained file and reports bounded outcomes", async () => {
  const seen: string[] = [];
  const result = await runNativeCleanupBatch(
    {
      queue: async () => ["retained", "unused"],
      run: async (id) => {
        seen.push(id);
        if (id === "retained")
          throw new Error("private provider response must not be exposed");
      },
    },
    new AbortController().signal,
  );
  expect(seen).toEqual(["retained", "unused"]);
  expect(result).toEqual({
    examined: 2,
    removed: 1,
    deferred: 1,
    stopped: false,
  });
});

it("finishes owned work on shutdown without claiming another job", async () => {
  const controller = new AbortController(),
    seen: string[] = [];
  const worker = {
    queue: async () => ["owned", "later"],
    run: async (id: string) => {
      controller.abort();
      await Promise.resolve();
      seen.push(id);
    },
  };
  expect(await runNativeCleanupBatch(worker, controller.signal)).toEqual({
    examined: 1,
    removed: 1,
    deferred: 0,
    stopped: true,
  });
  expect(seen).toEqual(["owned"]);
  expect(
    await runNativeCleanupBatch(
      {
        ...worker,
        queue: async () => {
          throw new Error("must not query");
        },
      },
      controller.signal,
    ),
  ).toEqual({ examined: 0, removed: 0, deferred: 0, stopped: true });
});

it("does not report completion when the authoritative queue is unavailable", async () => {
  await expect(
    runNativeCleanupBatch(
      {
        queue: async () => {
          throw new Error("queue unavailable");
        },
        run: async () => {
          throw new Error("must not run");
        },
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow("queue unavailable");
});
