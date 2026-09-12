import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { sourceAssetPath } from "../../shared/builderSourceEditing";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe("M3 source image review", () => {
  it("reviews one copied image, deduplicates subsequent copies and rejects bytes or paths outside the proposal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "kaizen-source-image-"));
    roots.push(root);
    await mkdir(path.join(root, "src/pages"), { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
      }),
    );
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      '<img src="/images/original.svg" alt="Picture"><p>Original words</p>',
    );
    const bytes = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"></svg>',
      ),
      hash = createHash("sha256").update(bytes).digest("hex");
    const repo = new RepositoryCompanion(),
      inspection = await repo.inspectSourcePage(root, "src/pages/index.astro"),
      field = inspection.fields.find((f) => f.kind === "image")!;
    const assetPath = sourceAssetPath(field.value, "picture.svg", hash),
      asset = { fieldId: field.id, assetId: "fixture-image", path: assetPath };
    const edits = {
        inspection,
        values: { [field.id]: `/${assetPath.slice(7)}` },
        orders: {},
        assets: [asset],
      },
      media = [
        {
          assetId: asset.assetId,
          name: "picture.svg",
          base64: bytes.toString("base64"),
        },
      ];
    await expect(
      repo.prepareSource(
        "fixture",
        { ...edits, assets: [{ ...asset, path: "../outside.svg" }] },
        media,
      ),
    ).rejects.toThrow("changed");
    await expect(
      repo.prepareSource("fixture", edits, [
        { ...media[0], base64: Buffer.from("wrong bytes").toString("base64") },
      ]),
    ).rejects.toThrow("changed");
    const plan = await repo.prepareSource("fixture", edits, media);
    expect(
      plan.changes
        .filter((c) => c.action !== "unchanged")
        .map((c) => c.action)
        .sort(),
    ).toEqual(["create", "update"]);
    await repo.apply(plan.id, "fixture");
    expect(await readFile(path.join(root, assetPath))).toEqual(bytes);
    const next = await repo.inspectSourcePage(root, "src/pages/index.astro"),
      nextField = next.fields.find((f) => f.kind === "image")!;
    const repeated = await repo.prepareSource(
      "fixture",
      {
        inspection: next,
        values: { [nextField.id]: nextField.value },
        orders: {},
        assets: [{ ...asset, fieldId: nextField.id }],
      },
      media,
    );
    expect(repeated.changes.every((c) => c.action === "unchanged")).toBe(true);
    await repo.apply(repeated.id, "fixture");
    expect(await readdir(path.join(root, "public/images"))).toEqual([
      `${hash}.svg`,
    ]);
  });
});
