import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RepositoryCompanion } from "../../scripts/builder-repository";
const exec = promisify(execFile),
  roots: string[] = [];
const git = async (root: string, ...args: string[]) =>
  (await exec("git", ["-C", root, ...args])).stdout;
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture(withGit = true) {
  const root = await mkdtemp(path.join(tmpdir(), "kaizen-git-test-"));
  roots.push(root);
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
    }),
  );
  await writeFile(path.join(root, "src/pages/index.astro"), "<h1>Before</h1>");
  await writeFile(path.join(root, "unrelated.txt"), "Unrelated original");
  if (withGit) {
    await git(root, "init", "-b", "main");
    await git(root, "config", "user.name", "Fixture User");
    await git(root, "config", "user.email", "fixture@example.invalid");
    await git(
      root,
      "add",
      "--",
      "package.json",
      "src/pages/index.astro",
      "unrelated.txt",
    );
    await git(root, "commit", "-m", "Initial fixture");
  }
  return root;
}
async function applied(root: string) {
  const repo = new RepositoryCompanion(),
    inspection = await repo.inspectSourcePage(root, "src/pages/index.astro");
  const plan = await repo.prepareSource("fixture", {
    inspection,
    values: { [inspection.fields[0].id]: "After" },
    orders: {},
  });
  await repo.apply(plan.id, "fixture");
  return { repo, plan };
}
describe("M4 applied-file commits", () => {
  it("commits exactly the applied files, leaves unrelated dirty files and rejects repeat/foreign commits", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "unrelated.txt"), "Unrelated dirty work");
    const { repo, plan } = await applied(root);
    const status = await repo.gitStatus(root);
    expect(status.branch).toBe("main");
    expect(status.inProgress).toBe(false);
    await expect(
      repo.commit(plan.id, "other", "Wrong project"),
    ).rejects.toThrow("this project");
    const result = await repo.commit(
      plan.id,
      "fixture",
      "M4-T2: Change heading",
    );
    expect(result.commit).toMatch(/^[a-f0-9]{40,64}$/);
    expect(
      (
        await git(
          root,
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          "HEAD",
        )
      ).trim(),
    ).toBe("src/pages/index.astro");
    expect(await git(root, "show", "HEAD:unrelated.txt")).toBe(
      "Unrelated original",
    );
    expect(await readFile(path.join(root, "unrelated.txt"), "utf8")).toBe(
      "Unrelated dirty work",
    );
    await expect(repo.commit(plan.id, "fixture", "Again")).rejects.toThrow(
      "already committed",
    );
  });
  it("refuses existing staging, changed applied bytes, merge state and missing identity", async () => {
    const root = await fixture();
    const { repo, plan } = await applied(root);
    await writeFile(path.join(root, "unrelated.txt"), "Staged elsewhere");
    await git(root, "add", "--", "unrelated.txt");
    await expect(repo.commit(plan.id, "fixture", "No")).rejects.toThrow(
      "already staged",
    );
    await git(root, "reset", "--", "unrelated.txt");
    await writeFile(
      path.join(root, ".git/MERGE_HEAD"),
      "0123456789012345678901234567890123456789",
    );
    await expect(repo.commit(plan.id, "fixture", "No")).rejects.toThrow(
      "merge or rebase",
    );
    await rm(path.join(root, ".git/MERGE_HEAD"));
    await git(root, "config", "user.email", "");
    await expect(repo.commit(plan.id, "fixture", "No")).rejects.toThrow(
      "GitHub Desktop",
    );
    await git(root, "config", "user.email", "fixture@example.invalid");
    await writeFile(
      path.join(root, "src/pages/index.astro"),
      "<h1>Developer change</h1>",
    );
    await expect(repo.commit(plan.id, "fixture", "No")).rejects.toThrow(
      "Changed since apply",
    );
  });
  it("reports a non-Git folder without using an ancestor repository", async () => {
    const root = await fixture(false);
    expect(await new RepositoryCompanion().gitStatus(root)).toEqual({
      isRepository: false,
      files: [],
      inProgress: false,
    });
  });
});
