import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import {
  companionIdentity,
  type CompanionIdentity,
} from "../shared/builderCompanion";
import type { LocalProjects } from "./builder-projects";

type Session = {
  token: string;
  root: string;
  projectId: string;
  identity: CompanionIdentity;
  expiresAt: number;
  filePlans: Set<string>;
  buildPlans: Set<string>;
  jobs: Set<string>;
  backups: Set<string>;
  restores: Set<string>;
};
const canonical = (value: string) =>
  process.platform === "win32"
    ? path.resolve(value).toLowerCase()
    : path.resolve(value);
const rooted = new Set([
  "repository-inspect",
  "repository-git-status",
  "repository-source-inspect",
  "repository-source-draft-read",
  "repository-source-draft-save",
  "repository-build-review",
  "repository-prepare",
  "repository-open",
  "repository-native-backup-review",
  "repository-native-restore-review",
]);
export class CompanionSessions {
  private sessions = new Map<string, Session>();
  constructor(
    private projects: LocalProjects,
    private now = Date.now,
  ) {}
  origins() {
    const origins = ["https://kaizenweb.co.uk"];
    // Test servers may pair two loopback origins. Never enable an arbitrary remote test origin.
    const test = process.env.BUILDER_COMPANION_TEST_ORIGIN;
    if (test) {
      const url = new URL(test);
      if (
        url.origin !== test ||
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      )
        throw new Error(
          "The companion test origin must be a loopback HTTP origin.",
        );
      origins.push(test);
    }
    return origins;
  }
  async connect(value: unknown, folder: string, newFolder = false) {
    const identity = companionIdentity(value);
    if (!this.origins().includes(identity.origin))
      throw new Error(
        "This builder origin is not approved by the local companion.",
      );
    if (typeof folder !== "string" || !path.isAbsolute(folder))
      throw new Error("Choose an absolute repository folder.");
    const root = path.resolve(folder);
    const check = newFolder ? path.dirname(root) : root;
    const info = await lstat(check);
    if (
      info.isSymbolicLink() ||
      !info.isDirectory() ||
      canonical(await realpath(check)) !== canonical(check)
    )
      throw new Error("Choose a real folder without symbolic-link ancestors.");
    if (newFolder) {
      try {
        await lstat(root);
        throw new Error("A restore folder must not already exist.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    for (const [token, session] of this.sessions)
      if (session.expiresAt <= this.now()) this.sessions.delete(token);
    if (this.sessions.size >= 8)
      throw new Error(
        "Disconnect an existing companion session before opening another.",
      );
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          identity.origin,
          identity.accountId,
          identity.projectId,
        ]),
      )
      .digest("hex");
    const project = await this.projects.linkCompanion(
      key,
      identity.projectName,
    );
    if (this.sessions.size >= 8)
      throw new Error(
        "Disconnect an existing companion session before opening another.",
      );
    const token = randomBytes(32).toString("hex");
    const session: Session = {
      token,
      root,
      projectId: project.id,
      identity,
      expiresAt: this.now() + 2 * 60 * 60 * 1000,
      filePlans: new Set(),
      buildPlans: new Set(),
      jobs: new Set(),
      backups: new Set(),
      restores: new Set(),
    };
    this.sessions.set(token, session);
    return { token, root, projectId: project.id, expiresAt: session.expiresAt };
  }
  revoke(token: string) {
    this.sessions.delete(token);
  }
  authorize(token: string, projectId: string, request: Record<string, any>) {
    const session = this.sessions.get(token);
    if (
      !session ||
      session.expiresAt <= this.now() ||
      session.projectId !== projectId
    )
      throw new Error(
        "Local connection expired or disconnected. Reconnect before continuing.",
      );
    if (!request || typeof request !== "object" || Array.isArray(request))
      throw new Error("Invalid repository request.");
    const input = structuredClone(request);
    const root = (value: unknown) => {
      if (
        typeof value !== "string" ||
        !path.isAbsolute(value) ||
        canonical(value) !== canonical(session.root)
      )
        throw new Error(
          "This connection is limited to its approved folder. Reconnect to choose another folder.",
        );
      return session.root;
    };
    const known = (set: Set<string>, id: unknown) => {
      if (typeof id !== "string" || !set.has(id))
        throw new Error(
          "Review this operation again in the current connection.",
        );
    };
    if (input.action === "repository-inspect-current") {
      input.action = "repository-inspect";
      input.root = session.root;
    } else if (rooted.has(input.action)) input.root = root(input.root);
    else if (input.action === "repository-source-prepare")
      root(input.edits?.inspection?.root);
    else if (["repository-apply", "repository-commit"].includes(input.action))
      known(session.filePlans, input.planId);
    else if (input.action === "repository-build-start")
      known(session.buildPlans, input.planId);
    else if (
      ["repository-build-status", "repository-build-stop"].includes(
        input.action,
      )
    )
      known(session.jobs, input.jobId);
    else if (
      ["repository-source-preview", "repository-source-frame"].includes(
        input.action,
      )
    ) {
      root(input.root);
      known(session.jobs, input.jobId);
    } else if (input.action === "repository-native-backup-download")
      known(session.backups, input.reviewId);
    else if (input.action === "repository-native-restore-apply")
      known(session.restores, input.reviewId);
    else if (input.action === "repository-native-review-discard")
      known(new Set([...session.backups, ...session.restores]), input.reviewId);
    else
      throw new Error(
        "This operation is not available through a local repository connection.",
      );
    // Draft-save validates its own full inspection; constrain its nested root as well.
    if (input.action === "repository-source-draft-save" && input.edits)
      root(input.edits.inspection?.root);
    return { session, input };
  }
  record(session: Session, action: string, result: any) {
    const set =
      action === "repository-build-review"
        ? session.buildPlans
        : action === "repository-build-start"
          ? session.jobs
          : ["repository-prepare", "repository-source-prepare"].includes(action)
            ? session.filePlans
            : action === "repository-native-backup-review"
              ? session.backups
              : action === "repository-native-restore-review"
                ? session.restores
                : undefined;
    if (set && typeof result?.id === "string") {
      if (set.size >= 100) set.delete(set.values().next().value!);
      set.add(result.id);
    }
  }
}
