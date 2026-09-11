import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CompanionSessions } from "../../scripts/builder-companion";
import { LocalProjects } from "../../scripts/builder-projects";
import { RepositoryCompanion } from "../../scripts/builder-repository";
import { SourceDrafts } from "../../scripts/builder-source-drafts";

const identity = {
  origin: "https://kaizenweb.co.uk",
  accountId: "account-one",
  projectId: "kaizen",
  projectName: "Client one",
};
async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kaizen-companion-unit-"),
  );
  const root = path.join(directory, "checkout");
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: {
        astro: "7.3.2",
        react: "19.2.4",
        "@astrojs/react": "6.0.5",
      },
    }),
  );
  await writeFile(
    path.join(root, "src/pages/index.astro"),
    "<main><h1>Original</h1></main>",
  );
  const projects = new LocalProjects(path.join(directory, "private"));
  return { directory, root, projects };
}
describe("paired local repository capabilities", () => {
  it("persists separate account/project draft identities and keeps original workspace intact", async () => {
    const { root, projects } = await fixture();
    const sessions = new CompanionSessions(projects);
    const one = await sessions.connect(identity, root);
    const same = await new CompanionSessions(
      new LocalProjects(projects.root),
    ).connect(identity, root);
    const other = await sessions.connect(
      { ...identity, accountId: "account-two" },
      root,
    );
    const projectTwo = await sessions.connect(
      { ...identity, projectId: "project-two" },
      root,
    );
    expect(one.projectId).toBe(same.projectId);
    expect(
      new Set([one.projectId, other.projectId, projectTwo.projectId, "kaizen"])
        .size,
    ).toBe(4);
    const inspection = await new RepositoryCompanion().inspectSourcePage(
      root,
      "src/pages/index.astro",
    );
    const edits = {
      inspection,
      values: { [inspection.fields[0].id]: "Private draft" },
      orders: {},
    };
    await new SourceDrafts(projects.directory(one.projectId)).save(
      root,
      inspection.route,
      0,
      edits,
    );
    expect(
      (
        await new SourceDrafts(projects.directory(same.projectId)).read(
          root,
          inspection.route,
        )
      ).edits,
    ).toEqual(edits);
    expect(
      (
        await new SourceDrafts(projects.directory(other.projectId)).read(
          root,
          inspection.route,
        )
      ).edits,
    ).toBeNull();
    expect((await projects.require("kaizen")).destination.kind).toBe(
      "legacy-local",
    );
    expect(await readFile(path.join(root, inspection.route), "utf8")).toContain(
      "Original",
    );
  });
  it("restricts roots, nested inspections, review IDs, accounts and expiry", async () => {
    const { root, projects, directory } = await fixture();
    let now = Date.now();
    const sessions = new CompanionSessions(projects, () => now);
    const one = await sessions.connect(identity, root);
    const two = await sessions.connect(identity, root);
    const auth = (
      request: Record<string, unknown>,
      token = one.token,
      project = one.projectId,
    ) => sessions.authorize(token, project, request);
    expect(auth({ action: "repository-inspect-current" }).input.root).toBe(
      root,
    );
    for (const request of [
      { action: "repository-inspect", root: directory },
      {
        action: "repository-source-prepare",
        edits: { inspection: { root: directory } },
      },
      {
        action: "repository-source-draft-save",
        root,
        edits: { inspection: { root: directory } },
      },
      { action: "publish" },
      { action: "save-page" },
      { action: "repository-apply", planId: "unreviewed" },
    ])
      expect(() => auth(request)).toThrow();
    const authorized = auth({ action: "repository-inspect", root });
    for (const [review, apply, idKey] of [
      ["repository-source-prepare", "repository-apply", "planId"],
      ["repository-build-review", "repository-build-start", "planId"],
      ["repository-build-start", "repository-build-status", "jobId"],
      [
        "repository-native-backup-review",
        "repository-native-backup-download",
        "reviewId",
      ],
      [
        "repository-native-restore-review",
        "repository-native-restore-apply",
        "reviewId",
      ],
    ]) {
      sessions.record(authorized.session, review, { id: review });
      expect(() => auth({ action: apply, [idKey]: review })).not.toThrow();
      expect(() => auth({ action: apply, [idKey]: review }, two.token)).toThrow(
        "Review",
      );
    }
    expect(() =>
      auth({ action: "repository-inspect", root }, one.token, "kaizen"),
    ).toThrow("expired");
    sessions.revoke(one.token);
    expect(() => auth({ action: "repository-inspect", root })).toThrow(
      "disconnected",
    );
    now += 2 * 60 * 60 * 1000;
    expect(() =>
      auth({ action: "repository-inspect", root }, two.token),
    ).toThrow("expired");
  });
  it("rejects unapproved origins and linked roots and reserves only a new restore folder", async () => {
    const { root, projects, directory } = await fixture();
    const sessions = new CompanionSessions(projects);
    await expect(
      sessions.connect(
        { ...identity, origin: "https://attacker.example" },
        root,
      ),
    ).rejects.toThrow("not approved");
    await expect(sessions.connect(identity, "relative")).rejects.toThrow(
      "absolute",
    );
    await expect(sessions.connect(identity, root, true)).rejects.toThrow(
      "already exist",
    );
    const link = path.join(directory, "linked");
    await symlink(
      root,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(sessions.connect(identity, link)).rejects.toThrow(
      "real folder",
    );
    expect(
      (await sessions.connect(identity, path.join(directory, "restored"), true))
        .root,
    ).toBe(path.join(directory, "restored"));
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => sessions.connect(identity, root)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(7);
  });
});
