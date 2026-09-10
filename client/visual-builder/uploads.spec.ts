import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { localUploadServer } from "../../scripts/builder-uploads";
import { assertUploadUrl, resumableUpload } from "./resumableUpload";
import type { Asset } from "../../shared/visualBuilder";

describe("resumable upload boundaries", () => {
  it("rejects saved upload addresses outside the active workspace", () => {
    const endpoint =
      "https://project.storage.supabase.co/storage/v1/upload/resumable";
    expect(assertUploadUrl(endpoint + "/123", endpoint)).toBe(
      endpoint + "/123",
    );
    for (const url of [
      "https://attacker.test/file",
      "/storage/v1/object/public/file",
      endpoint + "-other/123",
      "https://user@project.storage.supabase.co/storage/v1/upload/resumable/123",
    ])
      expect(() => assertUploadUrl(url, endpoint)).toThrow(/workspace/);
  });
  it("persists offsets across server recreation, rejects stale offsets and verifies bytes before registering a file", async () => {
    const root = path.resolve("test-results/upload-unit");
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(path.join(root, "case-"));
    let handler = localUploadServer(directory);
    const server = createServer((req, res) => void handler.handle(req, res));
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const bytes = Buffer.from("source code is stored but never executed");
    const asset: Asset = {
      id: crypto.randomUUID(),
      hash: createHash("sha256").update(bytes).digest("hex"),
      name: "source.tsx",
      path: "source.tsx",
      pack: "Test",
      mime: "application/octet-stream",
      kind: "code",
      size: bytes.length,
      url: "",
      tags: [],
      favourite: false,
      createdAt: new Date().toISOString(),
    };
    const headers = { "Tus-Resumable": "1.0.0" };
    const create = (metadata: Asset) =>
      fetch(base + "/__builder-upload", {
        method: "POST",
        headers: {
          ...headers,
          "Upload-Length": String(bytes.length),
          "Upload-Metadata": `asset ${Buffer.from(JSON.stringify(metadata)).toString("base64")}`,
        },
      });
    try {
      expect((await create({ ...asset, id: "../../outside" })).status).toBe(
        400,
      );
      const created = await create(asset);
      expect(created.status).toBe(201);
      const url = new URL(created.headers.get("Location")!, base).href;
      const patch = (offset: number, body: Buffer) =>
        fetch(url, {
          method: "PATCH",
          headers: {
            ...headers,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: new Uint8Array(body),
        });
      expect((await patch(0, bytes.subarray(0, 10))).status).toBe(204);
      await expect(handler.finish(url, asset)).rejects.toThrow(/incomplete/);
      handler = localUploadServer(directory);
      expect(
        (await fetch(url, { method: "HEAD", headers })).headers.get(
          "Upload-Offset",
        ),
      ).toBe("10");
      expect((await patch(0, bytes.subarray(10))).status).toBe(409);
      expect((await patch(10, bytes.subarray(10))).status).toBe(204);
      const complete = await handler.finish(url, asset);
      expect(complete.url).toBe(`/builder-media/${asset.id}.tsx`);
      expect(await readFile(path.join(directory, "assets", asset.id))).toEqual(
        bytes,
      );
      const recreated = { ...asset, id: crypto.randomUUID() },
        checkpoints: string[] = [];
      const recoveredUrl = await resumableUpload(bytes as unknown as Blob, {
        endpoint: base + "/__builder-upload",
        uploadUrl: base + "/__builder-upload/expired-session",
        metadata: { asset: JSON.stringify(recreated) },
        headers: async () => ({}),
        progress: () => {},
        onUploadUrl: async (url) => {
          checkpoints.push(url);
        },
      });
      expect(checkpoints).toEqual([recoveredUrl]);
      expect((await handler.finish(recoveredUrl, recreated)).hash).toBe(
        asset.hash,
      );
      expect(await handler.finish(url, asset)).toEqual(complete);
      const corrupt = {
        ...asset,
        id: crypto.randomUUID(),
        hash: "a".repeat(64),
      };
      const second = await create(corrupt),
        secondUrl = new URL(second.headers.get("Location")!, base).href;
      await fetch(secondUrl, {
        method: "PATCH",
        headers: {
          ...headers,
          "Upload-Offset": "0",
          "Content-Type": "application/offset+octet-stream",
        },
        body: bytes,
      });
      await expect(handler.finish(secondUrl, corrupt)).rejects.toThrow(
        /checksum/,
      );
      await handler.release(url);
      expect((await fetch(url, { method: "HEAD", headers })).status).toBe(404);
      expect(await readFile(path.join(directory, "assets", asset.id))).toEqual(
        bytes,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!path.resolve(directory).startsWith(root + path.sep))
        throw new Error("Unsafe test cleanup");
      await rm(directory, { recursive: true, force: true });
    }
  });
});
