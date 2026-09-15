import { expect, it, vi } from "vitest";
import { HostedUploadConnection } from "./hostedUploads";
import type { Asset } from "../../shared/visualBuilder";
const project = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333";
const asset = {
  id: "44444444-4444-4444-8444-444444444444",
  hash: "a".repeat(64),
  size: 3,
  mime: "text/plain",
  kind: "code",
  name: "file.txt",
  path: "file.txt",
  pack: "Fixture",
} as Asset;
const endpoint = "https://builder.example.test/editor-uploads",
  url = `${endpoint}/${id}`;
function fixture() {
  const state = {
    session: {
      user: { id: actor },
      access_token: "fixture-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    } as any,
  };
  const receipt = {
    id,
    projectId: project,
    assetId: asset.id,
    bytes: asset.size,
    sha256: asset.hash,
    status: "stored",
  };
  const transfer = vi.fn(async (_blob, options) => {
    await options.headers();
    await options.onUploadUrl?.(url);
    options.progress(100);
    return url;
  });
  const request = vi.fn(
    async (_url: string | URL | Request, _options?: RequestInit) =>
      new Response(JSON.stringify(receipt), { status: 200 }),
  );
  const connection = new HostedUploadConnection({
    origin: "https://builder.example.test",
    projectId: project,
    accountId: actor,
    scope: "fixture-scope",
    getSession: async () => state.session,
    transfer,
    fetch: request,
    previousEndpoints: [
      "https://fixture.storage.supabase.co/storage/v1/upload/resumable",
    ],
  });
  return { state, receipt, transfer, request, connection };
}

it("recovers existing files using server verification without transferring or deleting their bytes", async () => {
  const api = fixture();
  await api.connection.adopt(asset);
  const [address, options] = api.request.mock.calls[0];
  expect(address).toBe(`${endpoint}/adopt`);
  expect(options.method).toBe("POST");
  expect(options.body).toBeUndefined();
  const headers = new Headers(options.headers);
  expect(headers.get("Authorization")).toBe("Bearer fixture-token");
  expect(headers.get("Upload-Length")).toBe("3");
  expect(JSON.parse(atob(headers.get("Upload-Metadata")!.slice(5)))).toEqual({
    projectId: project,
    assetId: asset.id,
    bytes: 3,
    sha256: asset.hash,
    mime: asset.mime,
    kind: asset.kind,
  });
  expect(api.transfer).not.toHaveBeenCalled();
});

it("rejects oversized and mismatched recovery responses and account changes", async () => {
  const api = fixture();
  api.request.mockResolvedValueOnce(new Response("x".repeat(4097)));
  await expect(api.connection.adopt(asset)).rejects.toThrow("invalid response");
  api.request.mockResolvedValueOnce(
    Response.json({ ...api.receipt, bytes: 4 }),
  );
  await expect(api.connection.adopt(asset)).rejects.toThrow("does not match");
  api.request.mockImplementationOnce(async () => {
    api.state.session.user.id = "another-account";
    return Response.json(api.receipt);
  });
  await expect(api.connection.adopt(asset)).rejects.toThrow("original account");
});

it("sends fixed file identity through TUS and finishes the verified upload with the captured account", async () => {
  const api = fixture(),
    progress = vi.fn(),
    save = vi.fn();
  await api.connection.upload(asset, new Blob(["abc"]), progress, {
    scope: "fixture-scope",
    onUploadUrl: save,
  });
  const options = api.transfer.mock.calls[0][1];
  expect(options.endpoint).toBe(endpoint);
  expect(JSON.parse(options.metadata.file)).toEqual({
    projectId: project,
    assetId: asset.id,
    bytes: 3,
    sha256: asset.hash,
    mime: asset.mime,
    kind: asset.kind,
  });
  expect(save).toHaveBeenCalledWith(url);
  expect(api.request).toHaveBeenCalledWith(
    `${url}/finish`,
    expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer fixture-token" },
      redirect: "error",
      cache: "no-store",
    }),
  );
  expect(progress.mock.calls.map((call) => call[0])).toEqual([95, 100]);
});

it("refuses another account or import scope before sending upload requests", async () => {
  const api = fixture();
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), () => {}, {
      scope: "different-scope",
    }),
  ).rejects.toThrow("another account or website");
  api.state.session.user.id = "55555555-5555-4555-8555-555555555555";
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), () => {}),
  ).rejects.toThrow("original account");
  expect(api.transfer).not.toHaveBeenCalled();
  expect(api.request).not.toHaveBeenCalled();
});

