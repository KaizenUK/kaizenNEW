import { afterEach, expect, it } from "vitest";
import { once } from "node:events";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { request as httpRequest } from "node:http";
import {
  startUploadHost,
  uploadHostService,
  MAX_UPLOAD_CHUNK_BYTES,
} from "../../scripts/builder-upload-host";

const exec = promisify(execFile);
const hosts: Awaited<ReturnType<typeof startUploadHost>>[] = [];
const roots: string[] = [];
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function host(
  handle = async (_request: Request) =>
    new Response('{"ok":true}', {
      headers: { "Content-Type": "application/json" },
    }),
) {
  const result = await startUploadHost({ port: 0, service: { handle } });
  hosts.push(result);
  return result;
}

it("listens only on loopback and keeps its health probe out of browser and proxy routes", async () => {
  const service = await host();
  expect((service.server.address() as any).address).toBe("127.0.0.1");
  expect(await (await fetch(`${service.origin}/health`)).json()).toEqual({
    status: "running",
  });
  for (const headers of [
    { Origin: "https://builder.example.test" },
    { "X-Forwarded-Host": "builder.example.test" },
  ]) {
    expect((await fetch(`${service.origin}/health`, { headers })).status).toBe(
      404,
    );
  }
  // Native HTTP preserves the supplied Host header; fetch may replace it.
  const foreignHost = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      `${service.origin}/health`,
      { headers: { Host: "builder.example.test" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on("error", reject);
    request.end();
  });
  expect(foreignHost).toBe(404);
  expect((await fetch(`${service.origin}/other`)).status).toBe(404);
});

it("passes a bounded streaming chunk to the service and returns its response", async () => {
  let bytes = "";
  const service = await host(async (request) => {
    expect(request.method).toBe("PATCH");
    bytes = await request.text();
    return new Response(null, {
      status: 204,
      headers: { "Upload-Offset": String(bytes.length) },
    });
  });
  const response = await fetch(`${service.origin}/editor-uploads/fixture`, {
    method: "PATCH",
    body: "actual streamed bytes",
  });
  expect(response.status).toBe(204);
  expect(response.headers.get("upload-offset")).toBe("21");
  expect(bytes).toBe("actual streamed bytes");
});

it("refuses oversized declared chunks and bodies on creation before calling the handler", async () => {
  let calls = 0;
  const service = await host(async () => {
    calls++;
    return new Response();
  });
  expect(
    (
      await fetch(`${service.origin}/editor-uploads`, {
        method: "POST",
        body: "unexpected bytes",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await fetch(`${service.origin}/editor-uploads/id`, {
        method: "PATCH",
        body: Buffer.alloc(MAX_UPLOAD_CHUNK_BYTES + 1),
      })
    ).status,
  ).toBe(413);
  expect(calls).toBe(0);
});

it("limits actual chunked bytes even when no Content-Length header is sent", async () => {
  const service = await host(async (request) => {
    await request.arrayBuffer();
    return new Response(null, { status: 204 });
  });
  const body = Readable.toWeb(
    Readable.from([
      Buffer.alloc(MAX_UPLOAD_CHUNK_BYTES),
      Buffer.from("overflow"),
    ]),
  ) as ReadableStream<Uint8Array>;
  const response = await fetch(`${service.origin}/editor-uploads/id`, {
    method: "PATCH",
    body,
    duplex: "half",
  } as RequestInit);
  expect(response.status).toBe(413);
});

it("bounds active requests while keeping health available and drains on close", async () => {
  const waits: (() => void)[] = [];
  const service = await host(async () => {
    await new Promise<void>((resolve) => waits.push(resolve));
    return new Response("done");
  });
  const requests = Array.from({ length: 4 }, () =>
    fetch(`${service.origin}/editor-uploads`),
  );
  await expect.poll(() => waits.length).toBe(4);
  expect((await fetch(`${service.origin}/editor-uploads`)).status).toBe(503);
  expect((await fetch(`${service.origin}/health`)).status).toBe(200);
  waits.forEach((resolve) => resolve());
  expect(
    (await Promise.all(requests)).map((response) => response.status),
  ).toEqual([200, 200, 200, 200]);
});

it("does not expose thrown configuration/provider details in HTTP errors", async () => {
  const service = await host(async () => {
    throw new Error(
      "fixture private service credential and filesystem details",
    );
  });
  const response = await fetch(`${service.origin}/editor-uploads`);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(
    /credential|filesystem|fixture private/,
  );
});

it("runs cleanup in bounded non-overlapping passes and drains the active pass when stopped", async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  let stopping: (() => boolean) | undefined;
  const service = await startUploadHost({
    port: 0,
    maintenanceIntervalMs: 10,
    service: {
      handle: async () => new Response("working"),
      maintain: async (shouldStop) => {
        calls++;
        stopping = shouldStop;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { examined: 1, cleaned: 1, deferred: 0 };
      },
    },
  });
  hosts.push(service);
  await expect.poll(() => calls).toBe(1);
  expect(await (await fetch(`${service.origin}/editor-uploads`)).text()).toBe(
    "working",
  );
  const closing = service.close();
  expect(stopping?.()).toBe(true);
  expect(calls).toBe(1);
  release?.();
  await closing;
  expect(calls).toBe(1);
});

it("validates private startup settings without contacting a provider", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-upload-host-"));
  roots.push(root);
  const env = {
    BUILDER_UPLOAD_SUPABASE_URL: "https://fixture.supabase.co",
    BUILDER_UPLOAD_ANON_KEY: "fixture-anon",
    BUILDER_UPLOAD_SERVICE_KEY: "fixture-service",
    BUILDER_UPLOAD_WORKER_ID: "fixture-upload",
    BUILDER_UPLOAD_DIRECTORY: path.join(root, "spool"),
    BUILDER_UPLOAD_MIN_FREE_BYTES: "0",
  };
  expect((await uploadHostService(env)).port).toBe(4336);
  for (const override of [
    { BUILDER_UPLOAD_PORT: "80" },
    { BUILDER_UPLOAD_MAX_FILES: "1.5" },
    { BUILDER_UPLOAD_WORKER_ID: "wrong/path" },
    { BUILDER_UPLOAD_SUPABASE_URL: "http://external.example.test" },
  ]) {
    await expect(uploadHostService({ ...env, ...override })).rejects.toThrow();
  }
});

it("runs the standalone bundle without starting imported worker CLIs or requiring a checkout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-upload-bundle-"));
  roots.push(root);
  const bundle = path.join(root, "worker.mjs");
  await exec(process.execPath, ["scripts/build-upload-worker.mjs", bundle], {
    timeout: 30000,
  });
  const child = spawn(process.execPath, [bundle], {
    cwd: root,
    env: { PATH: process.env.PATH, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => (stdout += bytes));
  child.stderr.on("data", (bytes) => (stderr += bytes));
  const [code] = await once(child, "exit");
  expect(code).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toBe(
    "Kaizen upload service could not start. Check its private configuration and storage permissions.\n",
  );
}, 30000);
