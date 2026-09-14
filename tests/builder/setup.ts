import { mkdir, rm, writeFile } from "node:fs/promises";
import { contentFixture } from "./content-fixture";
export default async function setup() {
  await mkdir("test-results", { recursive: true });
  // Only the fixed test workspace: repeated runs must not accumulate pages,
  // assets and palette entries from earlier fixtures or use personal drafts.
  await rm("test-results/builder-browser-workspace", {
    recursive: true,
    force: true,
  });
  await writeFile(
    "test-results/builder-client-destinations.json",
    JSON.stringify({ schemaVersion: 1, destinations: [] }),
  );
  await writeFile(
    "test-results/builder-cms-source.json",
    JSON.stringify(contentFixture),
  );
}
