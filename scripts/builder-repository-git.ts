import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);
const git = async (root: string, args: string[]) =>
  (
    await exec("git", ["--literal-pathspecs", "-C", root, ...args], {
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
        GIT_INDEX_FILE: undefined,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
      },
    })
  ).stdout;
export type RepositoryGitStatus = {
  isRepository: boolean;
  branch?: string;
  files: { file: string; status: string }[];
  lastCommit?: string;
  inProgress: boolean;
};
export async function repositoryGitStatus(
  root: string,
): Promise<RepositoryGitStatus> {
  let top: string;
  try {
    top = (await git(root, ["rev-parse", "--show-toplevel"])).trim();
  } catch (e) {
    if (e.code === "ENOENT")
      throw new Error("Install Git or GitHub Desktop to use commits.");
    return { isRepository: false, files: [], inProgress: false };
  }
  if ((await realpath(top)) !== (await realpath(root)))
    return { isRepository: false, files: [], inProgress: false };
  const branch = (
    await git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(
      () => "Detached HEAD",
    )
  ).trim();
  const lastCommit = (
    await git(root, ["log", "-1", "--format=%h %s"]).catch(() => "")
  ).trim();
  const entries = (
    await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
  ).split("\0");
  const files: RepositoryGitStatus["files"] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    files.push({ status: entry.slice(0, 2), file: entry.slice(3) });
    if (/[RC]/.test(entry.slice(0, 2))) i++;
  }
  let inProgress = false;
  for (const name of [
    "MERGE_HEAD",
    "REBASE_HEAD",
    "rebase-merge",
    "rebase-apply",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "sequencer",
  ]) {
    const location = (
      await git(root, ["rev-parse", "--git-path", name])
    ).trim();
    if (await lstat(path.resolve(root, location)).catch(() => null))
      inProgress = true;
  }
  return { isRepository: true, branch, files, lastCommit, inProgress };
}

export async function commitRepositoryFiles(
  root: string,
  files: string[],
  message: string,
) {
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000 ||
    message.includes("\0")
  )
    throw new Error("Enter a commit message of up to 2,000 characters.");
  const status = await repositoryGitStatus(root);
  if (!status.isRepository)
    throw new Error(
      "This folder is not a Git repository. Add it in GitHub Desktop first.",
    );
  if (status.inProgress)
    throw new Error(
      "Finish the merge or rebase in GitHub Desktop before committing here.",
    );
  if (status.branch === "Detached HEAD")
    throw new Error("Choose a branch in GitHub Desktop before committing.");
  if ((await git(root, ["diff", "--cached", "--name-only", "-z"])).length)
    throw new Error(
      "Files are already staged. Commit or unstage them in GitHub Desktop before committing these changes.",
    );
  for (const key of ["user.name", "user.email"])
    if (!(await git(root, ["config", "--get", key]).catch(() => "")).trim())
      throw new Error(
        "Set your Git name and email in GitHub Desktop before committing.",
      );
  if (!files.length) throw new Error("Apply some changes before committing.");
  // Explicit pathspecs: no add -A, no push, no amend, and no caller-supplied Git arguments.
  await git(root, ["add", "--", ...files]);
  try {
    if (!(await git(root, ["diff", "--cached", "--name-only", "-z"])).length)
      throw new Error("There are no applied changes left to commit.");
    await git(root, ["commit", "--only", "-m", message.trim(), "--", ...files]);
    return {
      commit: (await git(root, ["rev-parse", "HEAD"])).trim(),
      message:
        "Changes committed. Next: push in GitHub Desktop. The site deploys as it normally does.",
    };
  } catch (e) {
    throw new Error(
      `Commit did not finish: ${e.stderr || e.message}. Your applied files are kept; review the staged files in GitHub Desktop.`,
    );
  }
}
