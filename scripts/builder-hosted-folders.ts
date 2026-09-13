import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { validProjectId } from "../shared/builderProjects";
import { HostedHelperError, accountId } from "./builder-hosted-auth";
import type { RepositorySaveTarget } from "../shared/builderRepositorySave";
import type { RepositoryPublishTarget } from "../shared/builderRepositoryPublish";
import type { RepositoryGitCommand } from "./builder-repository-git";
import { HostedDiskGuard, type HostedDiskLimits } from "./builder-hosted-disk";

const exec = promisify(execFile);
export type HostedProjectRepository = {
  projectId: string;
  repositoryUrl: string;
  branch: string;
  saveToWebsite?: RepositorySaveTarget;
  publishToWebsite?: RepositoryPublishTarget;
};
export type HostedProjectConfiguration =
  | HostedProjectRepository
  | { projectId: string; setup: true };
const configurationError = () =>
  new HostedHelperError(
    503,
    "The hosted website folder needs an operator configuration check.",
  );
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function hostedProjectRepositories(
  value: unknown,
): HostedProjectConfiguration[] {
  const input = value as { version?: unknown; projects?: unknown };
  if (
    input?.version !== 1 ||
    !Array.isArray(input.projects) ||
    input.projects.length > 1000
  )
    throw configurationError();
  const seen = new Set<string>();
  return input.projects.map((item: any) => {
    if (item?.setup === true) {
      if (
        !validProjectId(item.projectId) ||
        seen.has(item.projectId) ||
        Object.keys(item).some((key) => !["projectId", "setup"].includes(key))
      )
        throw configurationError();
      seen.add(item.projectId);
      return { projectId: item.projectId, setup: true as const };
    }
    if (
      !item ||
      typeof item.projectId !== "string" ||
      !validProjectId(item.projectId) ||
      seen.has(item.projectId) ||
      typeof item.repositoryUrl !== "string" ||
      item.repositoryUrl.length > 2000 ||
      !/^git@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\.git$/.test(
        item.repositoryUrl,
      ) ||
      item.repositoryUrl.includes("..") ||
      typeof item.branch !== "string" ||
      item.branch.length > 200 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(item.branch) ||
      item.branch
        .split("/")
        .some(
          (part: string) =>
            !part ||
            part.startsWith(".") ||
            part.endsWith(".") ||
            part.endsWith(".lock"),
        ) ||
      item.branch.includes("..")
    )
      throw configurationError();
    seen.add(item.projectId);
    let saveToWebsite: RepositorySaveTarget | undefined;
    if (item.saveToWebsite !== undefined) {
      const save = item.saveToWebsite;
      let url: URL;
      try {
        url = new URL(save?.url);
      } catch {
        throw configurationError();
      }
      if (
        save.environment !== "staging" ||
        url.protocol !== "https:" ||
        url.origin !== save.url ||
        (save.workflow !== undefined &&
          (!/^git@github\.com:/.test(item.repositoryUrl) ||
            typeof save.workflow !== "string" ||
            !/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(save.workflow))) ||
        Object.keys(save).some(
          (key) => !["environment", "url", "workflow"].includes(key),
        )
      )
        throw configurationError();
      saveToWebsite = {
        environment: "staging",
        url: url.origin,
        ...(save.workflow ? { workflow: save.workflow } : {}),
      };
    }
    let publishToWebsite: RepositoryPublishTarget | undefined;
    if (item.publishToWebsite !== undefined) {
      const publish = item.publishToWebsite;
      let url: URL;
      try {
        url = new URL(publish?.url);
      } catch {
        throw configurationError();
      }
      // Reuse the same branch grammar without admitting another configuration or deployment target.
      hostedProjectRepositories({
        version: 1,
        projects: [
          {
            projectId: item.projectId,
            repositoryUrl: item.repositoryUrl,
            branch: publish.branch,
          },
        ],
      });
      if (
        !saveToWebsite ||
        publish.environment !== "production" ||
        publish.branch === item.branch ||
        url.protocol !== "https:" ||
        url.origin !== publish.url ||
        publish.url === saveToWebsite.url ||
        (publish.workflow !== undefined &&
          (!/^git@github\.com:/.test(item.repositoryUrl) ||
            typeof publish.workflow !== "string" ||
            !/^[a-zA-Z0-9_.-]+\.ya?ml$/.test(publish.workflow))) ||
        Object.keys(publish).some(
          (key) => !["environment", "branch", "url", "workflow"].includes(key),
        )
      )
        throw configurationError();
      publishToWebsite = {
        environment: "production",
        branch: publish.branch,
        url: url.origin,
        ...(publish.workflow ? { workflow: publish.workflow } : {}),
      };
    }
    return {
      projectId: item.projectId,
      repositoryUrl: item.repositoryUrl,
      branch: item.branch,
      ...(saveToWebsite ? { saveToWebsite } : {}),
      ...(publishToWebsite ? { publishToWebsite } : {}),
    };
  });
}

