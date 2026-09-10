import { describe, expect, it } from "vitest";
import { strToU8, zipSync, unzipSync } from "fflate";
import { clone, savePage } from "../../shared/visualBuilder";
import {
  applyRestorePlan,
  makeRestorePlan,
  validateBackupWorkspace,
} from "../../shared/builderBackup";
import {
  backupDigest,
  createProjectBackup,
  openProjectBackup,
} from "./projectBackup";
import { libraryFixture } from "./library-fixture";
import { saveRoutes } from "../../shared/builderRoutes";

describe("editable project backups", () => {
  it("round-trips the full editable workspace and every registered file with checksums", async () => {
    const workspace = libraryFixture(),
      bytes = strToU8("fixture bytes, never executed");
    workspace.routes = saveRoutes(undefined, 0, [
      {
        id: crypto.randomUUID(),
        source: "/backup-retired/",
        destination: "/",
        status: 302,
      },
    ]);
    workspace.assets.forEach((asset) => {
      asset.kind = "other";
      asset.size = bytes.length;
    });
    for (const asset of workspace.assets)
      asset.hash = await backupDigest(bytes);
    const blob = await createProjectBackup(
      workspace,
      () => {},
      async () => bytes,
    );
    const opened = await openProjectBackup(blob, () => {});
    expect(opened.manifest.workspace).toEqual(workspace);
    expect(opened.files[`assets/${workspace.assets[0].id}`]).toEqual(bytes);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    files[`assets/${workspace.assets[0].id}`] = strToU8("tampered");
    await expect(
      openProjectBackup(new Blob([zipSync(files) as BlobPart]), () => {}),
    ).rejects.toThrow(/checksum/);
    await expect(
      createProjectBackup(
        workspace,
        () => {},
        async () => strToU8("different"),
      ),
    ).rejects.toThrow(/checksum/);
  });
  it("rejects source-export ZIPs, unknown formats, traversal paths and oversized declared files", async () => {
    for (const files of [
      { "src/main.tsx": strToU8("execute?") },
      { "../project.json": strToU8("{}") },
      {
        "project.json": strToU8(
          '{"format":"kaizen-builder-project","version":999}',
        ),
      },
    ])
      await expect(
        openProjectBackup(new Blob([zipSync(files) as BlobPart]), () => {}),
      ).rejects.toThrow();
    // Forge only the declared expanded size; the reader must reject before allocating it.
    const oversized = zipSync({ "project.json": strToU8("{}") });
    const header = new DataView(
      oversized.buffer,
      oversized.byteOffset,
      oversized.byteLength,
    );
    for (let offset = 0; offset + 28 < oversized.length; offset++)
      if (header.getUint32(offset, true) === 0x02014b50)
        header.setUint32(offset + 24, 50 * 1024 * 1024 + 1, true);
    await expect(
      openProjectBackup(new Blob([oversized as BlobPart]), () => {}),
    ).rejects.toThrow(/size limits/);
    const workspace = libraryFixture();
    const malformed = clone(workspace);
    malformed.assets[0].favourite = "yes" as any;
    expect(() => validateBackupWorkspace(malformed)).toThrow(/metadata/);
    workspace.pages[0].draft.data.content[0].type = "UnreviewedCode" as any;
    expect(() => validateBackupWorkspace(workspace)).toThrow();
  });
  it("restores a three-page site into an empty workspace without activating old publications", () => {
    const backup = libraryFixture(),
      empty = { pages: [], assets: clone(backup.assets), saved: [] };
    const restored = applyRestorePlan(empty, makeRestorePlan(empty, backup));
    expect(restored.pages.map((page) => page.draft)).toEqual(
      backup.pages.map((page) => page.draft),
    );
    expect(
      restored.pages.every((page) => !page.published && page.version === 1),
    ).toBe(true);
    expect(restored.site!.published).toBeNull();
    expect(restored.site!.draft).toEqual(backup.site!.draft);
    expect(restored.saved).toEqual(backup.saved);
    expect(
      restored.pages[0].revisions.some(
        (item) => item.label === "Published snapshot from backup",
      ),
    ).toBe(true);
  });
  it("restores matching drafts, preserves live snapshots, unrelated pages and the pre-restore revision", () => {
    const backup = libraryFixture(),
      current = clone(backup);
    current.pages[0].draft.title = "Current draft";
    current.site!.draft.theme.accent = "#112233";
    const unrelated = clone(current.pages[1]);
    unrelated.id = crypto.randomUUID();
    unrelated.draft.slug = "unrelated";
    unrelated.published = null;
    current.pages.push(unrelated);
    const restored = applyRestorePlan(
      current,
      makeRestorePlan(current, backup),
    );
    expect(restored.pages).toHaveLength(4);
    expect(restored.pages[0].draft.title).toBe(backup.pages[0].draft.title);
    expect(restored.pages[0].published).toEqual(current.pages[0].published);
    expect(restored.site!.published).toEqual(current.site!.published);
    expect(restored.pages[0].revisions.slice(-2)[0].document.title).toBe(
      "Current draft",
    );
    expect(restored.pages[3]).toEqual(unrelated);
    const revision = restored.pages[0].revisions.slice(-2)[0];
    expect(
      savePage(
        restored.pages,
        revision.document,
        restored.pages[0].id,
        restored.pages[0].version,
      ).draft.title,
    ).toBe("Current draft");
  });
  it("rejects stale reviews and URL collisions before changing any draft", () => {
    const current = libraryFixture(),
      backup = clone(current),
      plan = makeRestorePlan(current, backup);
    current.pages[0].version++;
    expect(() => applyRestorePlan(current, plan)).toThrow(/workspace changed/);
    backup.pages[0].id = crypto.randomUUID();
    expect(() => makeRestorePlan(current, backup)).toThrow(
      /belongs to another page/,
    );
  });
});
