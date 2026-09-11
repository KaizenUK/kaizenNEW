import { test, expect } from "./browser-fixture";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { LocalProjects } from "../../scripts/builder-projects";
import {
  newDocument,
  starterBlocks,
} from "../../client/visual-builder/starters";
import {
  bindClientStore,
  stageRelease,
  initialiseStore,
} from "../../scripts/kaizen-releases.mjs";

test("Unity browses retained release pages, keeps recovery visible and reviews an older rollback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.request.post("/__builder-projects", {
    headers: { "X-Kaizen-Builder": "1" },
    data: { action: "create", name: "Release history fixture" },
  });
  expect(response.ok()).toBe(true);
  const project = await response.json(),
    destinationId = randomUUID();
  const document = newDocument("Home", "home", false);
  document.data.content = [starterBlocks.Footer(), starterBlocks.ContactForm()];
  expect(
    (
      await page.request.post(`/__builder-local?project=${project.id}`, {
        headers: { "X-Kaizen-Builder": "1" },
        data: { action: "save", id: randomUUID(), version: 0, document },
      })
    ).ok(),
  ).toBe(true);
  const projects = new LocalProjects(
    path.resolve("test-results/builder-browser-workspace"),
  );
  const directory = path.join(projects.directory(project.id), "publication");
  await mkdir(directory, { recursive: true });
  const root = await mkdtemp(path.resolve("test-results/history-fixture-")),
    source = path.join(root, "initial"),
    store = path.join(root, "store");
  await mkdir(source);
  await writeFile(
    path.join(source, "index.html"),
    "<!doctype html><h1>History fixture</h1>",
  );
  const destination = {
    projectId: project.id,
    destinationId,
    environment: "production",
    origin: "https://history-fixture.example",
    label: "History production",
  };
  const { label: _label, ...identity } = destination;
  await bindClientStore({ store, client: identity });
  await stageRelease({ store, source, client: identity, id: "initial" });
  await stageRelease({ store, source, client: identity, id: "older" });
  await initialiseStore({ store, id: "initial" });
  const registry = path.resolve(
      "test-results/builder-client-destinations.json",
    ),
    originalRegistry = await readFile(registry, "utf8");
  const configured = JSON.parse(originalRegistry);
  configured.destinations.push({ ...destination, store });
  const jobs = Array.from({ length: 125 }, (_, index) => ({
    id: randomUUID(),
    destination,
    action: "unpublish",
    phase: index >= 123 ? "live" : index === 0 ? "recovery_required" : "failed",
    createdAt: new Date(Date.UTC(2026, 0, 1) - index * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    previousReleaseId: "initial",
    artifactId: "initial",
    active: false,
    log: `Retained fixture release ${index}`,
  }));
  const indexFile = path.join(directory, "index.json"),
    state = {
      schemaVersion: 1,
      jobs,
      active: { [destinationId]: jobs[124].id },
    };
  jobs[123].artifactId = "older";
  await writeFile(indexFile, JSON.stringify(state));
  for (const job of jobs.slice(123))
    await writeFile(path.join(directory, `${job.id}.snapshot.json`), "null");
  await writeFile(registry, JSON.stringify(configured));
  try {
    await page.goto(`/builder/?project=${project.id}`);
    await page.getByRole("button", { name: "Releases", exact: true }).click();
    await expect(
      page.getByText("History page 1.", { exact: false }),
    ).toBeVisible();
    const pending = page.locator(`[data-release-id="${jobs[0].id}"]`);
    await expect(pending).toContainText("Recovery needs attention");
    await page
      .getByRole("button", { name: "Older releases", exact: true })
      .click();
    await expect(
      page.getByText("History page 2.", { exact: false }),
    ).toBeVisible();
    await expect(pending).toContainText("Recovery needs attention");
    await page
      .getByRole("button", { name: "Older releases", exact: true })
      .click();
    await expect(
      page.getByText("History page 3.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Older releases", exact: true }),
    ).toBeDisabled();
    const retained = page.locator(`[data-release-id="${jobs[123].id}"]`);
    await expect(
      retained.getByRole("button", { name: "Review restoring this release" }),
    ).toBeDisabled();
    jobs[0].phase = "failed";
    await writeFile(indexFile, JSON.stringify(state));
    await page.getByRole("button", { name: "Refresh release status" }).click();
    await expect(
      retained.getByRole("button", { name: "Review restoring this release" }),
    ).toBeEnabled();
    await retained
      .getByRole("button", { name: "Review restoring this release" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review rollback", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel review" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Newer releases", exact: true })
      .click();
    await expect(
      page.getByText("History page 2.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Latest releases", exact: true })
      .click();
    await expect(
      page.getByText("History page 1.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Choose destination" })
      .selectOption(destinationId);
    await page
      .getByRole("button", { name: "Review saved project for publication" })
      .click();
    const checks = page.getByRole("region", { name: "Publication checks" });
    await expect(checks).toContainText("Link /contact/ has no page");
    await expect(checks).toContainText("no receiving service");
    await page.getByRole("button", { name: "Cancel review" }).click();
    expect(errors).toEqual([]);
  } finally {
    await writeFile(registry, originalRegistry);
  }
});
