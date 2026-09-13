import { afterEach, describe, expect, it } from "vitest";
import {
  lstat,
  readFile,
  writeFile,
  readdir,
  rename,
  symlink,
  rm,
} from "node:fs/promises";
import path from "node:path";
import {
  hostedHelperFixture,
  helperProject,
  helperOtherProject,
  helperOwner,
  helperEditor,
} from "../../tests/builder/hosted-helper-fixture";
import { HostedRepositorySettings } from "../../scripts/builder-hosted-settings";
import { HostedWebsiteFolders } from "../../scripts/builder-hosted-folders";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) await fixture.close();
});
async function fixture(setup: "empty" | "approved" = "approved") {
  const api = await hostedHelperFixture(
    undefined,
    undefined,
    undefined,
    undefined,
    {
      target: { environment: "staging", url: "https://stage.fixture.invalid" },
    },
    setup,
  );
  fixtures.push(api);
  return api;
}
const read = (api: Fixture) => api.send({ action: "repository-settings-read" });
const key = (api: Fixture, version = 0) =>
  api.send({ action: "repository-settings-key", version });
const connect = (api: Fixture, version = 1) =>
  api.send({ action: "repository-settings-connect", version });
const save = (api: Fixture, version: number, repository: unknown) =>
  api.send({ action: "repository-settings-save", version, repository });
