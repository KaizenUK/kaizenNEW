import {
  mkdir,
  readFile,
  writeFile,
  rename,
  cp,
  lstat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  LEGACY_PROJECT_ID,
  PROJECT_FORMAT_VERSION,
  validProjectId,
  projectName,
  projectCapabilities,
  DEFAULT_PROJECT_CAPABILITIES,
  LEGACY_PROJECT_CAPABILITIES,
  type BuilderProject,
} from "../shared/builderProjects";
import type { Workspace } from "../shared/visualBuilder";
import { disconnectedSettings } from "../shared/builderSettings";

type Catalogue = {
  formatVersion: number;
  projects: BuilderProject[];
  companionLinks?: Record<string, string>;
};
export class LocalProjects {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly root: string) {
    this.root = path.resolve(root);
  }
  directory(id: string) {
    if (!validProjectId(id)) throw new Error("Invalid project ID.");
    return id === LEGACY_PROJECT_ID
      ? this.root
      : path.join(this.root, "projects", id);
  }
  private async assertDirectory(directory: string) {
    const relative = path.relative(this.root, directory);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Project directory escapes its storage root.");
    let current = this.root;
    for (const segment of ["", ...relative.split(path.sep).filter(Boolean)]) {
      if (segment) current = path.join(current, segment);
      try {
        if ((await lstat(current)).isSymbolicLink())
          throw new Error("Project storage must not be a symbolic link.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  private async atomic(file: string, value: unknown) {
    await this.assertDirectory(path.dirname(file));
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2), { flag: "wx" });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temp, file);
          break;
        } catch (error) {
          if (
            process.platform !== "win32" ||
            !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
            attempt >= 5
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * 2 ** attempt),
          );
        }
      }
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  private async read(): Promise<Catalogue> {
    try {
      const result = JSON.parse(
        await readFile(path.join(this.root, "projects.json"), "utf8"),
      );
      if (
        result.formatVersion !== PROJECT_FORMAT_VERSION ||
        !Array.isArray(result.projects)
      )
        throw new Error(
          "Unsupported project catalogue version. Preserve this directory and update the builder.",
        );
      let migrated = false;
      for (const project of result.projects) {
        if (project.capabilities === undefined) {
          project.capabilities = {
            ...(project.id === LEGACY_PROJECT_ID
              ? LEGACY_PROJECT_CAPABILITIES
              : DEFAULT_PROJECT_CAPABILITIES),
          };
          migrated = true;
        }
        project.capabilities = projectCapabilities(project.capabilities);
      }
      if (migrated)
        await this.atomic(path.join(this.root, "projects.json"), result);
      return result;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const now = new Date().toISOString();
      // Register the original directory in place: no draft, publication, asset,
      // revision, upload or private-preview file is moved or rewritten.
      const result = {
        formatVersion: PROJECT_FORMAT_VERSION,
        projects: [
          {
            id: LEGACY_PROJECT_ID,
            capabilities: { ...LEGACY_PROJECT_CAPABILITIES },
            name: "Kaizen workspace",
            createdAt: now,
            updatedAt: now,
            archived: false,
            version: 1,
            destination: {
              kind: "legacy-local" as const,
              label: "Existing Kaizen local preview",
            },
          },
        ],
      };
      await this.atomic(path.join(this.root, "projects.json"), result);
      return result;
    }
  }
  transact<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(operation, operation);
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  list() {
    return this.transact(async () => (await this.read()).projects);
  }
  /** Private local draft identity. A hosted UUID must never alias a local project. */
  linkCompanion(key: string, name: string): Promise<BuilderProject> {
    return this.transact(async () => {
      const catalogue = await this.read();
      const existingId = catalogue.companionLinks?.[key];
      if (existingId) {
        const existing = catalogue.projects.find(
          (project) => project.id === existingId,
        );
        if (!existing || existing.archived)
          throw new Error(
            "Restore this companion's local project in the local dashboard before reconnecting.",
          );
        await this.assertDirectory(this.directory(existing.id));
        return existing;
      }
      const now = new Date().toISOString();
      const project: BuilderProject = {
        id: randomUUID(),
        capabilities: { ...DEFAULT_PROJECT_CAPABILITIES },
        name: projectName(`Local: ${name}`.slice(0, 100)),
        createdAt: now,
        updatedAt: now,
        archived: false,
        version: 1,
        destination: {
          kind: "unconfigured",
          label: "Local companion — no deployment destination",
        },
      };
      await this.atomic(
        path.join(this.directory(project.id), "workspace.json"),
        { pages: [], assets: [], saved: [] },
      );
      catalogue.projects.push(project);
      catalogue.companionLinks = {
        ...catalogue.companionLinks,
        [key]: project.id,
      };
      await this.atomic(path.join(this.root, "projects.json"), catalogue);
      return project;
    });
  }
  importWorkspace(
    name: string,
    workspace: Workspace,
    files: Record<string, Uint8Array>,
  ): Promise<BuilderProject> {
    return this.transact(async () => {
      const catalogue = await this.read();
      const now = new Date().toISOString();
      const project: BuilderProject = {
        id: randomUUID(),
        capabilities: { ...DEFAULT_PROJECT_CAPABILITIES },
        name: projectName(name),
        version: 1,
        createdAt: now,
        updatedAt: now,
        archived: false,
        destination: {
          kind: "unconfigured",
          label: "No deployment destination configured",
        },
      };
      const directory = this.directory(project.id);
      await this.assertDirectory(directory);
      const replacements = new Map<string, string>();
      for (const asset of workspace.assets) {
        if (!/^[\w-]+$/.test(asset.id))
          throw new Error("Invalid source asset ID.");
        const data = files[`assets/${asset.id}`];
        if (
          !data ||
          data.length !== asset.size ||
          createHash("sha256").update(data).digest("hex") !== asset.hash
        )
          throw new Error(
            `The editable archive has a missing or damaged asset: ${asset.name}`,
          );
        await mkdir(path.join(directory, "assets"), { recursive: true });
        await writeFile(path.join(directory, "assets", asset.id), data, {
          flag: "wx",
        });
        const extension =
          asset.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "bin";
        replacements.set(
          asset.url,
          `/builder-media/${asset.id}.${extension}?project=${project.id}`,
        );
      }
      const rewrite = (value: unknown): any =>
        typeof value === "string"
          ? replacements.get(value) || value
          : Array.isArray(value)
            ? value.map(rewrite)
            : value && typeof value === "object"
              ? Object.fromEntries(
                  Object.entries(value).map(([key, item]) => [
                    key,
                    rewrite(item),
                  ]),
                )
              : value;
      await this.atomic(
        path.join(directory, "workspace.json"),
        rewrite(workspace),
      );
      catalogue.projects.push(project);
      await this.atomic(path.join(this.root, "projects.json"), catalogue);
      return project;
    });
  }
  async require(id: string, write = false): Promise<BuilderProject> {
    this.directory(id);
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error("Project not found. Return to Projects.");
    if (write && project.archived)
      throw new Error(
        "This project is archived. Restore it in Projects before editing.",
      );
    // Refuse symlinked project directories, including a substituted projects parent.
    for (const dir of id === LEGACY_PROJECT_ID
      ? [this.root]
      : [this.root, path.join(this.root, "projects"), this.directory(id)]) {
      try {
        if ((await lstat(dir)).isSymbolicLink())
          throw new Error("Project storage must not be a symbolic link.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return project;
  }
  mutate(input: {
    action: string;
    id?: string;
    name?: string;
    version?: number;
    archived?: boolean;
  }): Promise<BuilderProject> {
    return this.transact(async () => {
      const catalogue = await this.read();
      const now = new Date().toISOString();
      if (input.action === "create" || input.action === "duplicate") {
        const source =
          input.action === "duplicate"
            ? catalogue.projects.find((p) => p.id === input.id)
            : undefined;
        if (input.action === "duplicate" && !source)
          throw new Error("Source project not found.");
        const project: BuilderProject = {
          id: randomUUID(),
          capabilities: { ...DEFAULT_PROJECT_CAPABILITIES },
          name: projectName(input.name),
          createdAt: now,
          updatedAt: now,
          archived: false,
          version: 1,
          destination: {
            kind: "unconfigured",
            label: "No deployment destination configured",
          },
        };
        const directory = this.directory(project.id);
        await this.assertDirectory(directory);
        let workspace: Workspace = { pages: [], assets: [], saved: [] };
        if (source) {
          await this.assertDirectory(this.directory(source.id));
          await this.assertDirectory(
            path.join(this.directory(source.id), "assets"),
          );
          try {
            workspace = JSON.parse(
              await readFile(
                path.join(this.directory(source.id), "workspace.json"),
                "utf8",
              ),
            );
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          // Copy assets by recorded identity only. Never follow arbitrary paths or copy another project.
          for (const asset of workspace.assets) {
            if (!/^[\w-]+$/.test(asset.id))
              throw new Error("Invalid source asset ID.");
            const file = path.join(
              this.directory(source.id),
              "assets",
              asset.id,
            );
            if ((await lstat(file)).isSymbolicLink())
              throw new Error("Asset storage must not be a symbolic link.");
            await mkdir(path.join(directory, "assets"), { recursive: true });
            await cp(file, path.join(directory, "assets", asset.id), {
              errorOnExist: true,
              force: false,
            });
          }
          const replacements = new Map(
            workspace.assets.map((a) => [
              a.url,
              a.url.split("?")[0] + `?project=${project.id}`,
            ]),
          );
          const rewrite = (value: unknown): any =>
            typeof value === "string"
              ? replacements.get(value) || value
              : Array.isArray(value)
                ? value.map(rewrite)
                : value && typeof value === "object"
                  ? Object.fromEntries(
                      Object.entries(value).map(([key, item]) => [
                        key,
                        rewrite(item),
                      ]),
                    )
                  : value;
          workspace = rewrite(workspace);
          if (workspace.settings)
            workspace.settings = disconnectedSettings(workspace.settings);
        }
        await this.atomic(path.join(directory, "workspace.json"), workspace);
        catalogue.projects.push(project);
        await this.atomic(path.join(this.root, "projects.json"), catalogue);
        return project;
      }
      const project = catalogue.projects.find((p) => p.id === input.id);
      if (!project) throw new Error("Project not found.");
      if (project.version !== input.version)
        throw new Error(
          "Project changed in another window. Refresh before retrying.",
        );
      if (input.action === "rename") project.name = projectName(input.name);
      else if (
        input.action === "archive" &&
        typeof input.archived === "boolean"
      )
        project.archived = input.archived;
      else throw new Error("Unknown project action.");
      project.updatedAt = now;
      project.version++;
      await this.atomic(path.join(this.root, "projects.json"), catalogue);
      return project;
    });
  }
}
