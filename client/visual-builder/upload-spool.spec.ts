import { afterEach, expect, it } from "vitest";
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { hostname, tmpdir } from "node:os";
import { Readable } from "node:stream";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { Server, Upload } from "@tus/server";
import {
  UploadSpool,
  uploadAttemptStopped,
} from "../../scripts/builder-upload-spool";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const limits = { bytes: 1024 ** 2, files: 10, freeBytes: 0 };
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
async function fixture(options = limits) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-upload-spool-"));
  roots.push(root);
  return {
    root,
    spool: await UploadSpool.create(root, options),
    id: randomUUID(),
  };
}
const upload = (id: string, size: number) =>
  new Upload({ id, size, offset: 0, metadata: { reservation: id } });
async function create(spool: UploadSpool, id: string, bytes: number) {
  await spool.reserve(id, bytes);
  await spool.withUpload(id, () => spool.store.create(upload(id, bytes)));
}

it("requires a reservation and an operation lock before accepting file bytes", async () => {
  const { spool, id } = await fixture();
  await expect(spool.store.create(upload(id, 3))).rejects.toThrow(
    "operator check",
  );
  await expect(
    spool.withUpload(id, () => spool.store.create(upload(id, 3))),
  ).rejects.toThrow("operator check");
  await spool.reserve(id, 3);
  await expect(
    spool.withUpload(id, () => spool.store.create(upload(id, 4))),
  ).rejects.toThrow("operator check");
  await spool.withUpload(id, () => spool.store.create(upload(id, 3)));
  await expect(
    spool.store.write(Readable.from(["abc"]), id, 0),
  ).rejects.toThrow("operator check");
});

it("resumes partial bytes, verifies their actual hash, and refuses incomplete or wrong files", async () => {
  const { root, spool, id } = await fixture();
  await create(spool, id, 6);
  await spool.withUpload(id, async () => {
    expect(
      await spool.store.write(Readable.from([Buffer.from("abc")]), id, 0),
    ).toBe(3);
    await expect(spool.verify(id, sha("abcdef"))).rejects.toThrow("incomplete");
    await expect(
      spool.store.write(Readable.from([Buffer.from("def")]), id, 0),
    ).rejects.toThrow("offset changed");
    expect(
      await spool.store.write(Readable.from([Buffer.from("def")]), id, 3),
    ).toBe(6);
    await expect(spool.verify(id, sha("xxxxxx"))).rejects.toThrow("checksum");
    expect(await spool.verify(id, sha("abcdef"))).toMatchObject({
      bytes: 6,
      sha256: sha("abcdef"),
    });
  });
  expect(await readFile(path.join(root, "files", id), "utf8")).toBe("abcdef");
  expect((await lstat(path.join(root, "files", id))).mode & 0o077).toBe(0);
});

it("cannot truncate an existing transfer by repeating creation", async () => {
  const { root, spool, id } = await fixture();
  await create(spool, id, 6);
  await spool.withUpload(id, async () => {
    await spool.store.write(Readable.from([Buffer.from("abc")]), id, 0);
    await expect(spool.store.create(upload(id, 6))).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect((await spool.store.getUpload(id)).offset).toBe(3);
  });
  expect(await readFile(path.join(root, "files", id), "utf8")).toBe("abc");
});

it("refuses overflow even if a caller bypasses TUS Content-Length checks", async () => {
  const { root, spool, id } = await fixture();
  await create(spool, id, 3);
  await spool.withUpload(id, async () => {
    await expect(
      spool.store.write(Readable.from([Buffer.from("abcde")]), id, 0),
    ).rejects.toThrow("reserved file size");
  });
  expect((await lstat(path.join(root, "files", id))).size).toBeLessThanOrEqual(
    3,
  );
});

it("preserves a bounded partial file after the source stream fails and allows a verified resume", async () => {
  const { spool, id } = await fixture();
  await create(spool, id, 6);
  await spool.withUpload(id, async () => {
    async function* chunks() {
      yield Buffer.from("abc");
      throw new Error("fixture disconnected");
    }
    await expect(
      spool.store.write(Readable.from(chunks()), id, 0),
    ).rejects.toThrow("fixture disconnected");
    const { offset } = await spool.store.getUpload(id);
    expect(offset).toBeLessThanOrEqual(3);
    await spool.store.write(
      Readable.from([Buffer.from("abcdef").subarray(offset)]),
      id,
      offset,
    );
    expect((await spool.verify(id, sha("abcdef"))).bytes).toBe(6);
  });
});