const repository = {
  repositoryUrl: "git@fixture.invalid:fixture/site.git",
  branch: "stage",
};
async function connected(api: Fixture) {
  const generated = await key(api);
  expect(generated.status).toBe(200);
  await api.authorizeKey(generated.body.publicKey);
  expect((await connect(api)).status).toBe(200);
  return generated.body;
}
describe("owner repository settings", () => {
  it("creates a private deploy key, returns its public half only once and requires that key at the remote before connecting", async () => {
    const api = await fixture();
    const initial = await read(api);
    expect(initial).toMatchObject({
      status: 200,
      body: {
        version: 0,
        connected: false,
        key: { configured: false },
        repository: {
          ...repository,
          saveToWebsite: { environment: "staging" },
        },
      },
    });
    await expect(lstat(api.folders.root(helperProject))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const generated = await key(api);
    expect(generated).toMatchObject({
      status: 200,
      body: {
        version: 1,
        connected: false,
        publicKey: expect.stringMatching(/^ssh-ed25519 /),
        key: {
          configured: true,
          fingerprint: expect.stringMatching(/^SHA256:/),
        },
      },
    });
    const privateKey = path.join(api.credentials, helperProject, "deploy-key");
    expect((await lstat(privateKey)).mode & 0o777).toBe(0o600);
    expect(await readFile(privateKey, "utf8")).toContain(
      "BEGIN OPENSSH PRIVATE KEY",
    );
    expect(JSON.stringify(generated.body)).not.toMatch(
      /PRIVATE KEY|credentials|deploy-key/,
    );
    expect((await connect(api)).status).toBe(503);
    expect((await read(api)).body).not.toHaveProperty("publicKey");
    expect((await key(api, 0)).status).toBe(409);
    await api.authorizeKey(generated.body.publicKey);
    expect(await connect(api)).toMatchObject({
      status: 200,
      body: { connected: true, version: 1 },
    });
    expect(
      (await api.send({ action: "repository-connect" })).body.canSaveToWebsite,
    ).toBe(true);
    expect((await key(api, 1)).status).toBe(409);
    await api.authorizeKey("revoked fixture key");
    expect((await connect(api)).status).toBe(503);
    await api.authorizeKey(generated.body.publicKey);
    const restored = new HostedRepositorySettings(
      new HostedWebsiteFolders(
        api.folders.directory,
        api.credentials,
        api.configured,
      ),
    );
    expect(await restored.read(helperProject)).toMatchObject({
      connected: true,
      version: 1,
      key: generated.body.key,
    });
    expect(await restored.read(helperProject)).not.toHaveProperty("publicKey");
  });
  it("lets an admitted empty project configure its own repository without inheriting another staging approval", async () => {
    const api = await fixture("empty");
    expect((await read(api)).body).not.toHaveProperty("repository");
    expect((await key(api)).status).toBe(409);
    expect((await save(api, 0, repository)).body).toMatchObject({
      version: 1,
      repository,
    });
    const generated = await key(api, 1);
    expect(generated.status).toBe(200);
    await api.authorizeKey(generated.body.publicKey);
    expect((await connect(api, 2)).body.connected).toBe(true);
    expect(
      (await api.send({ action: "repository-connect" })).body,
    ).not.toHaveProperty("canSaveToWebsite");
    expect(
      (await api.send({ action: "repository-inspect-current" })).status,
    ).toBe(200);
    expect(
      (
        await save(api, 2, {
          ...repository,
          saveToWebsite: {
            environment: "staging",
            url: "https://production.fixture.invalid",
          },
        })
      ).status,
    ).toBe(400);
    expect((await save(api, 0, repository)).status).toBe(409);
  });
  it("requires current ownership before disk work, including after waiting for the project lock", async () => {
    const api = await fixture();
    for (const action of [
      "repository-settings-read",
      "repository-settings-save",
      "repository-settings-key",
      "repository-settings-connect",
    ])
      expect(
        (await api.send({ action, version: 0, repository }, helperEditor))
          .status,
      ).toBe(403);
    await expect(lstat(api.folders.directory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = api.folders.locked(helperProject, async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await ready;
    const before = api.calls.length;
    const pending = key(api);
    await expect
      .poll(() =>
        api.calls
          .slice(before)
          .some((call) => call.body?.capability === "owner"),
      )
      .toBe(true);
    api.owners.get(helperProject)!.delete(helperOwner);
    release();
    await held;
    expect((await pending).status).toBe(403);
    expect(
      (
        await api.send({
          action: "repository-settings-read",
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(200);
    api.archived.add(helperOtherProject);
    expect(
      (
        await api.send({
          action: "repository-settings-read",
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(403);
  });
  it("refuses unapproved hosts, URL arguments, traversal, foreign roots and credential fields", async () => {
    const api = await fixture();
    for (const value of [
      { ...repository, repositoryUrl: "git@outside.invalid:fixture/site.git" },
      { ...repository, repositoryUrl: "ext::sh -c command" },
      { ...repository, branch: "../main" },
      { ...repository, privateKey: "never accepted" },
      { ...repository, projectId: helperOtherProject },
    ])
      expect((await save(api, 0, value)).status).toBeGreaterThanOrEqual(400);
    expect(
      (
        await api.send({
          action: "repository-settings-key",
          version: 0,
          root: "/outside",
        })
      ).status,
    ).toBe(403);
    expect((await read(api)).body.version).toBe(0);
    await expect(
      lstat(path.join(api.credentials, helperProject, "deploy-key")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("keeps a connected folder with pending work and archives a clean branch change without retaining its staging approval or old plans", async () => {
    const api = await fixture();
    await connected(api);
    const root = api.folders.root(helperProject);
    await api.git(api.seed, ["branch", "preview"]);
    await api.git(api.seed, ["push", api.remote, "preview"]);
    await writeFile(path.join(root, "README.md"), "Unsaved work\n");
    const target = { ...repository, branch: "preview" };
    expect((await save(api, 1, target)).status).toBe(409);
    expect(await readFile(path.join(root, "README.md"), "utf8")).toBe(
      "Unsaved work\n",
    );
    expect((await read(api)).body.version).toBe(1);
    await api.git(root, ["restore", "README.md"]);
    await api.git(root, [
      "-c",
      "user.name=Fixture owner",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "Unsent fixture commit",
    ]);
    expect((await save(api, 1, target)).status).toBe(409);
    await api.git(root, ["reset", "--hard", "HEAD^"]);
    const releaseBuild = await api.folders.locked(helperProject, () =>
      api.folders.claimBuild(helperProject, "fixture-build"),
    );
    try {
      expect((await save(api, 1, target)).status).toBe(409);
      expect((await read(api)).body.repository.branch).toBe("stage");
    } finally {
      await releaseBuild();
    }
    const inspected = (
      await api.send({
        action: "repository-source-inspect",
        route: "src/pages/index.astro",
      })
    ).body;
    const heading = inspected.fields.find(
      (field: { value: string }) => field.value === "Hosted original",
    );
    const plan = (
      await api.send({
        action: "repository-source-prepare",
        edits: {
          inspection: inspected,
          values: { [heading.id]: "Old plan" },
          orders: {},
        },
      })
    ).body;
    expect(await save(api, 1, target)).toMatchObject({
      status: 200,
      body: {
        version: 2,
        connected: false,
        key: { configured: true },
        repository: target,
      },
    });
    expect((await read(api)).body.repository).not.toHaveProperty(
      "saveToWebsite",
    );
    const previous = path.join(
      api.folders.projectDirectory(helperProject),
      "previous-setups",
    );
    const archives = await readdir(previous);
    expect(archives).toHaveLength(1);
    expect(
      await readFile(
        path.join(previous, archives[0], "checkout/README.md"),
        "utf8",
      ),
    ).toBe("Unrelated repository content\n");
    expect((await connect(api, 2)).status).toBe(200);
    expect(await api.git(root, ["branch", "--show-current"])).toBe("preview");
    expect(
      (await api.send({ action: "repository-apply", planId: plan.id })).status,
    ).toBe(409);
    expect(
      (await api.send({ action: "repository-save", planId: plan.id })).status,
    ).toBe(501);
  });
  it("replaces an unconnected setup key explicitly, retains the old private key outside the working area and never reveals it on read", async () => {
    const api = await fixture();
    const first = await key(api);
    const second = await key(api, 1);
    expect(second.status).toBe(200);
    expect(second.body.publicKey).not.toBe(first.body.publicKey);
    expect(second.body.key.fingerprint).not.toBe(first.body.key.fingerprint);
    expect((await read(api)).body).not.toHaveProperty("publicKey");
    const files = await readdir(api.folders.directory, { recursive: true });
    expect(files.some((file) => file.includes("deploy-key"))).toBe(false);
    const retained = path.join(api.credentials, helperProject, "previous-keys");
    expect(await readdir(retained)).toHaveLength(1);
    await api.authorizeKey(first.body.publicKey);
    expect((await connect(api, 2)).status).toBe(503);
    await api.authorizeKey(second.body.publicKey);
    expect((await connect(api, 2)).status).toBe(200);
  });
  it("requires a separate deploy key when an owner changes the repository address", async () => {
    const api = await fixture();
    const first = await key(api);
    const result = await save(api, 1, {
      ...repository,
      repositoryUrl: "git@fixture.invalid:fixture/other-site.git",
    });
    expect(result).toMatchObject({
      status: 200,
      body: { version: 2, connected: false, key: { configured: false } },
    });
    expect(result.body.key).not.toHaveProperty("fingerprint");
    expect(result.body.repository).not.toHaveProperty("saveToWebsite");
    expect((await connect(api, 2)).status).toBe(409);
    const retained = path.join(api.credentials, helperProject, "previous-keys");
    expect(await readdir(retained)).toHaveLength(1);
    const second = await key(api, 2);
    expect(second.status).toBe(200);
    expect(second.body.key.fingerprint).not.toBe(first.body.key.fingerprint);
  });
  it("preserves an applied save receipt even if an operator makes the folder clean before retargeting", async () => {
    const api = await fixture();
    await connected(api);
    const inspected = (
      await api.send({
        action: "repository-source-inspect",
        route: "src/pages/index.astro",
      })
    ).body;
    const heading = inspected.fields.find(
      (field: { value: string }) => field.value === "Hosted original",
    );
    const plan = (
      await api.send({
        action: "repository-source-prepare",
        edits: {
          inspection: inspected,
          values: { [heading.id]: "Unsaved edit" },
          orders: {},
        },
      })
    ).body;
    expect(
      (await api.send({ action: "repository-apply", planId: plan.id })).status,
    ).toBe(200);
    await api.git(api.folders.root(helperProject), [
      "restore",
      "src/pages/index.astro",
    ]);
    expect(
      await save(api, 1, { ...repository, branch: "preview" }),
    ).toMatchObject({
      status: 409,
      body: {
        error: expect.stringContaining("Save the applied website changes"),
      },
    });
    expect(
      (await api.send({ action: "repository-save-status", planId: plan.id }))
        .body.phase,
    ).toBe("applied");
    expect((await read(api)).body.repository.branch).toBe("stage");
  });
  it("fails closed on an interrupted setup or a linked settings file instead of automatically replacing a folder or key", async () => {
    const api = await fixture();
    await key(api);
    const directory = api.folders.projectDirectory(helperProject);
    const transition = path.join(directory, "repository-setup-transition.json");
    await writeFile(transition, "fixture interrupted transition", {
      mode: 0o600,
    });
    for (const action of [
      "repository-connect",
      "repository-settings-read",
      "repository-settings-key",
    ])
      expect((await api.send({ action, version: 1 })).status).toBe(503);
    await rm(transition);
    const file = path.join(directory, "repository-settings.json"),
      retained = path.join(directory, "retained-settings.json");
    await rename(file, retained);
    await symlink(retained, file);
    expect((await read(api)).status).toBe(503);
    expect(JSON.parse(await readFile(retained, "utf8")).version).toBe(1);
  });
});
