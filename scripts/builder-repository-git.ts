import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);
export type RepositoryGitCommand = (
  root: string,
  args: string[],
) => Promise<string>;
export type RepositoryCommitOptions = {
  git?: RepositoryGitCommand;
  identity?: { name: string; email: string };
  expectedHead?: string;
};
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
  run: RepositoryGitCommand = git,
): Promise<RepositoryGitStatus> {
  let top: string;
  try {
    top = (await run(root, ["rev-parse", "--show-toplevel"])).trim();
  } catch (e) {
    if (e.code === "ENOENT")
      throw new Error("Install Git or GitHub Desktop to use commits.");
    return { isRepository: false, files: [], inProgress: false };
  }
  if ((await realpath(top)) !== (await realpath(root)))
    return { isRepository: false, files: [], inProgress: false };
  const branch = (
    await run(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(
      () => "Detached HEAD",
    )
  ).trim();
  const lastCommit = (
    await run(root, ["log", "-1", "--format=%h %s"]).catch(() => "")
  ).trim();
  const entries = (
    await run(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
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
      await run(root, ["rev-parse", "--git-path", name])
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
  options: RepositoryCommitOptions = {},
) {
  const run: RepositoryGitCommand = options.identity
    ? (root, args) =>
        (options.git || git)(root, [
          "-c",
          `user.name=${options.identity!.name}`,
          "-c",
          `user.email=${options.identity!.email}`,
          ...args,
        ])
    : options.git || git;
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000 ||
    message.includes("\0")
  )
    throw new Error("Enter a commit message of up to 2,000 characters.");
  const status = await repositoryGitStatus(root, run);
  if (!status.isRepository)
    throw new Error(
      "This folder is not a Git repository. Add it in GitHub Desktop first.",
    );
  if (status.inProgress)
    throw new Error(
      options.git
        ? "The website folder has an unfinished merge or rebase. Ask the owner to finish it before saving."
        : "Finish the merge or rebase in GitHub Desktop before committing here.",
    );
  if (status.branch === "Detached HEAD")
    throw new Error("Choose a branch in GitHub Desktop before committing.");
  if ((await run(root, ["diff", "--cached", "--name-only", "-z"])).length)
    throw new Error(
      options.git
        ? "Files are already staged in the website folder. Ask the owner to review them before saving these changes."
        : "Files are already staged. Commit or unstage them in GitHub Desktop before committing these changes.",
    );
  for (const key of ["user.name", "user.email"])
    if (!(await run(root, ["config", "--get", key]).catch(() => "")).trim())
      throw new Error(
        "Set your Git name and email in GitHub Desktop before committing.",
      );
  if (!files.length) throw new Error("Apply some changes before committing.");
  if (
    options.expectedHead &&
    (await run(root, ["rev-parse", "HEAD"])).trim() !== options.expectedHead
  )
    throw new Error(
      "The website branch moved after these changes were applied. Ask the owner to reconcile the folder before saving.",
    );
  // Explicit pathspecs: no add -A, no push, no amend, and no caller-supplied Git arguments.
  await run(root, ["add", "--", ...files]);
  try {
    if (!(await run(root, ["diff", "--cached", "--name-only", "-z"])).length)
      throw new Error("There are no applied changes left to commit.");
    await run(root, ["commit", "--only", "-m", message.trim(), "--", ...files]);
    return {
      commit: (await run(root, ["rev-parse", "HEAD"])).trim(),
      message:
        "Changes committed. Next: push in GitHub Desktop. The site deploys as it normally does.",
    };
  } catch (e) {
    throw new Error(
      options.git
        ? "The commit did not finish. Your applied files are kept; ask the owner to inspect the staged files before retrying."
        : `Commit did not finish: ${e.stderr || e.message}. Your applied files are kept; review the staged files in GitHub Desktop.`,
    );
  }
}
