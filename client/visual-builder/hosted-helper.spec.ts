import { afterEach, describe, expect, it } from "vitest";
import {
  chmod,
  lstat,
  readFile,
  symlink,
  unlink,
  writeFile,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import { HostedRepositoryAccess } from "../../scripts/builder-hosted-auth";
import { request as httpRequest } from "node:http";
import {
  HostedWebsiteFolders,
  hostedProjectRepositories,
} from "../../scripts/builder-hosted-folders";
import {
  helperEditor,
  helperOwner,
  helperOtherProject,
  helperProject,
  helperToken,
  hostedHelperFixture,
} from "../../tests/builder/hosted-helper-fixture";

const fixtures: Awaited<ReturnType<typeof hostedHelperFixture>>[] = [];
const fixture = async () => {
  const value = await hostedHelperFixture();
  fixtures.push(value);
  return value;
};
afterEach(async () => {
  for (const value of fixtures.splice(0).reverse()) await value.close();
});
const inspect = async (
  api: Awaited<ReturnType<typeof fixture>>,
  projectId = helperProject,
) => {
  const value = await api.send({
    action: "repository-source-inspect",
    route: "src/pages/index.astro",
    projectId,
  });
  expect(value.status).toBe(200);
  return value.body;
};
const editsFor = (inspection: any, value = "Hosted changed") => ({
  inspection,
  values: {
    [inspection.fields.find((field: any) => field.value === "Hosted original")
      .id]: value,
  },
  orders: {},
});

describe("hosted helper service", () => {
  it("clones the configured branch with its project key and inspects the original source over loopback HTTP", async () => {
    const api = await fixture();
    const connection = await api.send({
      action: "repository-connect",
      root: api.folders.root(helperProject),
    });
    expect(connection).toMatchObject({
      status: 200,
      body: { projectId: helperProject, root: api.folders.root(helperProject) },
    });
    expect(connection.body.expiresAt).toBeGreaterThan(Date.now());
    expect(connection.body.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
    expect((await inspect(api)).fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "Hosted original" }),
      ]),
    );
    expect(
      (await api.send({ action: "repository-git-status" })).body,
    ).toMatchObject({ branch: "stage", isRepository: true, files: [] });
    const [ssh] = await api.sshCalls();
    expect(ssh.args).toEqual(
      expect.arrayContaining([
        "-i",
        path.join(api.credentials, helperProject, "deploy-key"),
        `UserKnownHostsFile=${path.join(api.credentials, helperProject, "known_hosts")}`,
      ]),
    );
    expect(
      ssh.environment.some((key: string) =>
        /SUPABASE|TOKEN|SECRET|SSH_AUTH_SOCK/.test(key),
      ),
    ).toBe(false);
    expect(
      api.calls
        .filter((call) => call.route.endsWith("builder_project_access"))
        .every(
          (call) =>
            call.body.actor === helperOwner && call.body.capability === "edit",
        ),
    ).toBe(true);
  });
  it("authenticates before reading the body and denies absent, expired, forged or unavailable sign-in without touching disk", async () => {
    const api = await fixture();
    const input = { projectId: helperProject, action: "repository-connect" };
    const headers = (token: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    expect((await api.send(input, helperOwner, { headers: {} })).status).toBe(
      401,
    );
    expect(
      (
        await api.send(input, helperOwner, {
          headers: headers(helperToken(helperOwner, 1)),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await api.send(input, helperOwner, {
          headers: headers(
            helperToken().replace("fixture-signature", "forged"),
          ),
        })
      ).status,
    ).toBe(401);
    let read = false;
    await expect(
      api.service.request("bad-token", async () => {
        read = true;
        return input;
      }),
    ).rejects.toThrow(/Sign in/);
    expect(read).toBe(false);
    api.outage(true);
    const failed = await api.send(input);
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed)).not.toMatch(
      /credential|private fixture|token/i,
    );
    expect(await lstat(api.folders.directory).catch(() => null)).toBeNull();
  });
  it("checks membership on every call, rejects archived projects and keeps folders isolated", async () => {
    const api = await fixture();
    api.members.get(helperProject)!.delete(helperEditor);
    expect(
      (await api.send({ action: "repository-connect" }, helperEditor)).status,
    ).toBe(403);
    expect(await lstat(api.folders.directory).catch(() => null)).toBeNull();
    await inspect(api);
    const other = await inspect(api, helperOtherProject);
    expect(other.root).not.toBe(api.folders.root(helperProject));
    expect(
      (
        await api.send({
          action: "repository-source-inspect",
          root: other.root,
          route: "src/pages/index.astro",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api.send({
          action: "repository-source-prepare",
          edits: editsFor(other),
        })
      ).status,
    ).toBe(403);
    api.archived.add(helperProject);
    expect(
      (await api.send({ action: "repository-inspect-current" })).status,
    ).toBe(403);
    api.archived.clear();
    api.members.get(helperProject)!.delete(helperOwner);
    expect(
      (await api.send({ action: "repository-inspect-current" })).status,
    ).toBe(403);
  });
  it("saves separate account drafts, reviews real source, applies once and leaves unrelated files unchanged", async () => {
    const api = await fixture(),
      inspection = await inspect(api),
      edits = editsFor(inspection);
    const saved = await api.send({
      action: "repository-source-draft-save",
      root: inspection.root,
      route: inspection.route,
      version: 0,
      edits,
    });
    expect(saved).toMatchObject({ status: 200, body: { version: 1 } });
    const other = await api.send(
      { action: "repository-source-draft-read", route: inspection.route },
      helperEditor,
    );
    expect(other.body).toMatchObject({ version: 0, edits: null });
    const reviewed = await api.send({
      action: "repository-source-prepare",
      edits,
      draftVersion: 1,
    });
    expect(reviewed.status).toBe(200);
    const planId = reviewed.body.id;
    expect(
      (await api.send({ action: "repository-apply", planId }, helperEditor))
        .status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-apply",
          planId,
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(409);
    const applied = await api.send({ action: "repository-apply", planId });
    expect(applied).toMatchObject({
      status: 200,
      body: { changed: 1, files: ["src/pages/index.astro"] },
    });
    expect(
      await readFile(
        path.join(inspection.root, "src/pages/index.astro"),
        "utf8",
      ),
    ).toContain("Hosted changed");
    expect(
      await readFile(path.join(inspection.root, "README.md"), "utf8"),
    ).toBe("Unrelated repository content\n");
    expect(
      (await api.send({ action: "repository-apply", planId })).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-source-draft-read",
          route: inspection.route,
        })
      ).body.edits,
    ).toBeNull();
    expect(
      await api.git(api.remote, ["show", "stage:src/pages/index.astro"]),
    ).toContain("Hosted original");
  });
  it("preserves edits when fetching remote changes and refuses source changes made after review", async () => {
    const api = await fixture(),
      inspection = await inspect(api);
    const reviewed = await api.send({
      action: "repository-source-prepare",
      edits: editsFor(inspection),
    });
    await writeFile(
      path.join(inspection.root, "src/pages/index.astro"),
      "<h1>Concurrent source edit</h1>",
    );
    expect(
      (await api.send({ action: "repository-apply", planId: reviewed.body.id }))
        .status,
    ).toBe(409);
    await writeFile(path.join(api.seed, "README.md"), "New remote content\n");
    await api.git(api.seed, ["add", "README.md"]);
    await api.git(api.seed, ["commit", "-m", "Remote advance"]);
    await api.git(api.seed, ["push", api.remote, "stage"]);
    const before = await api.git(inspection.root, ["rev-parse", "HEAD"]);
    expect((await api.send({ action: "repository-fetch" })).status).toBe(200);
    expect(await api.git(inspection.root, ["rev-parse", "HEAD"])).toBe(before);
    expect(
      await api.git(inspection.root, [
        "rev-parse",
        "refs/remotes/origin/stage",
      ]),
    ).not.toBe(before);
    expect(
      await readFile(
        path.join(inspection.root, "src/pages/index.astro"),
        "utf8",
      ),
    ).toContain("Concurrent source edit");
    expect((await api.sshCalls()).length).toBe(2);
  });
  it("rejects path traversal, symlinked source, linked credentials and unsafe key permissions", async () => {
    const api = await fixture();
    expect(
      (
        await api.send({
          action: "repository-connect",
          projectId: "../private",
        })
      ).status,
    ).toBe(400);
    const key = path.join(api.credentials, helperProject, "deploy-key");
    await chmod(key, 0o644);
    expect((await api.send({ action: "repository-connect" })).status).toBe(503);
    await chmod(key, 0o600);
    const inspection = await inspect(api);
    const target = path.join(inspection.root, "src/pages/index.astro");
    await unlink(target);
    await symlink(path.join(api.seed, "src/pages/index.astro"), target);
    expect(
      (
        await api.send({
          action: "repository-source-inspect",
          route: "src/pages/index.astro",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-source-inspect",
          route: "../../private",
        })
      ).status,
    ).toBe(409);
    await unlink(key);
    await symlink(
      path.join(api.credentials, helperOtherProject, "deploy-key"),
      key,
    );
    expect((await api.send({ action: "repository-fetch" })).status).toBe(503);
    expect(
      await readFile(path.join(api.seed, "src/pages/index.astro"), "utf8"),
    ).toContain("Hosted original");
  });
  it("serializes one project's operations, permits another project and checks revocation after the wait", async () => {
    const api = await fixture();
    await inspect(api);
    let release: () => void = () => {},
      entered: () => void = () => {};
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
    const waiting = api.send({
      action: "repository-source-inspect",
      route: "src/pages/index.astro",
    });
    await expect
      .poll(() =>
        api.calls
          .slice(before)
          .some((call) => call.route.endsWith("builder_project_access")),
      )
      .toBe(true);
    expect(
      (
        await api.send({
          action: "repository-connect",
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(200);
    api.members.get(helperProject)!.delete(helperOwner);
    release();
    await held;
    expect((await waiting).status).toBe(403);
  });
  it("does not steal a cross-process or stale lock and rejects symlinked working-copy roots", async () => {
    const api = await fixture();
    await inspect(api);
    const second = new HostedWebsiteFolders(
      api.folders.directory,
      api.credentials,
      api.configured,
    );
    await api.folders.locked(helperProject, async () => {
      await expect(
        second.locked(helperProject, async () => true),
      ).rejects.toThrow(/owns this website folder/);
    });
    const lock = path.join(
      api.folders.directory,
      "locks",
      `${helperProject}.lock`,
    );
    await writeFile(lock, '{"pid":999999999}', { mode: 0o600 });
    expect(
      (await api.send({ action: "repository-inspect-current" })).status,
    ).toBe(409);
    expect(await readFile(lock, "utf8")).toContain("999999999");
    await unlink(lock);
    const otherParent = api.folders.projectDirectory(helperOtherProject);
    await mkdir(otherParent, { recursive: true, mode: 0o700 });
    await symlink(
      api.folders.root(helperProject),
      api.folders.root(helperOtherProject),
    );
    expect(
      (
        await api.send({
          action: "repository-connect",
          projectId: helperOtherProject,
        })
      ).status,
    ).toBe(503);
  });
  it("limits browser origins, request routes/types and unsupported operations without granting cookie-only access", async () => {
    const api = await fixture();
    const url = `${api.helper.origin}/editor-api/builder-repository`;
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            Cookie: "kaizen_studio_auth=1",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
    ).toBe(401);
    const hostile = await api.send(
      { action: "repository-connect" },
      helperOwner,
      {
        headers: {
          Authorization: `Bearer ${helperToken()}`,
          Origin: "https://builder.example.attacker.invalid",
          "Content-Type": "application/json",
        },
      },
    );
    expect(hostile.status).toBe(403);
    expect((await fetch(url, { method: "GET" })).status).toBe(405);
    expect((await fetch(`${url}?project=kaizen`)).status).toBe(404);
    expect((await api.send({}, helperOwner, { body: "not-json" })).status).toBe(
      400,
    );
    expect(
      (
        await api.send({}, helperOwner, {
          headers: {
            Authorization: `Bearer ${helperToken()}`,
            "Content-Type": "text/plain",
          },
        })
      ).status,
    ).toBe(415);
    expect(
      (await api.send({ action: "repository-commit", planId: "guess" }))
        .status,
    ).toBe(501);
    expect((await api.send({ action: "publish" })).status).toBe(400);
    expect(await lstat(api.folders.directory).catch(() => null)).toBeNull();
  });
  it("rejects unsafe repository settings and cannot overlap working copies with credentials", () => {
    const item = {
      projectId: helperProject,
      repositoryUrl: "git@fixture.invalid:fixture/site.git",
      branch: "stage",
    };
    for (const repositoryUrl of [
      "/tmp/private",
      "file:///tmp/private",
      "https://token@github.com/org/repo.git",
      "ssh://git@host/repo.git",
      "git@host:../repo.git",
      "git@host:org/repo.git;echo-secret",
      "-upload-pack=malicious",
    ])
      expect(() =>
        hostedProjectRepositories({
          version: 1,
          projects: [{ ...item, repositoryUrl }],
        }),
      ).toThrow(/configuration/);
    for (const branch of [
      "-flag",
      "a/../b",
      "stage.lock",
      "a//b",
      "a/.secret",
      "a.",
    ])
      expect(() =>
        hostedProjectRepositories({
          version: 1,
          projects: [{ ...item, branch }],
        }),
      ).toThrow();
    expect(() =>
      hostedProjectRepositories({ version: 1, projects: [item, item] }),
    ).toThrow();
    expect(
      () => new HostedWebsiteFolders("/srv/helper", "/srv/helper/keys", [item]),
    ).toThrow();
    expect(
      () =>
        new HostedRepositoryAccess({
          url: "http://supabase.invalid",
          anonKey: "private",
        }),
    ).toThrow(/configure/i);
  });
  it("serializes competing applies so only one reviewed proposal can change the original bytes", async () => {
    const api = await fixture(),
      inspection = await inspect(api);
    const one = await api.send({
      action: "repository-source-prepare",
      edits: editsFor(inspection, "First reviewed edit"),
    });
    const two = await api.send(
      {
        action: "repository-source-prepare",
        edits: editsFor(inspection, "Second reviewed edit"),
      },
      helperEditor,
    );
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    const results = await Promise.all([
      api.send({ action: "repository-apply", planId: one.body.id }),
      api.send(
        { action: "repository-apply", planId: two.body.id },
        helperEditor,
      ),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const saved = await readFile(
      path.join(inspection.root, "src/pages/index.astro"),
      "utf8",
    );
    expect(
      saved.includes("First reviewed edit") !==
        saved.includes("Second reviewed edit"),
    ).toBe(true);
  });
  it("keeps folder backups private to their reviewer and excludes server keys and environment files", async () => {
    const api = await fixture(),
      inspection = await inspect(api);
    await writeFile(
      path.join(inspection.root, ".env"),
      "FIXTURE_PRIVATE=do-not-export",
    );
    const backup = await api.send({
      action: "repository-native-backup-review",
    });
    expect(backup.status).toBe(200);
    expect(
      backup.body.files.some((file: any) =>
        /deploy-key|known_hosts|\.env$/.test(file.file),
      ),
    ).toBe(false);
    expect(
      (
        await api.send(
          {
            action: "repository-native-backup-download",
            reviewId: backup.body.id,
          },
          helperEditor,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-native-backup-download",
          reviewId: backup.body.id,
        })
      ).status,
    ).toBe(200);
  });
  it("rejects oversized uploads before buffering them and compressed request bodies", async () => {
    const api = await fixture();
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        `${api.helper.origin}/editor-api/builder-repository`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${helperToken()}`,
            "Content-Type": "application/json",
            "Content-Length": String(53 * 1024 * 1024),
          },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      request.on("error", reject);
      request.end("{}");
    });
    expect(status).toBe(413);
    expect(
      (
        await api.send({}, helperOwner, {
          headers: {
            Authorization: `Bearer ${helperToken()}`,
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
          },
        })
      ).status,
    ).toBe(415);
    expect(await lstat(api.folders.directory).catch(() => null)).toBeNull();
  });
});
