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

const exec = promisify(execFile);
export type HostedProjectRepository = {
  projectId: string;
  repositoryUrl: string;
  branch: string;
};
const configurationError = () =>
  new HostedHelperError(
    503,
    "The hosted website folder needs an operator configuration check.",
  );
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function hostedProjectRepositories(
  value: unknown,
): HostedProjectRepository[] {
  const input = value as { version?: unknown; projects?: unknown };
  if (
    input?.version !== 1 ||
    !Array.isArray(input.projects) ||
    input.projects.length > 1000
  )
    throw configurationError();
  const seen = new Set<string>();
  return input.projects.map((item: any) => {
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
    return {
      projectId: item.projectId,
      repositoryUrl: item.repositoryUrl,
      branch: item.branch,
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
async function privateDirectory(value: string) {
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
async function privateFile(value: string, maxBytes: number) {
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
  private queue = new Map<string, { tail: Promise<unknown>; count: number }>();
  private configured: Map<string, HostedProjectRepository>;
  constructor(
    readonly directory: string,
    readonly credentialsDirectory: string,
    projects: HostedProjectRepository[],
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
  }
  configuration(id: string) {
    const configured = this.configured.get(id);
    if (!configured)
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
  private async git(cwd: string, args: string[], ssh?: string) {
    try {
      return (
        await exec(
          "git",
          [
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "core.fsmonitor=false",
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
      ).stdout.trim();
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
    await privateDirectory(path.join(this.directory, "projects"));
    await privateDirectory(project);
    const marker = path.join(project, "repository.json");
    const markerStat = await lstat(marker).catch((error) => {
      if (error.code !== "ENOENT") throw configurationError();
      return null;
    });
    if (markerStat) {
      await privateFile(marker, 4096);
      if ((await readFile(marker, "utf8")) !== JSON.stringify(configured))
        throw configurationError();
    } else {
      if (await lstat(root).catch(() => null)) throw configurationError();
      await writeFile(marker, JSON.stringify(configured), {
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
        await this.git(
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
  async fetch(id: string) {
    const root = await this.check(id),
      configured = this.configuration(id),
      ssh = await this.credentials(id);
    await this.git(
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
    );
    return {
      root,
      branch: configured.branch,
      message:
        "Remote changes checked. Your website folder and open edits have not been replaced.",
    };
  }
}
