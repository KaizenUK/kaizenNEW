import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { templateDocument } from "./starters";
import { exportProject } from "./exportProject";
import {
  sampleIllustrations,
  sampleIllustrationLicencePath,
} from "./sampleContent";
import { initialSiteDesign } from "../../shared/builderSite";

describe("starter sample provenance", () => {
  it("ships only the two original illustrations and their recorded permission in the import pack", async () => {
    const files = unzipSync(
      await readFile("public/builder-samples/starter-illustrations.zip"),
    );
    expect(Object.keys(files).sort()).toEqual([
      "icons/spark.svg",
      "images/landscape.svg",
      "licences/LICENCE-Kaizen-illustrations.txt",
    ]);
    for (const [name, url] of [
      ["images/landscape.svg", sampleIllustrations[0]],
      ["icons/spark.svg", sampleIllustrations[1]],
    ])
      expect(files[name]).toEqual(
        new Uint8Array(await readFile(`public${url}`)),
      );
    expect(
      await readFile(
        "client/visual-builder/sample-illustrations-licence.txt",
        "utf8",
      ),
    ).toBe(
      await readFile(
        "public/builder-samples/LICENCE-Kaizen-illustrations.txt",
        "utf8",
      ),
    );
    const licence = strFromU8(
      files["licences/LICENCE-Kaizen-illustrations.txt"],
    );
    expect(licence).toContain("You may use them in your Kaizen pages.");
    expect(licence).toBe(
      await readFile(
        "public/builder-samples/LICENCE-Kaizen-illustrations.txt",
        "utf8",
      ),
    );
  });
  it("exports the actual illustration bytes with checksum and licence, without classifying other media as Kaizen samples", async () => {
    const document = templateDocument("home");
    const result = await exportProject(
      [document],
      [],
      () => {},
      async (url) => {
        expect(sampleIllustrations).toContain(url);
        return new Uint8Array(await readFile(`public${url}`));
      },
      initialSiteDesign(),
    );
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    const samples = JSON.parse(strFromU8(files["sample-assets.json"]));
    expect(samples).toHaveLength(1);
    expect(samples[0].source).toBe(sampleIllustrations[0]);
    expect(samples[0].licence).toBe(sampleIllustrationLicencePath);
    expect(samples[0].sha256).toBe(
      createHash("sha256")
        .update(files[`public${samples[0].exportedUrl}`])
        .digest("hex"),
    );
    expect(strFromU8(files[sampleIllustrationLicencePath])).toContain(
      "You may use them in your Kaizen pages.",
    );
    expect(strFromU8(files["HANDOFF.md"])).toContain("sample-assets.json");
    const textOnly = templateDocument("services");
    const other = await exportProject(
      [textOnly],
      [],
      () => {},
      async () => {
        throw new Error("No sample download expected");
      },
      initialSiteDesign(),
    );
    const otherFiles = unzipSync(
      new Uint8Array(await other.blob.arrayBuffer()),
    );
    expect(otherFiles["sample-assets.json"]).toBeUndefined();
    expect(otherFiles[sampleIllustrationLicencePath]).toBeUndefined();
  });
});
