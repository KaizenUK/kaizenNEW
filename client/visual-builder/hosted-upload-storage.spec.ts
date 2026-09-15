import { beforeEach, expect, it, vi } from "vitest";
import type { Asset } from "../../shared/visualBuilder";
const mocks = vi.hoisted(() => {
  const state = { account: "original", steps: [] as string[] };
  const insert = vi.fn(),
    header = vi.fn(),
    register = vi.fn();
  const connection = {
    projectId: "kaizen",
    accountId: "original",
    scope: "legacy-fixture",
    upload: vi.fn(),
    adopt: vi.fn(),
    cancel: vi.fn(),
    current: vi.fn(),
  };
  const client = {
    from: vi.fn(() => ({ insert })),
    storage: {
      from: () => ({
        getPublicUrl: (id: string) => ({
          data: {
            publicUrl: `https://fixture.supabase.co/storage/v1/object/public/builder-media/${id}`,
          },
        }),
      }),
    },
  };
  return { state, connection, client, insert, header, register };
});
vi.mock("./builderMode", () => ({ builderCloudEnabled: true }));
vi.mock("../lib/supabase", () => ({ getSupabaseClient: () => mocks.client }));
vi.mock("./hostedUploads", () => ({
  hostedUploadContext: async () => mocks.connection,
}));
vi.mock("./cloudProjects", () => ({
  hostedProject: async () => false,
  cloudProjectRequest: mocks.register,
  cloudProjectScope: vi.fn(),
  uploadProjectFile: vi.fn(),
  projectMediaUrl: vi.fn(),
}));
vi.mock("./projectStorage", () => ({
  activeProjectId: "kaizen",
  projectUrl: (value: string) => value,
  requireActiveProject: vi.fn(),
}));
vi.mock("./repositoryConnection", () => ({ repositoryConnection: {} }));
vi.mock("./diagnostics", () => ({
  trackStorageErrors: (value: unknown) => value,
}));
import { storage } from "./storage";
const asset = {
  id: "44444444-4444-4444-8444-444444444444",
  hash: "a".repeat(64),
  size: 3,
  mime: "image/png",
  kind: "image",
  name: "image.png",
  path: "image.png",
  pack: "Fixture",
} as Asset;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.account = "original";
  mocks.state.steps = [];
  mocks.connection.current.mockImplementation(async () => {
    if (mocks.state.account !== "original")
      throw new Error("Sign in with the original account");
    mocks.state.steps.push("session");
    return { user: { id: "original" }, access_token: "captured-token" };
  });
  mocks.connection.upload.mockImplementation(async () => {
    mocks.state.steps.push("verified upload");
  });
  mocks.register.mockImplementation(async (input) => {
    mocks.state.steps.push("registration");
    return input.asset;
  });
  mocks.header.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockImplementation(() => {
    mocks.state.steps.push("registration");
    return { setHeader: mocks.header };
  });
});

it("registers legacy Kaizen assets only after verified upload and pins registration to that account", async () => {
  const result = await storage.uploadFile(asset, new Blob(["abc"]), () => {}, {
    scope: "legacy-fixture",
  });
  expect(result).toMatchObject({
    id: asset.id,
    hash: asset.hash,
    url: `https://fixture.supabase.co/storage/v1/object/public/builder-media/${asset.id}`,
  });
  expect(mocks.state.steps.indexOf("verified upload")).toBeLessThan(
    mocks.state.steps.indexOf("registration"),
  );
  expect(mocks.register).toHaveBeenCalledWith(
    {
      action: "register-asset",
      asset: expect.objectContaining({
        id: asset.id,
        hash: asset.hash,
        size: 3,
      }),
    },
    false,
    mocks.connection,
  );
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("routes small hosted files through the verified service and keeps failed uploads out of the library", async () => {
  mocks.connection.upload.mockRejectedValueOnce(
    new Error("Storage limit reached"),
  );
  await expect(
    storage.uploadStandard(asset, new Blob(["abc"]), () => {}, {
      scope: "legacy-fixture",
    }),
  ).rejects.toThrow("Storage limit reached");
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.register).not.toHaveBeenCalled();
});

it("does not register an upload under an account that signed in while it was transferring", async () => {
  mocks.connection.upload.mockImplementationOnce(async () => {
    mocks.state.account = "replacement";
  });
  await expect(
    storage.uploadFile(asset, new Blob(["abc"]), () => {}, {
      scope: "legacy-fixture",
    }),
  ).rejects.toThrow("original account");
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.register).not.toHaveBeenCalled();
});

it("leaves import recovery available when server cancellation fails", async () => {
  mocks.connection.cancel.mockRejectedValueOnce(
    new Error("Cleanup needs a retry"),
  );
  await expect(
    storage.cancelUpload(
      "https://builder.example.test/editor-uploads/fixture",
      "legacy-fixture",
    ),
  ).rejects.toThrow("Cleanup needs a retry");
  expect(mocks.connection.cancel).toHaveBeenCalledWith(
    "https://builder.example.test/editor-uploads/fixture",
    "legacy-fixture",
  );
});
