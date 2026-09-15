import { describe, it, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  cp,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  readClientDestinations,
  publicDestination,
  clientPublicationAction,
} from "../../scripts/client-publication.mjs";
import {
  bindClientStore,
  stageRelease,
  verifyRelease,
  initialiseStore,
  checkLive,
} from "../../scripts/kaizen-releases.mjs";
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-client-destination-"));
  const source = path.join(root, "source"),
    store = path.join(root, "store");
  await mkdir(path.join(source, "about"), { recursive: true });
  await mkdir(path.join(source, "assets"));
  await writeFile(path.join(source, "index.html"), "<h1>Home</h1>");
  await writeFile(path.join(source, "about/index.html"), "<h1>About</h1>");
  await writeFile(path.join(source, "assets/client-a.css"), "body{color:navy}");
  const client = {
    projectId: randomUUID(),
    destinationId: randomUUID(),
    environment: "staging",
    origin: "https://client.example",
  };
  return { root, source, store, client };
}
describe("client publication identity", () => {
  it("validates the server registry and hides private store paths from public choices", async () => {
    const f = await fixture(),
      file = path.join(f.root, "destinations.json");
    const record = { ...f.client, store: f.store, label: "Client staging" };
    await writeFile(
      file,
      JSON.stringify({ schemaVersion: 1, destinations: [record] }),
    );
    const [destination] = await readClientDestinations(file);
    expect(publicDestination(destination)).not.toHaveProperty("store");
    await clientPublicationAction(destination, "bind");
    await clientPublicationAction(destination, "stage", {
      source: f.source,
      id: "registry-release",
    });
    await expect(
      clientPublicationAction(
        { ...destination, projectId: randomUUID() },
        "list",
      ),
    ).rejects.toThrow("does not match");
    for (const duplicate of [
      {
        ...record,
        destinationId: randomUUID(),
        projectId: randomUUID(),
        store: path.join(f.root, "other"),
      },
      {
        ...record,
        destinationId: randomUUID(),
        origin: "https://other.example",
        store: path.join(f.store, "nested"),
      },
      {
        ...record,
        destinationId: randomUUID(),
        origin: "https://other.example",
        store: path.join(f.root, "other"),
      },
    ]) {
      await writeFile(
        file,
        JSON.stringify({ schemaVersion: 1, destinations: [record, duplicate] }),
      );
      await expect(readClientDestinations(file)).rejects.toThrow("unique IDs");
    }
  });
  it("binds a dedicated store and refuses project, environment and legacy mixing", async () => {
    const f = await fixture();
    await expect(stageRelease({ ...f, id: "unbound" })).rejects.toThrow(
      "does not match",
    );
    await bindClientStore(f);
    await expect(
      bindClientStore({
        ...f,
        client: { ...f.client, projectId: randomUUID() },
      }),
    ).rejects.toThrow("different client");
    await expect(
      stageRelease({
        ...f,
        id: "wrong-env",
        client: { ...f.client, environment: "production" },
      }),
    ).rejects.toThrow("does not match");
    await expect(
      stageRelease({ ...f, id: "legacy", client: null }),
    ).rejects.toThrow("does not match");
    const manifest = await stageRelease({ ...f, id: "release-one" });
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.checks.map((check) => check.path)).toEqual([
      "/about/",
      "/assets/client-a.css",
      "/",
    ]);
    await initialiseStore({ store: f.store, id: manifest.id });
    expect(await readFile(path.join(f.store, "active.conf"), "utf8")).toContain(
      "location ^~ /assets/",
    );
    const other = await fixture();
    await bindClientStore(other);
    await cp(
      path.join(f.store, "releases/release-one"),
      path.join(other.store, "releases/copied"),
      { recursive: true },
    );
    await expect(verifyRelease(other.store, "copied")).rejects.toThrow(
      "manifest",
    );
    await cp(
      path.join(f.store, "releases/release-one"),
      path.join(other.store, "releases/release-one"),
      { recursive: true },
    );
    await expect(verifyRelease(other.store, "release-one")).rejects.toThrow(
      "does not match",
    );
    await expect(
      checkLive("https://different.example", manifest),
    ).rejects.toThrow("configured destination");
  });
  it("does not reassign an existing Kaizen store or publish editable source", async () => {
    const f = await fixture();
    await mkdir(path.join(f.source, "builder"));
    await writeFile(path.join(f.source, "builder/index.html"), "Builder");
    await stageRelease({ ...f, id: "kaizen", client: null });
    await expect(bindClientStore(f)).rejects.toThrow("cannot be reassigned");
    const other = await fixture();
    await bindClientStore(other);
    await mkdir(path.join(other.source, ".kaizen"));
    await writeFile(
      path.join(other.source, ".kaizen/project.zip"),
      "private backup",
    );
    await expect(stageRelease({ ...other, id: "private" })).rejects.toThrow(
      "private source",
    );
  });
  it("removes the temporary holding-page source after staging an unpublication", async () => {
    const f = await fixture();
    await bindClientStore(f);
    await stageRelease({ ...f, id: "live" });
    await initialiseStore({ store: f.store, id: "live" });
    const temporary = await mkdtemp(path.join(f.root, "tmp-"));
    const original = process.env.TMPDIR;
    process.env.TMPDIR = temporary;
    try {
      await clientPublicationAction(
        { ...f.client, label: "Client", store: f.store },
        "unpublish",
        { id: "offline" },
        {
          validateConfig: async () => {},
          reload: async () => {},
          checkLive: async () => {},
        },
      );
    } finally {
      if (original === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = original;
    }
    expect(await readdir(temporary)).toEqual([]);
    expect(
      (await verifyRelease(f.store, "offline")).files.map((file) => file.path),
    ).toContain("index.html");
  });
  it("requires all public files in the verified manifest, including CSS and media", async () => {
    const f = await fixture();
    await bindClientStore(f);
    const manifest = await stageRelease({ ...f, id: "all-files" });
    manifest.checks = manifest.checks.filter(
      (check) => !check.path.endsWith(".css"),
    );
    await writeFile(
      path.join(f.store, "releases/all-files/release.json"),
      JSON.stringify(manifest),
    );
    await expect(verifyRelease(f.store, "all-files")).rejects.toThrow(
      "every served file",
    );
  });
});
