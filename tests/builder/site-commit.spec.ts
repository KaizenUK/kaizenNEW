import { test, expect } from "./browser-fixture";
import { siteFixture } from "./site-fixture";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);
test.use({ actionTimeout: 10000 });
test("M4: apply and commit from the editor keeps unrelated work uncommitted", async ({
  page,
}) => {
  const fixture = await siteFixture(
    page,
    "<html><head><title>Commit garden</title></head><body><h1>Garden before</h1></body></html>",
  );
  const { root } = fixture;
  const git = async (...args: string[]) =>
    (await exec("git", ["-C", root, ...args])).stdout;
  try {
    await git("init", "-b", "main");
    await git("config", "user.name", "Fixture User");
    await git("config", "user.email", "fixture@example.invalid");
    await git("add", "--", "src", "public", "package.json", "build.mjs");
    await git("commit", "-m", "Initial fixture");
    await writeFile(path.join(root, "unrelated.txt"), "Keep this dirty file");
    await fixture.open();
    const frame = page.frameLocator('iframe[title="Website canvas"]');
    const heading = frame.getByRole("heading");
    await heading.dblclick();
    await heading.fill("Garden after");
    await expect(page.getByLabel("Source editing draft")).toContainText(
      "Edits saved on this computer",
    );
    await page
      .getByRole("button", { name: "Review my changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply changes to the folder", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Commit these changes", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Commit message").fill("M4-T3: Update garden");
    await page
      .getByRole("button", { name: "Commit these changes", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Changes committed" }),
    ).toBeVisible();
    expect(
      (
        await git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
      ).trim(),
    ).toBe("src/pages/index.astro");
    expect(await git("status", "--porcelain")).toContain("?? unrelated.txt");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