it("refreshes the same account's token while refusing an account change during transfer", async () => {
  const api = fixture();
  api.transfer.mockImplementationOnce(async (_blob, options) => {
    expect(await options.headers()).toEqual({
      Authorization: "Bearer fixture-token",
    });
    api.state.session.access_token = "refreshed-token";
    expect(await options.headers()).toEqual({
      Authorization: "Bearer refreshed-token",
    });
    return url;
  });
  await api.connection.upload(asset, new Blob(["abc"]), () => {});
  expect(api.request).toHaveBeenCalledWith(
    `${url}/finish`,
    expect.objectContaining({
      headers: { Authorization: "Bearer refreshed-token" },
    }),
  );
  api.request.mockClear();
  api.transfer.mockImplementationOnce(async (_blob, options) => {
    api.state.session = null;
    await options.headers();
    return url;
  });
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), () => {}),
  ).rejects.toThrow("original account");
  expect(api.request).not.toHaveBeenCalled();
});

it("rejects foreign, query-bearing or malformed saved upload URLs before attaching credentials", async () => {
  const api = fixture();
  for (const saved of [
    `https://foreign.example.test/editor-uploads/${id}`,
    `${url}?token=unexpected`,
    `${url}/extra`,
    `${endpoint}/bad-id`,
  ]) {
    await expect(
      api.connection.upload(asset, new Blob(["abc"]), () => {}, {
        uploadUrl: saved,
      }),
    ).rejects.toThrow();
  }
  expect(api.transfer).not.toHaveBeenCalled();
  expect(api.request).not.toHaveBeenCalled();
});

it("rejects a foreign creation Location before saving it to the recovery job", async () => {
  const api = fixture(),
    save = vi.fn();
  api.transfer.mockImplementationOnce(async (_blob, options) => {
    await options.onUploadUrl("https://foreign.example.test/file");
    return url;
  });
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), () => {}, {
      onUploadUrl: save,
    }),
  ).rejects.toThrow();
  expect(save).not.toHaveBeenCalled();
  expect(api.request).not.toHaveBeenCalled();
});

it("restarts known older provider recovery URLs at the new service without contacting the old endpoint", async () => {
  const api = fixture();
  await api.connection.upload(asset, new Blob(["abc"]), () => {}, {
    recover: true,
    uploadUrl:
      "https://fixture.storage.supabase.co/storage/v1/upload/resumable/old-session",
  });
  expect(api.transfer.mock.calls[0][1].uploadUrl).toBeUndefined();
  expect(api.transfer.mock.calls[0][1].endpoint).toBe(endpoint);
  expect(api.request.mock.calls[0][0]).toBe(`${url}/finish`);
});

it("does not complete the import after a mismatched receipt or a late account change", async () => {
  const api = fixture(),
    progress = vi.fn();
  api.request.mockResolvedValueOnce(
    new Response(JSON.stringify({ ...api.receipt, sha256: "b".repeat(64) })),
  );
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), progress),
  ).rejects.toThrow("did not match");
  expect(progress).not.toHaveBeenCalledWith(100);
  api.request.mockImplementationOnce(async () => {
    api.state.session = null;
    return new Response(JSON.stringify(api.receipt));
  });
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), progress),
  ).rejects.toThrow("original account");
});

it("shows quota refusal and retains the pending import for retry", async () => {
  const api = fixture();
  api.request.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: "This account has reached its storage limit." }),
      { status: 429 },
    ),
  );
  await expect(
    api.connection.upload(asset, new Blob(["abc"]), () => {}),
  ).rejects.toThrow("storage limit");
});

it("cancels through the same account and accepts completed assets being kept", async () => {
  const api = fixture();
  await api.connection.cancel(url, "fixture-scope");
  expect(api.request).toHaveBeenCalledWith(
    url,
    expect.objectContaining({
      method: "DELETE",
      headers: { Authorization: "Bearer fixture-token" },
    }),
  );
  api.request.mockResolvedValueOnce(
    new Response(JSON.stringify({ ...api.receipt, status: "removed" })),
  );
  await api.connection.cancel(url, "fixture-scope");
  await expect(api.connection.cancel(url, "other-scope")).rejects.toThrow(
    "another account or website",
  );
});
