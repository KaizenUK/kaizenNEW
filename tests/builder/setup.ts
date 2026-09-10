import { mkdir, writeFile } from "node:fs/promises";
import { contentFixture } from "./content-fixture";
export default async function setup() {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/builder-cms-source.json",
    JSON.stringify(contentFixture),
  );
}
