import { expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileThroughUploadService,
  copyUploadId,
  copyUploadOrigin,
} from "../../supabase/functions/_shared/builderCopyUploads";
import type { Asset } from "../../shared/visualBuilder";

async function fixture(size = 9) {
  const bytes = new Uint8Array(size).fill(5).buffer,
    projectId = randomUUID();
  const asset = {
    id: randomUUID(),
    size,
    hash: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
    mime: "image/png",
    kind: "image",
  } as Asset;
  const id = await copyUploadId(projectId, asset.id),
    origin = "https://builder.example.test",
    address = `${origin}/editor-uploads/${id}`;
  const controls = {
    location: address,
    offset: 0,
    badReceipt: false,
    quota: false,
    hugeReceipt: false,
  };
  const fetch = vi.fn(async (input: any, init?: RequestInit) => {
    expect(new URL(input).origin).toBe(origin);
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer fixture-session",
    );
    expect(init?.redirect).toBe("error");
    if (controls.quota)
      return Response.json(
        { error: "Private provider detail" },
        { status: 429 },
      );
    if (input === `${origin}/editor-uploads`)
      return new Response(null, {
        status: 201,
        headers: { Location: controls.location },
      });
    if (init?.method === "HEAD")
      return new Response(null, {
        status: 200,
        headers: {
          "Upload-Length": String(size),
          "Upload-Offset": String(controls.offset),
        },
      });
    if (init?.method === "PATCH") {
      expect(new Headers(init.headers).get("upload-offset")).toBe(
        String(controls.offset),
      );
      const body = init.body as ArrayBuffer;
      expect(body.byteLength).toBeLessThanOrEqual(6 * 1024 ** 2);
      controls.offset += body.byteLength;
      return new Response(null, {
        status: 204,
        headers: { "Upload-Offset": String(controls.offset) },
      });
    }
    if (controls.hugeReceipt) return new Response("x".repeat(4097));
    return Response.json({
      id: controls.badReceipt ? randomUUID() : id,
      projectId,
      assetId: asset.id,
      bytes: size,
      sha256: asset.hash,
      status: "stored",
    });
  });
  const options = {
    origin,
    token: "fixture-session",
    projectId,
    asset,
    bytes,
    fetch,
  };
  return { controls, options, fetch };
}

it("resumes a verified copy in bounded chunks using the original bearer and exact final receipt", async () => {
  const api = await fixture(6 * 1024 ** 2 + 10);
  api.controls.offset = 3;
  await copyFileThroughUploadService(api.options);
  expect(api.fetch.mock.calls.map(([, init]) => init?.method)).toEqual([
    "POST",
    "HEAD",
    "PATCH",
    "PATCH",
    "POST",
  ]);
  expect(api.controls.offset).toBe(api.options.asset.size);
});

it("refuses a foreign upload address before forwarding credentials to it", async () => {
  const api = await fixture();
  api.controls.location = "https://untrusted.example.test/editor-uploads/file";
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "unexpected copy address",
  );
  expect(api.fetch).toHaveBeenCalledTimes(1);
});

it("refuses bad source bytes before any network transfer", async () => {
  const api = await fixture();
  new Uint8Array(api.options.bytes)[0] = 6;
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "source file changed",
  );
  expect(api.fetch).not.toHaveBeenCalled();
});

it("rejects an impossible resume offset without writing bytes", async () => {
  const api = await fixture();
  api.controls.offset = api.options.asset.size + 1;
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "unexpected resume offset",
  );
  expect(api.fetch).toHaveBeenCalledTimes(2);
});

it("requires the exact final identity and bounds the completion response", async () => {
  const api = await fixture();
  api.controls.badReceipt = true;
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "not been verified",
  );
  api.controls.hugeReceipt = true;
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "invalid completion",
  );
});

it("reports plan refusal without exposing provider details or continuing a transfer", async () => {
  const api = await fixture();
  api.controls.quota = true;
  await expect(copyFileThroughUploadService(api.options)).rejects.toThrow(
    "storage limit",
  );
  expect(api.fetch).toHaveBeenCalledTimes(1);
});

it("accepts only a configured HTTPS origin before copying", () => {
  for (const value of [
    undefined,
    "http://builder.example.test",
    "https://builder.example.test/path",
    "https://user:password@builder.example.test",
    "https://builder.example.test?redirect=1",
  ])
    expect(() => copyUploadOrigin(value)).toThrow("not configured");
  expect(copyUploadOrigin("https://builder.example.test")).toBe(
    "https://builder.example.test",
  );
});
