import { afterEach, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  uploadStorageProvider,
  type UploadObject,
} from "../../scripts/builder-upload-provider";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-upload-provider-"));
  roots.push(root);
  const file = path.join(root, "file");
  await writeFile(file, "fixture bytes", { mode: 0o600 });
  const item: UploadObject = {
    id: randomUUID(),
    project_id: randomUUID(),
    asset_id: randomUUID(),
    bucket_id: "builder-project-files",
    object_name: "",
    bytes: 13,
    sha256: sha("fixture bytes"),
    mime: "image/png",
  };
  item.object_name = `${item.project_id}/${item.asset_id}`;
  const state = {
    bytes: null as Buffer | null,
    version: "version-one",
    etag: "etag-one",
    calls: [] as { method: string; route: string; headers: Headers }[],
    loseWriteReply: false,
    leaveAfterDelete: false,
    changeAfterRead: false,
    oversizedStream: false,
    replaceBeforeDelete: false,
    mime: "image/png",
  };
  const missing = () =>
    json({ code: "NoSuchKey", message: "Object not found" }, 400);
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)),
      method = init?.method || "GET",
      headers = new Headers(init?.headers);
    state.calls.push({ method, route: url.pathname + url.search, headers });
    expect(url.origin).toBe("https://fixture.supabase.co");
    expect(headers.get("authorization")).toBe("Bearer fixture-private-key");
    expect(headers.get("apikey")).toBe("fixture-private-key");
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    if (
      url.pathname ===
      `/storage/v1/object/info/${item.bucket_id}/${item.object_name.split("/").map(encodeURIComponent).join("/")}`
    ) {
      if (!state.bytes) return missing();
      return json({
        name: item.object_name,
        bucket_id: item.bucket_id,
        size: state.bytes.length,
        version: state.version,
        etag: state.etag,
      });
    }
    expect(url.pathname).toBe(
      `/storage/v1/object/${item.bucket_id}/${item.object_name.split("/").map(encodeURIComponent).join("/")}`,
    );
    if (method === "POST") {
      expect(headers.get("x-upsert")).toBe("false");
      expect(headers.get("content-length")).toBe(String(item.bytes));
      const parts: Buffer[] = [];
      for await (const chunk of init.body as any)
        parts.push(Buffer.from(chunk));
      state.bytes = Buffer.concat(parts);
      if (state.loseWriteReply)
        throw new Error("fixture uncertain write with private server details");
      return json({ Key: `${item.bucket_id}/${item.object_name}` });
    }
    if (method === "DELETE") {
      if (state.replaceBeforeDelete) {
        state.version = "replacement";
        state.bytes = Buffer.from("another bytes");
      }
      if (url.searchParams.get("versionId") !== state.version) return missing();
      if (!state.leaveAfterDelete) state.bytes = null;
      return json({ message: "Successfully deleted" });
    }
    if (!state.bytes) return missing();
    expect(url.searchParams.get("versionId")).toBe(state.version);
    expect(url.searchParams.get("cacheNonce")).toBeTruthy();
    const bytes = state.oversizedStream
      ? Buffer.concat([state.bytes, Buffer.from("overflow")])
      : state.bytes;
    if (state.changeAfterRead) state.version = "changed-during-read";
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      { headers: { "content-type": state.mime } },
    );
  };
  const provider = uploadStorageProvider({
    url: "https://fixture.supabase.co",
    serviceKey: "fixture-private-key",
    fetch: transport,
  });
  return { root, file, item, state, transport, provider };
}