it("charges reservation bytes across restarts and rejects changed or released identities", async () => {
  const { root, spool, id } = await fixture({
    bytes: 65536 + 10,
    files: 2,
    freeBytes: 0,
  });
  await spool.reserve(id, 10);
  const next = await UploadSpool.create(root, {
    bytes: 65536 + 10,
    files: 2,
    freeBytes: 0,
  });
  expect(await next.reserve(id, 10)).toMatchObject({ id, bytes: 10 });
  await expect(next.reserve(id, 9)).rejects.toThrow("reservation changed");
  await expect(next.reserve(randomUUID(), 1)).rejects.toThrow(
    "storage is full",
  );
  await next.withUpload(id, () => next.release(id));
  await expect(next.reserve(id, 10)).rejects.toThrow("reservation changed");
});

it("restores TUS metadata from the reservation after creation loses its response", async () => {
  const { root, spool, id } = await fixture();
  await create(spool, id, 6);
  await spool.withUpload(id, () =>
    spool.store.write(Readable.from([Buffer.from("abc")]), id, 0),
  );
  const restored = await UploadSpool.create(root, limits);
  await restored.withUpload(id, async () => {
    expect(await restored.store.getUpload(id)).toMatchObject({
      id,
      size: 6,
      offset: 3,
      metadata: { reservation: id },
    });
    await restored.store.write(Readable.from([Buffer.from("def")]), id, 3);
    expect((await restored.verify(id, sha("abcdef"))).bytes).toBe(6);
  });
});

it("keeps recovery metadata charged until terminal cleanup explicitly forgets it", async () => {
  const { spool, id } = await fixture({
    bytes: 65536 + 10,
    files: 2,
    freeBytes: 0,
  });
  await spool.reserve(id, 10);
  await expect(spool.withUpload(id, () => spool.forget(id))).rejects.toThrow(
    "operator check",
  );
  await spool.withUpload(id, () => spool.release(id));
  await expect(spool.reserve(randomUUID(), 1)).rejects.toThrow(
    "storage is full",
  );
  await spool.withUpload(id, () => spool.forget(id));
  expect(await spool.state(id)).toBeNull();
  await spool.reserve(randomUUID(), 10);
});

it("checks reserved headroom before accepting a file and rejects invalid byte declarations", async () => {
  const { root, spool, id } = await fixture();
  for (const bytes of [0, -1, 1.5, 50 * 1024 ** 2 + 1, NaN, Infinity]) {
    await expect(spool.reserve(id, bytes)).rejects.toThrow(
      "Invalid upload file size",
    );
  }
  const { statfs } = await import("node:fs/promises");
  const disk = await statfs(root);
  const full = await UploadSpool.create(root, {
    ...limits,
    bytes: 60 * 1024 ** 2,
    freeBytes: disk.bavail * disk.bsize,
  });
  await expect(full.reserve(id, 50 * 1024 ** 2)).rejects.toThrow(
    "short of free disk space",
  );
  expect(await spool.state(id)).toBeNull();
});

it("does not release capacity before both file and TUS metadata removal succeed", async () => {
  const { root, spool, id } = await fixture({
    bytes: 1024 ** 2,
    files: 1,
    freeBytes: 0,
  });
  await create(spool, id, 3);
  const remove = spool.store.configstore.delete.bind(spool.store.configstore);
  spool.store.configstore.delete = async () => {
    throw new Error("fixture metadata removal failed");
  };
  await expect(spool.withUpload(id, () => spool.release(id))).rejects.toThrow(
    "fixture metadata removal failed",
  );
  expect((await spool.state(id)).released).toBe(false);
  await expect(spool.reserve(randomUUID(), 3)).rejects.toThrow(
    "storage is full",
  );
  spool.store.configstore.delete = remove;
  await spool.withUpload(id, () => spool.release(id));
  await expect(lstat(path.join(root, "files", id))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect((await spool.state(id)).released).toBe(true);
  await spool.reserve(randomUUID(), 3);
});

it("excludes competing service instances for the whole upload operation", async () => {
  const { root, spool, id } = await fixture();
  const other = await UploadSpool.create(root, limits);
  await spool.withUpload(id, async () => {
    await expect(spool.withUpload(id, async () => {})).rejects.toThrow(
      "already being processed",
    );
    await expect(other.withUpload(id, async () => {})).rejects.toThrow(
      "recovery guard",
    );
  });
  await other.withUpload(id, async () => {});
});

it("cannot replace a live or foreign-host owner and permits a proven stopped process", async () => {
  const { spool, id } = await fixture();
  await spool.reserve(id, 3);
  const current = {
    token: randomUUID(),
    pid: process.pid,
    host: hostname(),
    receipt: null,
  };
  await spool.withUpload(id, async () => {
    await spool.setAttempt(id, current);
    await expect(
      spool.setAttempt(id, { ...current, token: randomUUID() }),
    ).rejects.toThrow("already being processed");
    await spool.setAttempt(id, { ...current, receipt: { verified: true } });
  });
  expect(uploadAttemptStopped({ ...current, host: "another-host" })).toBe(
    false,
  );
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
    stdio: "ignore",
  });
  await once(child, "exit");
  const stopped = { ...current, pid: child.pid };
  expect(uploadAttemptStopped(stopped)).toBe(true);
  const recoveredId = randomUUID();
  await spool.reserve(recoveredId, 3);
  await spool.withUpload(id, async () => {
    await expect(spool.setAttempt(id, stopped)).rejects.toThrow(
      "operator check",
    );
  });
  await spool.withUpload(recoveredId, async () => {
    await spool.setAttempt(recoveredId, stopped);
    await spool.setAttempt(recoveredId, { ...current, token: randomUUID() });
  });
});

