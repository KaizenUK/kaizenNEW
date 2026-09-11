import { expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir, hostname } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import {
  inspectProcessLock,
  withRecoveryLock,
} from "../../scripts/release-recovery.mjs";

async function crashDuringRecovery(directory: string, jobId: string) {
  const source = `
    import { withRecoveryLock } from ${JSON.stringify(pathToFileURL(path.resolve("scripts/release-recovery.mjs")).href)};
    await withRecoveryLock(${JSON.stringify(directory)}, async () => {
      process.kill(process.pid, "SIGKILL");
      await new Promise(() => {});
    }, ${JSON.stringify(jobId)});
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (errors || (code === 0 && !signal))
        reject(new Error(errors || "Recovery child did not stop abruptly."));
      else resolve();
    });
  });
  expect((await inspectProcessLock(directory))?.stopped).toBe(true);
}

it("retries repeated actual recovery crashes while retaining stopped owners and excluding another recoverer", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-recovery-guards-"));
  const directory = path.join(root, "publication-lock"),
    jobId = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++)
    await crashDuringRecovery(directory, jobId);
  const locks = [
    directory,
    ...[1, 2, 3].map((count) => directory + ".recovery".repeat(count)),
  ];
  const owners = await Promise.all(
    locks.map((lock) => readFile(path.join(lock, "owner.json"), "utf8")),
  );
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const recovery = withRecoveryLock(
    directory,
    async () => {
      entered();
      await gate;
      expect(
        await Promise.all(
          locks.map((lock) => readFile(path.join(lock, "owner.json"), "utf8")),
        ),
      ).toEqual(owners);
      return "verified";
    },
    jobId,
  );
  await started;
  try {
    await expect(
      withRecoveryLock(
        directory,
        async () => {
          throw new Error("Must not run");
        },
        jobId,
      ),
    ).rejects.toThrow(/recovery guard/);
  } finally {
    release();
  }
  expect(await recovery).toBe("verified");
  for (const lock of [...locks, directory + ".recovery".repeat(4)])
    await expect(lstat(lock)).rejects.toMatchObject({ code: "ENOENT" });
});

it("keeps interrupted guards and original locks after failed verification and rejects wrong jobs", async () => {
  const directory = path.join(
    await mkdtemp(path.join(tmpdir(), "kaizen-recovery-guards-")),
    "lock",
  );
  const jobId = randomUUID();
  await crashDuringRecovery(directory, jobId);
  const locks = [directory, `${directory}.recovery`];
  const owners = await Promise.all(
    locks.map((lock) => readFile(path.join(lock, "owner.json"), "utf8")),
  );
  await expect(
    withRecoveryLock(directory, async () => {}, randomUUID()),
  ).rejects.toThrow(/different publication job/);
  await expect(
    withRecoveryLock(
      directory,
      async () => {
        throw new Error("Served output did not match");
      },
      jobId,
    ),
  ).rejects.toThrow(/Served output/);
  expect(
    await Promise.all(
      locks.map((lock) => readFile(path.join(lock, "owner.json"), "utf8")),
    ),
  ).toEqual(owners);
  await expect(lstat(`${directory}.recovery.recovery`)).rejects.toMatchObject({
    code: "ENOENT",
  });
  await withRecoveryLock(directory, async () => {}, jobId);
});

it("preserves live, foreign and ownerless recovery guards", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-recovery-guards-"));
  for (const [index, owner] of [
    { pid: process.pid, host: hostname() },
    { pid: 1, host: "unrelated-host.invalid" },
    null,
  ].entries()) {
    const directory = path.join(root, `lock-${index}`),
      guard = `${directory}.recovery`;
    await mkdir(guard);
    if (owner)
      await writeFile(path.join(guard, "owner.json"), JSON.stringify(owner));
    let ran = false;
    await expect(
      withRecoveryLock(directory, async () => {
        ran = true;
      }),
    ).rejects.toThrow();
    expect(ran).toBe(false);
    expect((await lstat(guard)).isDirectory()).toBe(true);
    await expect(lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
    if (owner)
      expect(
        JSON.parse(await readFile(path.join(guard, "owner.json"), "utf8")),
      ).toEqual(owner);
  }
});
