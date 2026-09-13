import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { lstat, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { HostedHelperError } from "./builder-hosted-auth";
import {
  hostedProjectRepositories,
  privateDirectory,
  privateFile,
  unlinkedPath,
  type HostedProjectRepository,
  type HostedWebsiteFolders,
} from "./builder-hosted-folders";
import { repositoryGitStatus } from "./builder-repository-git";
import type {
  RepositorySettingsState,
  RepositorySettingsValue,
} from "../shared/builderRepositorySettings";

type RecordState = {
  version: number;
  repository: Pick<RepositorySettingsValue, "repositoryUrl" | "branch">;
  fingerprint?: string;
};
const exec = promisify(execFile);
const unavailable = () =>
  new HostedHelperError(
    503,
    "The repository setup needs an operator check. Existing folders and keys are kept.",
  );
const exists = async (file: string) => {
  await unlinkedPath(file);
  return lstat(file).catch((error) => {
    if (error.code !== "ENOENT") throw unavailable();
    return null;
  });
};

/** Called only under the project lock after fresh owner + unarchived-project checks.
 * Registry admission and pinned Git hosts stay operator-owned. No private key is returned or stored in a workspace. */
export class HostedRepositorySettings {
  private versions = new Map<string, string>();
  constructor(private folders: HostedWebsiteFolders) {}
  private file(id: string) {
    return path.join(
      this.folders.projectDirectory(id),
      "repository-settings.json",
    );
  }
  private transition(id: string) {
    return path.join(
      this.folders.projectDirectory(id),
      "repository-setup-transition.json",
    );
  }
  private async directory(id: string) {
    this.folders.admission(id);
    await privateDirectory(path.join(this.folders.directory, "projects"));
    await privateDirectory(this.folders.projectDirectory(id));
  }
  private repository(id: string, value: unknown): RecordState["repository"] {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some(
        (key) => !["repositoryUrl", "branch"].includes(key),
      )
    )
      throw new HostedHelperError(
        400,
        "Enter only the repository SSH address and branch. Deployment approval and credentials are managed separately.",
      );
    let config;
    try {
      config = hostedProjectRepositories({
        version: 1,
        projects: [{ ...value, projectId: id }],
      })[0];
    } catch {
      throw new HostedHelperError(
        400,
        "Use a repository SSH address such as git@github.com:owner/site.git and a valid branch name.",
      );
    }
    if ("setup" in config) throw unavailable();
    return { repositoryUrl: config.repositoryUrl, branch: config.branch };
  }
  private approved(
    id: string,
    repository: RecordState["repository"],
  ): HostedProjectRepository {
    const base = this.folders.admission(id);
    // Repository owners cannot relabel a production push as staging. Retargeting requires renewed operator approval.
    const approved =
      !("setup" in base) &&
      base.repositoryUrl === repository.repositoryUrl &&
      base.branch === repository.branch;
    return {
      projectId: id,
      ...repository,
      ...(approved && base.saveToWebsite
        ? { saveToWebsite: base.saveToWebsite }
        : {}),
      ...(approved && base.publishToWebsite
        ? { publishToWebsite: base.publishToWebsite }
        : {}),
    };
  }
  private async load(id: string): Promise<RecordState | undefined> {
    this.folders.admission(id);
    if (await exists(this.transition(id))) throw unavailable();
    const file = this.file(id);
    if (!(await exists(file))) return;
    await privateFile(file, 16384);
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      if (
        !Number.isSafeInteger(value.version) ||
        value.version < 1 ||
        Object.keys(value).some(
          (key) => !["version", "repository", "fingerprint"].includes(key),
        ) ||
        (value.fingerprint !== undefined &&
          !/^SHA256:[A-Za-z0-9+/]{43}$/.test(value.fingerprint))
      )
        throw unavailable();
      return {
        version: value.version,
        repository: this.repository(id, value.repository),
        ...(value.fingerprint ? { fingerprint: value.fingerprint } : {}),
      };
    } catch {
      throw unavailable();
    }
  }
  async refresh(id: string) {
    const value = await this.load(id),
      base = this.folders.admission(id);
    const repository = value
      ? this.approved(id, value.repository)
      : "setup" in base
        ? undefined
        : base;
    const signature = JSON.stringify([value?.fingerprint, repository]);
    const changed =
      this.versions.has(id) && this.versions.get(id) !== signature;
    this.folders.installConfiguration(id, repository);
    this.versions.set(id, signature);
    return changed;
  }
  private async state(id: string): Promise<RepositorySettingsState> {
    const value = await this.load(id),
      base = this.folders.admission(id);
    const repository =
      value?.repository ||
      ("setup" in base
        ? undefined
        : { repositoryUrl: base.repositoryUrl, branch: base.branch });
    const key = path.join(this.folders.credentialsDirectory, id, "deploy-key");
    const configured = Boolean(await exists(key));
    if (configured) await privateFile(key, 65536);
    const connected = Boolean(await exists(this.folders.root(id)));
    if (connected) await this.folders.check(id);
    const approved = repository && this.approved(id, repository);
    return {
      version: value?.version || 0,
      ...(approved
        ? {
            repository: {
              repositoryUrl: approved.repositoryUrl,
              branch: approved.branch,
              ...(approved.saveToWebsite
                ? { saveToWebsite: approved.saveToWebsite }
                : {}),
            },
          }
        : {}),
      connected,
      key: {
        configured,
        ...(value?.fingerprint ? { fingerprint: value.fingerprint } : {}),
      },
    };
  }
  async read(id: string) {
    await this.refresh(id);
    return this.state(id);
  }
  private async expected(id: string, version: unknown) {
    const state = await this.state(id);
    if (!Number.isSafeInteger(version) || version !== state.version)
      throw new HostedHelperError(
        409,
        "Repository settings changed in another window. Reload the setup before continuing.",
      );
    return state;
  }
  private async keyCommand(args: string[]) {
    try {
      return (
        await exec("ssh-keygen", args, {
          timeout: 15000,
          maxBuffer: 65536,
          env: { PATH: process.env.PATH, LANG: "C", LC_ALL: "C" },
        })
      ).stdout.trim();
    } catch {
      throw unavailable();
    }
  }
  private async pinned(id: string, repositoryUrl: string) {
    const directory = path.join(this.folders.credentialsDirectory, id);
    await privateDirectory(this.folders.credentialsDirectory);
    await privateDirectory(directory);
    const hosts = path.join(directory, "known_hosts");
    await privateFile(hosts, 1024 * 1024);
    const hostname = repositoryUrl.slice(4).split(":")[0];
    try {
      if (!(await this.keyCommand(["-F", hostname, "-f", hosts])))
        throw unavailable();
    } catch {
      throw new HostedHelperError(
        409,
        "This Git host needs the operator to approve its SSH host key before connecting.",
      );
    }
  }
  private async write(id: string, value: RecordState) {
    await this.directory(id);
    const temporary = path.join(
      this.folders.projectDirectory(id),
      `.repository-settings-${randomUUID()}`,
    );
    try {
      await writeFile(temporary, JSON.stringify(value), {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, this.file(id));
    } finally {
      await rm(temporary, { force: true });
    }
  }
  private async archiveKey(id: string) {
    const key = path.join(this.folders.credentialsDirectory, id, "deploy-key");
    if (!(await exists(key))) return;
    await privateFile(key, 65536);
    const previous = path.join(
      this.folders.credentialsDirectory,
      id,
      "previous-keys",
    );
    await privateDirectory(previous);
    const retained = path.join(previous, randomUUID());
    await privateDirectory(retained);
    await rename(key, path.join(retained, "deploy-key"));
  }
  async save(
    id: string,
    version: unknown,
    input: unknown,
    beforeRetarget: () => Promise<void>,
  ) {
    const state = await this.expected(id, version),
      repository = this.repository(id, input);
    await this.pinned(id, repository.repositoryUrl);
    const changed =
      state.repository &&
      (state.repository.repositoryUrl !== repository.repositoryUrl ||
        state.repository.branch !== repository.branch);
    const changedAddress =
      state.repository &&
      state.repository.repositoryUrl !== repository.repositoryUrl;
    if (changed) {
      await this.folders.assertNotBuilding(id);
      if (state.connected) {
        const root = await this.folders.check(id);
        const git = await repositoryGitStatus(root, this.folders.localGit(id));
        if (
          git.inProgress ||
          git.files.length ||
          (await this.folders.head(id)) !== (await this.folders.remoteHead(id))
        )
          throw new HostedHelperError(
            409,
            "The current website folder has pending work or differs from its remote. Save or reconcile it before changing repositories or branches.",
          );
      }
      await beforeRetarget();
      await this.directory(id);
      const previous = path.join(
        this.folders.projectDirectory(id),
        "previous-setups",
      );
      await privateDirectory(previous);
      const archive = path.join(previous, randomUUID());
      await privateDirectory(archive);
      await writeFile(
        this.transition(id),
        JSON.stringify({ previousVersion: state.version, archive }),
        { flag: "wx", mode: 0o600 },
      );
      // A crash or failed move leaves this marker and retained data. Future calls fail closed for operator recovery.
      for (const [from, name] of [
        [this.folders.root(id), "checkout"],
        [
          path.join(this.folders.projectDirectory(id), "repository.json"),
          "repository.json",
        ],
      ]) {
        if (await exists(from)) await rename(from, path.join(archive, name));
      }
      if (changedAddress) await this.archiveKey(id);
    }
    await this.write(id, {
      version: state.version + 1,
      repository,
      ...(!changedAddress && state.key.fingerprint
        ? { fingerprint: state.key.fingerprint }
        : {}),
    });
    if (changed) await rm(this.transition(id));
    await this.refresh(id);
    return this.state(id);
  }
  async createKey(id: string, version: unknown) {
    const state = await this.expected(id, version);
    if (!state.repository)
      throw new HostedHelperError(
        409,
        "Save the repository address and branch before creating a deploy key.",
      );
    if (state.connected)
      throw new HostedHelperError(
        409,
        "This folder already uses a deploy key. Ask the operator to rotate a connected key without interrupting website access.",
      );
    await this.pinned(id, state.repository.repositoryUrl);
    await this.directory(id);
    const directory = path.join(this.folders.credentialsDirectory, id),
      temporary = path.join(directory, `.key-${randomUUID()}`);
    await privateDirectory(temporary);
    try {
      const key = path.join(temporary, "deploy-key");
      await this.keyCommand([
        "-q",
        "-t",
        "ed25519",
        "-N",
        "",
        "-C",
        `kaizen-helper-${id}`,
        "-f",
        key,
      ]);
      await privateFile(key, 65536);
      const publicKey = (await readFile(`${key}.pub`, "utf8")).trim();
      if (
        !/^ssh-ed25519 [A-Za-z0-9+/]+={0,2} kaizen-helper-[a-f0-9-]+$/.test(
          publicKey,
        ) &&
        !/^ssh-ed25519 [A-Za-z0-9+/]+={0,2} kaizen-helper-kaizen$/.test(
          publicKey,
        )
      )
        throw unavailable();
      const fingerprint = (
        await this.keyCommand(["-l", "-E", "sha256", "-f", `${key}.pub`])
      ).split(/\s+/)[1];
      if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint)) throw unavailable();
      const final = path.join(directory, "deploy-key");
      if (await exists(final)) await privateFile(final, 65536);
      await writeFile(
        this.transition(id),
        JSON.stringify({ previousVersion: state.version, operation: "key" }),
        { flag: "wx", mode: 0o600 },
      );
      await this.archiveKey(id);
      await rename(key, final);
      await this.write(id, {
        version: state.version + 1,
        repository: {
          repositoryUrl: state.repository.repositoryUrl,
          branch: state.repository.branch,
        },
        fingerprint,
      });
      await rm(this.transition(id));
      await this.refresh(id);
      // The public half is emitted only by this explicit creation response; later reads contain only its fingerprint.
      return { ...(await this.state(id)), publicKey };
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  async connect(id: string, version: unknown) {
    const state = await this.expected(id, version);
    if (!state.repository || !state.key.configured)
      throw new HostedHelperError(
        409,
        "Save the repository settings and add its deploy key to the Git host before connecting.",
      );
    await this.pinned(id, state.repository.repositoryUrl);
    await this.folders.ensure(id);
    await this.folders.remoteHead(id);
    return this.state(id);
  }
}