it("rejects symlink and hardlink substitution without changing the referenced file", async () => {
  const { root, spool, id } = await fixture();
  await spool.reserve(id, 3);
  const outside = path.join(root, "original");
  await writeFile(outside, "abc", { mode: 0o600 });
  await symlink(outside, path.join(root, "files", id));
  await expect(spool.inspect(id)).rejects.toThrow("operator check");
  await rm(path.join(root, "files", id));
  await link(outside, path.join(root, "files", id));
  await expect(spool.withUpload(id, () => spool.release(id))).rejects.toThrow(
    "operator check",
  );
  expect(await readFile(outside, "utf8")).toBe("abc");
});

it("refuses private state or directories made readable by other users", async () => {
  const { root, spool, id } = await fixture();
  await spool.reserve(id, 3);
  await chmod(path.join(root, "states", `${id}.json`), 0o644);
  await expect(spool.state(id)).rejects.toThrow();
  await chmod(root, 0o755);
  await expect(UploadSpool.create(root, limits)).rejects.toThrow();
});

it("bounds reservations independently of byte size and refuses deferred lengths or direct termination", async () => {
  const { spool, id } = await fixture({ ...limits, files: 1 });
  await spool.reserve(id, 1);
  await expect(spool.reserve(randomUUID(), 1)).rejects.toThrow(
    "storage is full",
  );
  await expect(spool.store.declareUploadLength(id, 100)).rejects.toThrow(
    "before uploading",
  );
  await expect(spool.store.remove(id)).rejects.toThrow("Cancel the import");
  await expect(spool.reserve("../outside", 3)).rejects.toThrow(
    "Invalid upload",
  );
});

it("uses the reserved file store through real TUS HTTP creation, interruption, resume and overflow refusal", async () => {
  const { spool, id } = await fixture();
  await spool.reserve(id, 6);
  const tus = new Server({
    path: "/uploads",
    datastore: spool.store,
    namingFunction: () => id,
    relativeLocation: true,
    maxSize: 6,
    allowedOrigins: [],
    onResponseError: (_req, error: any) => ({
      status_code: error.status || error.status_code || 500,
      body: "Upload refused.",
    }),
  });
  const server = createServer(async (req, res) => {
    try {
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        ...(["GET", "HEAD"].includes(req.method)
          ? {}
          : { body: Readable.toWeb(req), duplex: "half" }),
      } as RequestInit);
      // Generate the response under the lock; send it only after lock cleanup.
      // A client's next PATCH then cannot race the previous POST's unlock.
      const result = await spool.withUpload(id, () => tus.handleWeb(request));
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      res.writeHead(409).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/uploads`;
  const headers = { "Tus-Resumable": "1.0.0" };
  try {
    const created = await fetch(base, {
      method: "POST",
      headers: {
        ...headers,
        "Upload-Length": "6",
        "Upload-Metadata": `reservation ${Buffer.from(id).toString("base64")}`,
      },
    });
    expect(created.status).toBe(201);
    expect(created.headers.get("location")).toBe(`/uploads/${id}`);
    const patch = (offset: number, body: string) =>
      fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
        },
        body,
      });
    expect((await patch(0, "abc")).status).toBe(204);
    const resumed = await fetch(`${base}/${id}`, { method: "HEAD", headers });
    expect(resumed.headers.get("upload-offset")).toBe("3");
    expect((await patch(3, "defg")).status).toBe(413);
    expect((await patch(3, "def")).status).toBe(204);
    await spool.withUpload(id, () => spool.verify(id, sha("abcdef")));
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
});
