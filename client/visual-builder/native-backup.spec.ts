import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { NativeRepositoryBackups } from "../../scripts/builder-native-backup";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { SourceDrafts } from "../../scripts/builder-source-drafts";

describe("native repository backup and restore", () => {
  it("restores independent source, assets and only the selected project drafts with environment values excluded", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "kaizen-native-backup-"));
    const root = path.join(parent, "original");
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await mkdir(path.join(root, "public"));
    await mkdir(path.join(root, "node_modules"));
    await mkdir(path.join(root, ".git"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          astro: "6.4.8",
          "@astrojs/react": "5.0.0",
          react: "19.2.4",
        },
        scripts: { build: "astro build" },
      }),
    );
    const source =
      '<h1>Original source</h1><img src="/asset.svg" alt="Native asset"/>';
    await writeFile(path.join(root, "src/pages/index.astro"), source);
    await writeFile(
      path.join(root, "public/asset.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(
      path.join(root, ".env"),
      "API_SECRET=fake-server-secret\nPUBLIC_SITE_URL=https://example.com\n",
    );
    await writeFile(
      path.join(root, "service-account.json"),
      "fake-private-key",
    );
    await writeFile(path.join(root, ".git/config"), "fake-git-token");
    await writeFile(path.join(root, "node_modules/ignored.js"), "not portable");
    const alpha = path.join(parent, "alpha"),
      beta = path.join(parent, "beta");
    const companion = new RepositoryCompanion();
    const inspection = await companion.inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    const field = inspection.fields.find(
      (field) => field.value === "Original source",
    )!;
    await new SourceDrafts(alpha).save(root, inspection.route, 0, {
      inspection,
      values: { [field.id]: "Pending alpha edit" },
      orders: {},
    });
    await new SourceDrafts(beta).save(root, inspection.route, 0, {
      inspection,
      values: { [field.id]: "Private beta edit" },
      orders: {},
    });
    const backups = new NativeRepositoryBackups();
    const review = await backups.capture(root, "alpha", alpha);
    expect(review.draftCount).toBe(1);
    expect(review.environmentNames).toEqual(["API_SECRET", "PUBLIC_SITE_URL"]);
    expect(review.excluded).toEqual(
      expect.arrayContaining([
        ".env",
        ".git",
        "node_modules",
        "service-account.json",
      ]),
    );
    expect(() => backups.download(review.id, "beta")).toThrow(
      "another project",
    );
    const archive = Buffer.from(backups.download(review.id, "alpha"), "base64");
    const files = unzipSync(archive);
    const all = Object.values(files)
      .map((bytes) => strFromU8(bytes))
      .join("\n");
    for (const secret of [
      "fake-server-secret",
      "fake-private-key",
      "fake-git-token",
      "Private beta edit",
      root,
    ])
      expect(all).not.toContain(secret);
    expect(strFromU8(files["repository/src/pages/index.astro"])).toBe(source);
    expect(strFromU8(files["RESTORE.md"])).toContain(
      "Environment variable names",
    );
    const target = path.join(parent, "restored");
    const plan = await backups.reviewRestore(target, "beta", archive);
    await expect(backups.restore(plan.id, "alpha", alpha)).rejects.toThrow(
      "another project",
    );
    await backups.restore(plan.id, "beta", beta);
    expect(
      await readFile(path.join(target, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
    expect(
      await readFile(path.join(target, "public/asset.svg"), "utf8"),
    ).toContain("<svg");
    expect(await readdir(target)).not.toContain(".git");
    const restored = await new SourceDrafts(beta).read(
      target,
      inspection.route,
    );
    expect(restored.edits!.inspection.root).toBe(target);
    expect(restored.edits!.values[field.id]).toBe("Pending alpha edit");
    const apply = await companion.prepareSource("beta", restored.edits!);
    await companion.apply(apply.id, "beta");
    expect(
      await readFile(path.join(target, "src/pages/index.astro"), "utf8"),
    ).toContain("Pending alpha edit");
    expect(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
    ).toBe(source);
    expect(
      (await new SourceDrafts(beta).read(root, inspection.route)).edits!.values[
        field.id
      ],
    ).toBe("Private beta edit");
    await expect(backups.reviewRestore(root, "alpha", archive)).rejects.toThrow(
      "new folder",
    );
    const raceRoot = path.join(parent, "race");
    const race = await backups.reviewRestore(raceRoot, "alpha", archive);
    await mkdir(raceRoot);
    await writeFile(path.join(raceRoot, "keep.txt"), "User work");
    await expect(backups.restore(race.id, "alpha", alpha)).rejects.toThrow(
      "new folder",
    );
    expect(await readFile(path.join(raceRoot, "keep.txt"), "utf8")).toBe(
      "User work",
    );
    const tampered = {
      ...files,
      "repository/src/pages/index.astro": strToU8("Tampered"),
    };
    await expect(
      backups.reviewRestore(
        path.join(parent, "tampered"),
        "alpha",
        zipSync(tampered),
      ),
    ).rejects.toThrow("checksum");
    await expect(
      backups.reviewRestore(
        path.join(parent, "unsafe"),
        "alpha",
        zipSync({ ...files, "repository/../escape.txt": strToU8("No") }),
      ),
    ).rejects.toThrow("Unsafe");
    await expect(
      backups.reviewRestore(
        path.join(parent, "unexpected"),
        "alpha",
        zipSync({ ...files, "unexpected.txt": strToU8("No") }),
      ),
    ).rejects.toThrow("Unexpected entry");
    const manifest = JSON.parse(strFromU8(files["native-project.json"]));
    manifest.drafts[0].edits.inspection.fields = [null];
    await expect(
      backups.reviewRestore(
        path.join(parent, "invalid-draft"),
        "alpha",
        zipSync({
          ...files,
          "native-project.json": strToU8(JSON.stringify(manifest)),
        }),
      ),
    ).rejects.toThrow("inspection");
  });
});