it("uploads a private verified file without overwrite and verifies actual provider bytes", async () => {
  const { provider, item, file, state } = await fixture();
  expect(await provider.ensure(item, file)).toEqual({
    bytes: 13,
    sha256: item.sha256,
    version: "version-one",
    etag: "etag-one",
  });
  expect(state.bytes?.toString()).toBe("fixture bytes");
  expect(state.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  await provider.ensure(item, file);
  expect(state.calls.filter((call) => call.method === "POST")).toHaveLength(1);
});

it("recovers a successful write with a lost reply by inspecting and hashing rather than reuploading", async () => {
  const { provider, item, file, state } = await fixture();
  state.loseWriteReply = true;
  await expect(provider.ensure(item, file)).rejects.toThrow(
    "could not verify file storage",
  );
  expect(state.bytes?.toString()).toBe("fixture bytes");
  expect((await provider.ensure(item, file)).sha256).toBe(item.sha256);
  expect(state.calls.filter((call) => call.method === "POST")).toHaveLength(1);
});

it("refuses unexpected existing bytes and does not overwrite or remove them", async () => {
  const { provider, item, file, state } = await fixture();
  state.bytes = Buffer.from("another bytes");
  await expect(provider.ensure(item, file)).rejects.toThrow("original file");
  await expect(provider.remove(item)).rejects.toThrow("original file");
  expect(
    state.calls.some((call) => ["POST", "DELETE"].includes(call.method)),
  ).toBe(false);
  expect(state.bytes.toString()).toBe("another bytes");
});

it("requires matching local bytes before beginning a provider write", async () => {
  const { provider, item, file, state } = await fixture();
  await writeFile(file, "another bytes");
  await expect(provider.ensure(item, file)).rejects.toThrow("original file");
  expect(state.calls.some((call) => call.method === "POST")).toBe(false);
});

it("detects a replaced provider version between download and readback", async () => {
  const { provider, item, state } = await fixture();
  state.bytes = Buffer.from("fixture bytes");
  state.changeAfterRead = true;
  await expect(provider.verify(item)).rejects.toThrow("original file");
});

it("bounds actual downloaded bytes even when Content-Length is missing", async () => {
  const { provider, item, state } = await fixture();
  state.bytes = Buffer.from("fixture bytes");
  state.oversizedStream = true;
  await expect(provider.verify(item)).rejects.toThrow("original file");
});

it("removes only the verified version and confirms provider absence", async () => {
  const { provider, item, state } = await fixture();
  state.bytes = Buffer.from("fixture bytes");
  await provider.remove(item);
  expect(state.bytes).toBeNull();
  expect(state.calls.find((call) => call.method === "DELETE").route).toContain(
    "versionId=version-one",
  );
  await provider.remove(item);
  expect(state.calls.filter((call) => call.method === "DELETE")).toHaveLength(
    1,
  );
});

it("does not acknowledge cleanup when the provider retains data despite a success response", async () => {
  const { provider, item, state } = await fixture();
  state.bytes = Buffer.from("fixture bytes");
  state.leaveAfterDelete = true;
  await expect(provider.remove(item)).rejects.toThrow("original file");
  expect(state.bytes).not.toBeNull();
});

it("keeps a replacement version when it appears just before deletion", async () => {
  const { provider, item, state } = await fixture();
  state.bytes = Buffer.from("fixture bytes");
  state.replaceBeforeDelete = true;
  await expect(provider.remove(item)).rejects.toThrow("original file");
  expect(state.bytes?.toString()).toBe("another bytes");
  expect(state.version).toBe("replacement");
});

it("does not confuse a missing bucket or arbitrary HTTP 404 with verified object absence", async () => {
  const { item } = await fixture();
  for (const value of [{ code: "NoSuchBucket" }, { error: "not found" }]) {
    const provider = uploadStorageProvider({
      url: "https://fixture.supabase.co",
      serviceKey: "fixture-private-key",
      fetch: async () => json(value, 404),
    });
    await expect(provider.inspect(item)).rejects.toThrow(
      "could not verify file storage",
    );
    await expect(provider.remove(item)).rejects.toThrow(
      "could not verify file storage",
    );
  }
});

it("rejects malformed metadata and bounded-response overflow without echoing provider data", async () => {
  const { item } = await fixture();
  for (const value of [
    { version: "missing-size" },
    {
      name: item.object_name,
      bucket_id: item.bucket_id,
      size: "13",
      version: "v",
      etag: "e",
    },
    "private-provider-value".repeat(2000),
  ]) {
    const provider = uploadStorageProvider({
      url: "https://fixture.supabase.co",
      serviceKey: "fixture-private-key",
      fetch: async () => json(value),
    });
    await expect(provider.inspect(item)).rejects.toThrow(
      "could not verify file storage",
    );
  }
});

it("refuses cross-project or arbitrary object paths before sending credentials", async () => {
  const { provider, item, file, state } = await fixture();
  for (const change of [
    { object_name: "../outside" },
    { bucket_id: "other" },
    { project_id: "kaizen" },
    { bytes: 0 },
    { bytes: -1 },
    { mime: "text/plain\r\nX-Injected: yes" },
  ]) {
    await expect(
      provider.ensure({ ...item, ...change }, file),
    ).rejects.toThrow();
  }
  expect(state.calls).toHaveLength(0);
});

it("rejects non-HTTPS or credential-bearing provider configuration", () => {
  for (const url of [
    "http://fixture.supabase.co",
    "https://person:password@fixture.supabase.co",
    "https://fixture.supabase.co/other",
    "https://fixture.supabase.co?token=private",
  ]) {
    expect(() =>
      uploadStorageProvider({ url, serviceKey: "fixture-private-key" }),
    ).toThrow("could not verify file storage");
  }
});

it("verifies and removes an empty legacy object while refusing new empty uploads", async () => {
  const { provider, item, state, file } = await fixture();
  item.bytes = 0;
  item.sha256 = sha("");
  state.bytes = Buffer.alloc(0);
  await expect(provider.ensure(item, file)).rejects.toThrow();
  expect(state.calls).toHaveLength(0);
  expect(await provider.verify(item)).toMatchObject({
    bytes: 0,
    sha256: sha(""),
  });
  await provider.remove(item);
  expect(state.bytes).toBeNull();
  expect(state.calls.filter((call) => call.method === "DELETE")).toHaveLength(
    1,
  );
});

it("measures actual unknown bytes and MIME without granting write authority", async () => {
  const { provider, item, state, file } = await fixture();
  state.bytes = Buffer.from("another bytes");
  state.mime = "application/pdf";
  const probe = { ...item, object_scope: "orphan" as const };
  expect(await provider.measure(probe)).toEqual({
    bytes: 13,
    sha256: sha("another bytes"),
    mime: "application/pdf",
    version: "version-one",
    etag: "etag-one",
  });
  await expect(provider.ensure(probe, file)).rejects.toThrow();
  expect(state.calls.every((call) => call.method === "GET")).toBe(true);
});

it("encodes legacy object names and removes only the observed exact key", async () => {
  const { provider, item, state } = await fixture();
  item.object_scope = "orphan";
  item.object_name = `${item.project_id}/old folder/café #?%2e%2e\\photo.png`;
  state.bytes = Buffer.from("fixture bytes");
  const measured = await provider.measure({ ...item, object_scope: "orphan" });
  expect(measured?.sha256).toBe(item.sha256);
  await provider.remove(item);
  expect(state.bytes).toBeNull();
  const deleted = state.calls.find((call) => call.method === "DELETE");
  expect(deleted?.route).toContain(
    "old%20folder/caf%C3%A9%20%23%3F%252e%252e%5Cphoto.png",
  );
});

it("returns null only for confirmed absence during discovery, including empty actual files", async () => {
  const { provider, item, state } = await fixture();
  const probe = { ...item, object_scope: "orphan" as const };
  expect(await provider.measure(probe)).toBeNull();
  state.bytes = Buffer.alloc(0);
  expect(await provider.measure({ ...probe, bytes: 0 })).toMatchObject({
    bytes: 0,
    sha256: sha(""),
  });
  for (const body of [{ code: "NoSuchBucket" }, { message: "not found" }]) {
    const unavailable = uploadStorageProvider({
      url: "https://fixture.supabase.co",
      serviceKey: "fixture-private-key",
      fetch: async () => json(body, 404),
    });
    await expect(unavailable.measure(probe)).rejects.toThrow();
  }
});

it("rejects oversized or changed discovery reads and unusable MIME without deleting", async () => {
  const { provider, item, state } = await fixture();
  const probe = { ...item, object_scope: "orphan" as const };
  state.bytes = Buffer.from("fixture bytes");
  state.oversizedStream = true;
  await expect(provider.measure(probe)).rejects.toThrow();
  state.oversizedStream = false;
  state.changeAfterRead = true;
  await expect(provider.measure(probe)).rejects.toThrow();
  state.changeAfterRead = false;
  state.mime = "x".repeat(256);
  await expect(provider.measure(probe)).rejects.toThrow();
  expect(state.calls.every((call) => call.method === "GET")).toBe(true);
});

it("refuses cross-project, dot-segment and unbounded discovery names before any request", async () => {
  const { provider, item, state } = await fixture();
  for (const change of [
    { object_name: `${randomUUID()}/outside` },
    { object_name: `${item.project_id}/../outside` },
    { object_name: `${item.project_id}/./outside` },
    { object_name: `${item.project_id}/bad\nname` },
    { object_name: `${item.project_id}/${"x".repeat(1024)}` },
    { bucket_id: "other" },
    { object_scope: "registered" as any },
  ])
    await expect(
      provider.measure({ ...item, object_scope: "orphan", ...change }),
    ).rejects.toThrow();
  expect(state.calls).toHaveLength(0);
});
