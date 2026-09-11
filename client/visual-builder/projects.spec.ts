import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { LocalProjects } from "../../scripts/builder-projects";
import { libraryFixture } from "./library-fixture";

async function fixture() {
  const root = path.resolve("test-results/project-unit");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "case-"));
  return { directory, projects: new LocalProjects(directory) };
}
describe("local client project boundaries", () => {
  it("migrates the legacy workspace in place without rewriting history or auxiliary files", async () => {
    const { directory, projects } = await fixture();
    const bytes = JSON.stringify(libraryFixture(), null, 3);
    await writeFile(path.join(directory, "workspace.json"), bytes);
    await writeFile(path.join(directory, "private-previews.json"), "retained");
    const list = await projects.list();
    expect(list.map((p) => p.id)).toEqual(["kaizen"]);
    expect(await readFile(path.join(directory, "workspace.json"), "utf8")).toBe(
      bytes,
    );
    expect(
      await readFile(path.join(directory, "private-previews.json"), "utf8"),
    ).toBe("retained");
    expect(await new LocalProjects(directory).list()).toEqual(list);
  });
  it("creates independent stores, duplicates all history and files with project URLs, and resets destinations", async () => {
    const { directory, projects } = await fixture();
    const workspace = libraryFixture();
    await mkdir(path.join(directory, "assets"));
    workspace.assets.forEach((a) => {
      a.url = `/builder-media/${a.id}.png`;
    });
    workspace.pages[0].draft.theme.fontUrl = workspace.assets[0].url;
    for (const asset of workspace.assets)
      await writeFile(path.join(directory, "assets", asset.id), asset.id);
    await writeFile(
      path.join(directory, "workspace.json"),
      JSON.stringify(workspace),
    );
    const [alpha, beta] = await Promise.all([
      projects.mutate({ action: "create", name: "Alpha" }),
      projects.mutate({ action: "create", name: "Beta" }),
    ]);
    expect(alpha.id).not.toBe(beta.id);
    const copied = await projects.mutate({
      action: "duplicate",
      id: "kaizen",
      name: "Copy",
    });
    expect(copied.destination.kind).toBe("unconfigured");
    const copy = JSON.parse(
      await readFile(
        path.join(projects.directory(copied.id), "workspace.json"),
        "utf8",
      ),
    );
    expect(copy.pages[0].draft.theme.fontUrl).toBe(
      workspace.assets[0].url + `?project=${copied.id}`,
    );
    expect(copy.pages[0].revisions).toHaveLength(
      workspace.pages[0].revisions.length,
    );
    for (const asset of copy.assets)
      expect(
        await readFile(
          path.join(projects.directory(copied.id), "assets", asset.id),
          "utf8",
        ),
      ).toBe(asset.id);
    for (const project of [alpha, beta])
      expect(
        JSON.parse(
          await readFile(
            path.join(projects.directory(project.id), "workspace.json"),
            "utf8",
          ),
        ),
      ).toEqual({ pages: [], assets: [], saved: [] });
    expect(
      JSON.parse(
        await readFile(path.join(directory, "workspace.json"), "utf8"),
      ),
    ).toEqual(workspace);
  });
  it("rejects traversal, unknown IDs, stale mutations and writes to archived projects", async () => {
    const { projects } = await fixture();
    expect(() => projects.directory("../other")).toThrow(/Invalid/);
    await expect(projects.require(crypto.randomUUID())).rejects.toThrow(
      /not found/,
    );
    const project = await projects.mutate({ action: "create", name: "Client" });
    const renamed = await projects.mutate({
      action: "rename",
      id: project.id,
      version: project.version,
      name: "Renamed",
    });
    await expect(
      projects.mutate({
        action: "archive",
        id: project.id,
        version: project.version,
        archived: true,
      }),
    ).rejects.toThrow(/another window/);
    const archived = await projects.mutate({
      action: "archive",
      id: project.id,
      version: renamed.version,
      archived: true,
    });
    await expect(projects.require(project.id, true)).rejects.toThrow(
      /archived/,
    );
    await projects.mutate({
      action: "archive",
      id: project.id,
      version: archived.version,
      archived: false,
    });
    expect((await projects.require(project.id, true)).name).toBe("Renamed");
  });
  it("fails closed on a newer catalogue instead of silently creating an empty workspace", async () => {
    const { directory, projects } = await fixture();
    await writeFile(
      path.join(directory, "projects.json"),
      JSON.stringify({ formatVersion: 999, projects: [] }),
    );
    await expect(projects.list()).rejects.toThrow(/Unsupported/);
  });
});