/** No symlink anywhere between the filesystem root and this service-owned path. */
export async function unlinkedPath(value: string) {
  if (
    !path.isAbsolute(value) ||
    path.resolve(value) !== value ||
    /[\u0000-\u001f]/.test(value)
  )
    throw configurationError();
  const parsed = path.parse(value);
  let current = parsed.root;
  for (const segment of value
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await lstat(current).catch((error) => {
      if (error.code !== "ENOENT") throw configurationError();
      return null;
    });
    if (stat?.isSymbolicLink()) throw configurationError();
  }
}
export async function privateDirectory(value: string) {
  await unlinkedPath(value);
  await mkdir(value, { recursive: true, mode: 0o700 });
  const stat = await lstat(value);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw configurationError();
}
export async function privateFile(value: string, maxBytes: number) {
  await unlinkedPath(value);
  const stat = await lstat(value).catch(() => {
    throw configurationError();
  });
  if (
    !stat.isFile() ||
    stat.nlink !== 1 ||
    !stat.size ||
    stat.size > maxBytes ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw configurationError();
}

export class HostedWebsiteFolders {
  readonly disk: HostedDiskGuard;
  private queue = new Map<string, { tail: Promise<unknown>; count: number }>();
  private configured: Map<string, HostedProjectConfiguration>;
  private initial: Map<string, HostedProjectConfiguration>;
  constructor(
    readonly directory: string,
    readonly credentialsDirectory: string,
    projects: HostedProjectConfiguration[],
    diskLimits?: HostedDiskLimits,
  ) {
    if (
      ![directory, credentialsDirectory].every(
        (item) => path.isAbsolute(item) && path.resolve(item) === item,
      ) ||
      [
        path.relative(directory, credentialsDirectory),
        path.relative(credentialsDirectory, directory),
      ].some(
        (relative) =>
          !relative ||
          (!relative.startsWith(`..${path.sep}`) &&
            relative !== ".." &&
            !path.isAbsolute(relative)),
      )
    )
      throw configurationError();
    this.configured = new Map(
      hostedProjectRepositories({ version: 1, projects }).map((item) => [
        item.projectId,
        item,
      ]),
    );
    this.initial = new Map(this.configured);
    this.disk = new HostedDiskGuard(directory, diskLimits);
  }
  admission(id: string) {
    const value = this.initial.get(id);
    if (!value)
      throw new HostedHelperError(
        404,
        "This project needs the operator to enable hosted repository setup.",
      );
    return value;
  }
  installConfiguration(
    id: string,
    repository: HostedProjectRepository | undefined,
  ) {
    this.admission(id);
    if (repository && repository.projectId !== id) throw configurationError();
    const next = hostedProjectRepositories({
      version: 1,
      projects: [repository || { projectId: id, setup: true }],
    })[0];
    this.configured.set(id, next);
  }
  configuration(id: string) {
    const configured = this.configured.get(id);
    if (!configured || "setup" in configured)
      throw new HostedHelperError(
        404,
        "This project's hosted website folder is not configured yet.",
      );
    return configured;
  }
  projectDirectory(id: string) {
    if (!validProjectId(id))
      throw new HostedHelperError(400, "Choose a valid project.");
    return path.join(this.directory, "projects", id);
  }
  root(id: string) {
    return path.join(this.projectDirectory(id), "checkout");
  }
  async draftsDirectory(id: string, actor: string) {
    if (!accountId(actor))
      throw new HostedHelperError(401, "Sign in to save an editing draft.");
    const directory = path.join(this.projectDirectory(id), "drafts", actor);
    await privateDirectory(directory);
    return directory;
  }
  async buildEnvironment(id: string): Promise<NodeJS.ProcessEnv> {
    const directory = this.projectDirectory(id);
    const home = path.join(directory, "build-home"),
      temporary = path.join(directory, "build-temp");
    await privateDirectory(home);
    await privateDirectory(temporary);
    // Only this subprocess receives a project-specific home. The service/user environment is unchanged.
    return {
      PATH: process.env.PATH,
      HOME: home,
      TMPDIR: temporary,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      npm_config_userconfig: "/dev/null",
      npm_config_globalconfig: "/dev/null",
    };
  }
  async assertNotBuilding(id: string) {
    this.projectDirectory(id);
    if (
      await lstat(path.join(this.directory, "locks", `${id}.build.lock`)).catch(
        (error) => {
          if (error.code !== "ENOENT") throw configurationError();
          return null;
        },
      )
    )
      throw new HostedHelperError(
        409,
        "A build owns this website folder. Wait for it to finish or cancel it before changing files. Ask the operator to inspect a lock left by a stopped service.",
      );
  }
  /** Called under the project lock; held until the process and output recovery have finished. */
  async claimBuild(id: string, jobId: string) {
    this.projectDirectory(id);
    const file = path.join(this.directory, "locks", `${id}.build.lock`);
    await this.assertNotBuilding(id);
    const handle = await open(file, "wx", 0o600);
    const identity = await handle.stat();
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, jobId }));
    } catch (error) {
      await handle.close();
      throw error;
    }
    return async () => {
      await handle.close();
      const current = await lstat(file).catch(() => null);
      if (current?.ino !== identity.ino || current?.dev !== identity.dev)
        throw new HostedHelperError(
          409,
          "The build lock changed. Ask the operator to inspect this website before changing files.",
        );
      await unlink(file);
    };
  }
  /** Queue within this process, exclusive file lock across processes. A crash never steals a lock. */
  async locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    if (!validProjectId(id))
      throw new HostedHelperError(400, "Choose a valid project.");
    let queue = this.queue.get(id);
    if (!queue) {
      queue = { tail: Promise.resolve(), count: 0 };
      this.queue.set(id, queue);
    }
    if (queue.count >= 16)
      throw new HostedHelperError(
        429,
        "This website has too many pending operations. Try again after they finish.",
      );
    queue.count++;
    const previous = queue.tail;
    const operation = previous
      .catch(() => {})
      .then(async () => {
        await privateDirectory(this.directory);
        await privateDirectory(path.join(this.directory, "locks"));
        const lockPath = path.join(this.directory, "locks", `${id}.lock`);
        const lock = await open(lockPath, "wx", 0o600).catch((error) => {
          if (error.code === "EEXIST")
            throw new HostedHelperError(
              409,
              "Another helper operation owns this website folder. Wait for it to finish; ask the operator to check a lock left by a stopped service.",
            );
          throw configurationError();
        });
        const identity = await lock.stat();
        try {
          await lock.writeFile(
            JSON.stringify({ pid: process.pid, id: randomUUID() }),
          );
          return await work();
        } finally {
          await lock.close();
          const current = await lstat(lockPath).catch(() => null);
          if (current?.ino === identity.ino && current?.dev === identity.dev)
            await unlink(lockPath);
        }
      });
    queue.tail = operation;
    try {
      return await operation;
    } finally {
      if (--queue.count === 0) this.queue.delete(id);
    }
  }
  async idle() {
    await Promise.allSettled(
      [...this.queue.values()].map((queue) => queue.tail),
    );
  }
  private async credentials(id: string) {
    await privateDirectory(this.credentialsDirectory);
    const directory = path.join(this.credentialsDirectory, id);
    await privateDirectory(directory);
    const key = path.join(directory, "deploy-key"),
      hosts = path.join(directory, "known_hosts");
    await privateFile(key, 64 * 1024);
    await privateFile(hosts, 1024 * 1024);
    return `ssh -F /dev/null -i ${shellQuote(key)} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${shellQuote(hosts)} -o GlobalKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ConnectionAttempts=1`;
  }
  private async git(
    cwd: string,
    args: string[],
    ssh?: string,
    raw = false,
    signal?: AbortSignal,
  ) {
    try {
      const result = (
        await exec(
          "git",
          [
            "--literal-pathspecs",
            "--no-replace-objects",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "push.followTags=false",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "gc.auto=0",
            "-c",
            "maintenance.auto=false",
            "-c",
            "credential.helper=",
            "-c",
            "submodule.recurse=false",
            "-c",
            "protocol.allow=never",
            "-c",
            "protocol.ssh.allow=always",
            "-C",
            cwd,
            ...args,
          ],
          {
            timeout: 90_000,
            signal,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              PATH: process.env.PATH,
              LANG: "C",
              LC_ALL: "C",
              GIT_CONFIG_NOSYSTEM: "1",
              GIT_CONFIG_GLOBAL: "/dev/null",
              GIT_TERMINAL_PROMPT: "0",
              GIT_OPTIONAL_LOCKS: "0",
              GIT_SSH_VARIANT: "ssh",
              ...(ssh ? { GIT_SSH_COMMAND: ssh } : {}),
            },
          },
        )
      ).stdout;
      return raw ? result : result.trim();
    } catch {
      // Git/SSH stderr may contain credentials, hostnames or private paths.
      throw new HostedHelperError(
        503,
        "The hosted repository operation failed. Ask the operator to check the repository, branch and deploy-key access. Existing website files are kept.",
      );
    }
  }
  async ensure(id: string) {
    const configured = this.configuration(id),
      project = this.projectDirectory(id),
      root = this.root(id);
    const identity = JSON.stringify({
      projectId: id,
      repositoryUrl: configured.repositoryUrl,
      branch: configured.branch,
    });
    await privateDirectory(path.join(this.directory, "projects"));
    await privateDirectory(project);
    const marker = path.join(project, "repository.json");
    const markerStat = await lstat(marker).catch((error) => {
      if (error.code !== "ENOENT") throw configurationError();
      return null;
    });
    if (markerStat) {
      await privateFile(marker, 4096);
      if ((await readFile(marker, "utf8")) !== identity)
        throw configurationError();
    } else {
      if (await lstat(root).catch(() => null)) throw configurationError();
      await writeFile(marker, identity, {
        flag: "wx",
        mode: 0o600,
      });
    }
    await unlinkedPath(root);
    const exists = await lstat(root).catch((error) => {
      if (error.code !== "ENOENT") throw configurationError();
      return null;
    });
    if (!exists) {
      const ssh = await this.credentials(id),
        temporary = path.join(project, `.clone-${randomUUID()}`);
      try {
        await this.disk.run(id, async (signal) =>
          this.git(
            project,
            [
              "clone",
              "--no-local",
              "--no-hardlinks",
              "--single-branch",
              "--branch",
              configured.branch,
              "--template=",
              "--config",
              "core.hooksPath=/dev/null",
              "--config",
              "core.fsmonitor=false",
              "--",
              configured.repositoryUrl,
              temporary,
            ],
            ssh,
            false,
            signal,
          ),
        );
        await rename(temporary, root);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
    await this.check(id);
    return root;
  }
  async check(id: string) {
    const root = this.root(id),
      configured = this.configuration(id);
    await unlinkedPath(root);
    await unlinkedPath(path.join(root, ".git", "config"));
    if (
      !(await lstat(root)).isDirectory() ||
      !(await lstat(path.join(root, ".git"))).isDirectory() ||
      !(await lstat(path.join(root, ".git/config"))).isFile() ||
      (await realpath(root)) !== root
    )
      throw configurationError();
    for (const item of ["commondir", "objects/info/alternates"])
      if (await lstat(path.join(root, ".git", item)).catch(() => null))
        throw configurationError();
    const config = await this.git(root, [
      "config",
      "--local",
      "--no-includes",
      "--null",
      "--list",
    ]);
    if (
      config
        .split("\0")
        .some((entry) =>
          /^(?:url\.|include\.|includeif\.)/i.test(entry.split("\n")[0]),
        )
    )
      throw configurationError();
    if (
      (await this.git(root, ["rev-parse", "--show-toplevel"])) !== root ||
      (await this.git(root, ["rev-parse", "--absolute-git-dir"])) !==
        path.join(root, ".git") ||
      (await this.git(root, ["config", "--get", "remote.origin.url"])) !==
        configured.repositoryUrl ||
      (await this.git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"])) !==
        configured.branch
    )
      throw configurationError();
    return root;
  }
  /** Only the authenticated service supplies commands; no request contains Git arguments or destinations. */
  localGit(id: string): RepositoryGitCommand {
    return async (cwd, args) => {
      if (cwd !== this.root(id)) throw configurationError();
      return this.git(cwd, args, undefined, true);
    };
  }
  async head(id: string) {
    return this.git(await this.check(id), ["rev-parse", "HEAD"]);
  }
  async remoteHead(id: string) {
    return this.remoteBranchHead(id, this.configuration(id).branch);
  }
  private async remoteBranchHead(id: string, branch: string) {
    const root = await this.check(id),
      configured = this.configuration(id);
    const value = await this.git(
      root,
      [
        "ls-remote",
        "--refs",
        "--",
        configured.repositoryUrl,
        `refs/heads/${branch}`,
      ],
      await this.credentials(id),
    );
    const [sha, ref, ...extra] = value.split(/\s+/);
    if (
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha) ||
      ref !== `refs/heads/${branch}` ||
      extra.length
    )
      throw new HostedHelperError(
        409,
        "The configured website branch is missing or changed. Ask the owner to check it before saving.",
      );
    return sha;
  }
  productionTarget(id: string) {
    const target = this.configuration(id).publishToWebsite;
    if (!target)
      throw new HostedHelperError(
        501,
        "Production publishing needs the operator to configure this website's destination.",
      );
    return target;
  }
  async productionHead(id: string) {
    return this.remoteBranchHead(id, this.productionTarget(id).branch);
  }
  async fetchProduction(id: string) {
    const root = await this.check(id),
      configured = this.configuration(id),
      target = this.productionTarget(id);
    // Fetch objects only; never move the website branch, checkout or user's index.
    await this.disk.run(id, async (signal) =>
      this.git(
        root,
        [
          "fetch",
          "--no-tags",
          "--no-write-fetch-head",
          "--no-recurse-submodules",
          "--",
          configured.repositoryUrl,
          `refs/heads/${target.branch}`,
        ],
        await this.credentials(id),
        false,
        signal,
      ),
    );
  }
  async publicationFiles(id: string, commit: string, base: string) {
    await this.assertPublicationAncestry(id, commit, base);
    const changed = await this.git(
      await this.check(id),
      [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-only",
        "-z",
        base,
        commit,
        "--",
      ],
      undefined,
      true,
    );
    const files = changed.split("\0").filter(Boolean);
    if (
      files.length > 500 ||
      files.some(
        (file) => file.length > 4096 || /[\u0000-\u001f\u007f]/.test(file),
      )
    )
      throw new HostedHelperError(
        409,
        "This publication is too large to review here. Ask the owner to reconcile the website branches.",
      );
    return files;
  }
  private async assertPublicationAncestry(
    id: string,
    commit: string,
    base: string,
  ) {
    const root = await this.check(id);
    if (
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit) ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(base) ||
      (await this.head(id)) !== commit
    )
      throw new HostedHelperError(
        409,
        "The reviewed website revision changed. Review staging again before publishing.",
      );
    const pending = [commit],
      seen = new Set<string>();
    // Actual object parents are authoritative, including merge commits. Grafts/replacement refs cannot make a rewrite look safe.
    while (pending.length && seen.size < 512) {
      const current = pending.shift()!;
      if (current === base) return;
      if (seen.has(current)) continue;
      seen.add(current);
      const parents = (await this.git(root, ["cat-file", "commit", current]))
        .split("\n\n", 1)[0]
        .split("\n")
        .filter((line) => line.startsWith("parent "))
        .map((line) => line.slice(7));
      if (
        parents.some(
          (parent) => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(parent),
        )
      )
        break;
      if (pending.length + parents.length > 1024) break;
      pending.push(...parents);
    }
    throw new HostedHelperError(
      409,
      "Production has work outside this staging revision, or its history needs an operator check. Reconcile the branches before publishing; no history will be replaced.",
    );
  }
  async pushPublication(
    id: string,
    commit: string,
    base: string,
    authorize: () => Promise<void>,
  ) {
    const target = this.productionTarget(id),
      configured = this.configuration(id);
    await this.assertPublicationAncestry(id, commit, base);
    const root = await this.check(id),
      ssh = await this.credentials(id);
    // Check again after walking the real history, directly before launching the push.
    await authorize();
    await this.git(
      root,
      [
        "push",
        "--porcelain",
        "--no-follow-tags",
        "--no-signed",
        "--recurse-submodules=no",
        `--force-with-lease=refs/heads/${target.branch}:${base}`,
        "--",
        configured.repositoryUrl,
        `${commit}:refs/heads/${target.branch}`,
      ],
      ssh,
    );
  }
  async pushCommit(id: string, commit: string, base: string) {
    const root = await this.check(id),
      configured = this.configuration(id);
    if (
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit) ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(base) ||
      (await this.git(root, ["rev-parse", "HEAD"])) !== commit ||
      // Read actual object headers: replacement refs and ancestry grafts must not disguise its parents.
      (await this.git(root, ["cat-file", "commit", commit]))
        .split("\n\n", 1)[0]
        .split("\n")
        .filter((line) => line.startsWith("parent "))
        .join("\n") !== `parent ${base}`
    )
      throw new HostedHelperError(
        409,
        "The saved commit no longer follows the reviewed branch. Ask the owner to reconcile the folder. Nothing was pushed.",
      );
    // The exact lease is a compare-and-swap, with a separately verified single-child fast-forward.
    // Never use a tracking ref as the lease or allow replacement/deletion of remote history.
    await this.git(
      root,
      [
        "push",
        "--porcelain",
        "--no-follow-tags",
        "--no-signed",
        "--recurse-submodules=no",
        `--force-with-lease=refs/heads/${configured.branch}:${base}`,
        "--",
        configured.repositoryUrl,
        `${commit}:refs/heads/${configured.branch}`,
      ],
      await this.credentials(id),
    );
  }
  async fetch(id: string) {
    const root = await this.check(id),
      configured = this.configuration(id),
      ssh = await this.credentials(id);
    await this.disk.run(id, async (signal) =>
      this.git(
        root,
        [
          "fetch",
          "--no-tags",
          "--prune",
          "--no-recurse-submodules",
          "origin",
          `+refs/heads/${configured.branch}:refs/remotes/origin/${configured.branch}`,
        ],
        ssh,
        false,
        signal,
      ),
    );
    return {
      root,
      branch: configured.branch,
      message:
        "Remote changes checked. Your website folder and open edits have not been replaced.",
    };
  }
}
