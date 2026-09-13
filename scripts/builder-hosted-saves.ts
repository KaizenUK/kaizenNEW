import { createHash } from "node:crypto";
import {
  HostedHelperError,
  accountId,
  repositoryAuthor,
  type RepositoryActor,
} from "./builder-hosted-auth";
import type { HostedWebsiteFolders } from "./builder-hosted-folders";
import type {
  RepositoryCompanion,
  AppliedFileChange,
} from "./builder-repository";
import type { RepositorySaveStatus } from "../shared/builderRepositorySave";
import { HostedSaveReleases } from "./builder-hosted-save-release";
import { HostedReceiptStore, receiptError } from "./builder-hosted-receipts";

type Receipt = {
  actorId: string;
  base: string;
  binding: string;
  changes: AppliedFileChange[];
  pending?: "apply" | "commit";
  route?: string;
  status: RepositorySaveStatus;
};
function saveReceipts(data: unknown, projectId: string): Receipt[] {
  if (!Array.isArray(data) || data.length > 22) throw receiptError();
  const text = (value: unknown, max = 2000) =>
    typeof value === "string" && value.length <= max;
  const revision = (value: unknown) =>
    typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
  const relative = (value: unknown) =>
    text(value, 500) &&
    Boolean(value) &&
    !(value as string).startsWith("/") &&
    !/[\\:\u0000-\u001f]/.test(value as string) &&
    !(value as string)
      .split("/")
      .some(
        (part) => !part || [".", "..", ".git", "node_modules"].includes(part),
      );
  const seen = new Set<string>();
  for (const item of data) {
    const status = item?.status;
    if (
      !item ||
      !accountId(item.actorId) ||
      !revision(item.base) ||
      typeof item.binding !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.binding) ||
      (item.route !== undefined && !relative(item.route)) ||
      (item.pending !== undefined &&
        !["apply", "commit"].includes(item.pending)) ||
      Object.keys(item).some(
        (key) =>
          ![
            "actorId",
            "base",
            "binding",
            "changes",
            "pending",
            "route",
            "status",
          ].includes(key),
      ) ||
      !status ||
      !accountId(status.planId) ||
      seen.has(status.planId) ||
      status.projectId !== projectId ||
      !["applied", "committed", "saved", "recovery_required"].includes(
        status.phase,
      ) ||
      (status.phase === "recovery_required") !== Boolean(item.pending) ||
      (["committed", "saved"].includes(status.phase)
        ? !revision(status.commit)
        : status.commit !== undefined) ||
      !text(status.message) ||
      (status.error !== undefined && !text(status.error)) ||
      !text(status.branch, 200) ||
      !status.branch ||
      !text(status.destinationUrl) ||
      Object.keys(status).some(
        (key) =>
          ![
            "planId",
            "projectId",
            "phase",
            "files",
            "branch",
            "destinationUrl",
            "commit",
            "message",
            "error",
          ].includes(key),
      ) ||
      !Array.isArray(item.changes) ||
      !item.changes.length ||
      item.changes.length > 20000 ||
      !Array.isArray(status.files) ||
      status.files.length !== item.changes.length
    )
      throw receiptError();
    try {
      const url = new URL(status.destinationUrl);
      if (url.protocol !== "https:" || url.origin !== status.destinationUrl)
        throw receiptError();
    } catch {
      throw receiptError();
    }
    const files = new Set<string>();
    for (const [index, change] of item.changes.entries()) {
      if (
        !change ||
        !relative(change.file) ||
        files.has(change.file) ||
        status.files[index] !== change.file ||
        !["create", "update", "delete"].includes(change.action) ||
        Object.keys(change).some(
          (key) => !["file", "action", "before", "after"].includes(key),
        ) ||
        ![change.before, change.after].every(
          (value) =>
            value === null ||
            (typeof value === "string" && /^[a-f0-9]{64}$/.test(value)),
        ) ||
        change.before === change.after ||
        (change.action === "create" && change.before !== null) ||
        (change.action === "delete" && change.after !== null) ||
        (change.action === "update" &&
          (change.before === null || change.after === null))
      )
        throw receiptError();
      files.add(change.file);
    }
    seen.add(status.planId);
  }
  return structuredClone(data);
}
/** Runs under the service's project lock. Receipts keep explicit push retries separate from creating commits. */
export class HostedWebsiteSaves {
  private receipts = new Map<string, Receipt>();
  private records: HostedReceiptStore<Receipt[]>;
  constructor(
    private folders: HostedWebsiteFolders,
    private releases = new HostedSaveReleases(),
  ) {
    this.records = new HostedReceiptStore(
      folders,
      "save-receipts.json",
      saveReceipts,
      () => [],
    );
  }
  async refresh(projectId: string) {
    const records = await this.records.read(projectId);
    for (const [id, receipt] of this.receipts)
      if (receipt.status.projectId === projectId) this.receipts.delete(id);
    for (const receipt of records)
      this.receipts.set(receipt.status.planId, receipt);
  }
  private persist(projectId: string) {
    return this.records.write(
      projectId,
      [...this.receipts.values()].filter(
        (receipt) => receipt.status.projectId === projectId,
      ),
    );
  }
  private binding(projectId: string) {
    const config = this.folders.configuration(projectId);
    return createHash("sha256")
      .update(
        JSON.stringify([
          config.repositoryUrl,
          config.branch,
          config.saveToWebsite,
        ]),
      )
      .digest("hex");
  }
  private checkBinding(projectId: string, receipt: Receipt) {
    const config = this.folders.configuration(projectId);
    if (
      receipt.binding !== this.binding(projectId) ||
      receipt.status.branch !== config.branch ||
      receipt.status.destinationUrl !== config.saveToWebsite?.url
    )
      throw receiptError();
  }
  private supersedeApplied(projectId: string, planId: string) {
    for (const [id, receipt] of this.receipts)
      if (
        id !== planId &&
        receipt.status.projectId === projectId &&
        receipt.status.phase === "applied"
      )
        this.receipts.delete(id);
  }
  async recover(projectId: string, repositories: RepositoryCompanion) {
    for (const receipt of [...this.receipts.values()]) {
      if (receipt.status.projectId !== projectId) continue;
      this.checkBinding(projectId, receipt);
      if (receipt.pending !== "apply") continue;
      // Only recognize complete before/after states. Never replay a partial apply or infer an unknown commit.
      let state: "before" | "after" | "changed" = "changed";
      try {
        if ((await this.folders.head(projectId)) === receipt.base)
          state = await repositories.appliedState(
            this.folders.root(projectId),
            receipt.changes,
          );
      } catch {
        /* Leave files and the recovery record intact for an operator. */
      }
      if (state === "before") this.receipts.delete(receipt.status.planId);
      if (state === "after") {
        delete receipt.pending;
        receipt.status.phase = "applied";
        receipt.status.message =
          "Changes are applied to the website folder. Save to website to send them to staging.";
        this.supersedeApplied(projectId, receipt.status.planId);
      }
    }
    await this.persist(projectId);
  }
  assertCanApply(projectId: string) {
    if (
      [...this.receipts.values()].some(
        (receipt) =>
          receipt.status.projectId === projectId &&
          ["committed", "recovery_required"].includes(receipt.status.phase),
      )
    )
      throw new HostedHelperError(
        409,
        "Finish saving the earlier commit before applying another change. Your new editing draft is kept.",
      );
  }
  assertCanReconfigure(projectId: string) {
    if (
      [...this.receipts.values()].some(
        (receipt) =>
          receipt.status.projectId === projectId &&
          receipt.status.phase !== "saved",
      )
    )
      throw new HostedHelperError(
        409,
        "Save the applied website changes before changing the repository settings.",
      );
  }
  async forget(projectId: string) {
    this.assertCanReconfigure(projectId);
    for (const [id, receipt] of this.receipts)
      if (receipt.status.projectId === projectId) this.receipts.delete(id);
    await this.persist(projectId);
  }
  async begin(
    projectId: string,
    actor: RepositoryActor,
    base: string,
    planId: string,
    changes: AppliedFileChange[],
    route?: string,
  ) {
    const config = this.folders.configuration(projectId);
    if (!config.saveToWebsite || !changes.length) return;
    // Bound completed history without discarding an unsent commit.
    const completed = [...this.receipts.entries()].filter(
      ([, receipt]) =>
        receipt.status.projectId === projectId &&
        receipt.status.phase === "saved",
    );
    while (completed.length >= 20) this.receipts.delete(completed.shift()![0]);
    this.receipts.set(planId, {
      actorId: actor.id,
      base,
      binding: this.binding(projectId),
      changes: structuredClone(changes),
      pending: "apply",
      route,
      status: {
        planId,
        projectId,
        phase: "recovery_required",
        files: changes.map((change) => change.file),
        branch: config.branch,
        destinationUrl: config.saveToWebsite.url,
        message:
          "A website change was interrupted. Check its state; files and recovery copies are kept. An incomplete change needs an operator check.",
      },
    });
    await this.persist(projectId);
  }
  async remember(
    projectId: string,
    actor: RepositoryActor,
    result: { planId: string; files: string[] },
  ) {
    if (
      !this.folders.configuration(projectId).saveToWebsite ||
      !result.files.length
    )
      return;
    const receipt = this.require(projectId, actor.id, result.planId);
    if (
      receipt.pending !== "apply" ||
      JSON.stringify(receipt.status.files) !== JSON.stringify(result.files)
    )
      throw receiptError();
    delete receipt.pending;
    receipt.status.phase = "applied";
    receipt.status.message =
      "Changes are applied to the website folder. Save to website to send them to staging.";
    this.supersedeApplied(projectId, result.planId);
    await this.persist(projectId);
  }
  private require(projectId: string, actorId: string, planId: unknown) {
    const receipt = typeof planId === "string" && this.receipts.get(planId);
    if (
      !receipt ||
      receipt.actorId !== actorId ||
      receipt.status.projectId !== projectId
    )
      throw new HostedHelperError(
        409,
        "These applied changes are unavailable in this project and account. Reopen the page to check the saved state; ask the owner if the helper restarted.",
      );
    this.checkBinding(projectId, receipt);
    return receipt;
  }
  async status(
    projectId: string,
    actorId: string,
    planId?: unknown,
    route?: unknown,
  ) {
    const receipt =
      planId !== undefined
        ? this.require(projectId, actorId, planId)
        : [...this.receipts.values()]
            .reverse()
            .find(
              (receipt) =>
                receipt.actorId === actorId &&
                receipt.status.projectId === projectId &&
                (route === undefined || receipt.route === route),
            );
    if (!receipt) return null;
    this.checkBinding(projectId, receipt);
    if (receipt.status.phase === "committed") {
      try {
        if (
          (await this.folders.remoteHead(projectId)) === receipt.status.commit
        )
          receipt.status = {
            ...receipt.status,
            phase: "saved",
            error: undefined,
            message:
              "Changes saved to the repository. Check the staging deployment before publishing.",
          };
      } catch {
        /* Retain the uncertain result; status checks never retry a push. */
      }
    }
    await this.persist(projectId);
    const value = structuredClone(receipt.status);
    if (value.phase === "saved")
      value.release = await this.releases.status(
        this.folders.configuration(projectId),
        value.commit!,
      );
    return value;
  }
  async save(
    projectId: string,
    actor: RepositoryActor,
    planId: unknown,
    message: unknown,
    repositories: RepositoryCompanion,
    authorize: () => Promise<void>,
  ) {
    const receipt = this.require(projectId, actor.id, planId);
    if (receipt.status.phase === "saved")
      return this.status(projectId, actor.id, planId);
    if (receipt.status.phase === "recovery_required")
      throw new HostedHelperError(
        409,
        "An interrupted website save needs an operator check. Existing files and commits are kept; no save has been repeated.",
      );
    await this.folders.assertNotBuilding(projectId);
    if (receipt.status.phase === "applied") {
      const identity = repositoryAuthor(actor);
      if (
        (await this.folders.head(projectId)) !== receipt.base ||
        (await this.folders.remoteHead(projectId)) !== receipt.base
      )
        throw new HostedHelperError(
          409,
          "The website branch moved after these changes were applied. Your files are kept. Ask the owner to reconcile the folder before saving.",
        );
      await repositories.restoreApplied(
        receipt.status.planId,
        projectId,
        this.folders.root(projectId),
        receipt.changes,
      );
      const result = await repositories.commit(
        receipt.status.planId,
        projectId,
        message as string,
        {
          git: this.folders.localGit(projectId),
          identity,
          expectedHead: receipt.base,
          reserveStorage: async (additionalBytes) => {
            await this.folders.disk.check(projectId, additionalBytes);
          },
          beforeMutation: async () => {
            receipt.pending = "commit";
            receipt.status.phase = "recovery_required";
            receipt.status.message =
              "An interrupted website save needs an operator check. Existing files and commits are kept; no save has been repeated.";
            await this.persist(projectId);
          },
        },
      );
      receipt.status = {
        ...receipt.status,
        phase: "committed",
        commit: result.commit,
        message:
          "Changes are committed in the website folder and have not yet been confirmed on the remote.",
      };
      delete receipt.pending;
      // This exact commit must be durable before authorizing or attempting any push.
      await this.persist(projectId);
    }
    // Access may have ended during a commit. Never start a push under the earlier membership check.
    await authorize();
    try {
      const current = await this.folders.remoteHead(projectId);
      if (current !== receipt.status.commit) {
        if (current !== receipt.base)
          throw new HostedHelperError(
            409,
            "The remote branch moved. Ask the owner to reconcile this saved commit before retrying. Remote changes have not been overwritten.",
          );
        await this.folders.pushCommit(
          projectId,
          receipt.status.commit!,
          receipt.base,
        );
        if (
          (await this.folders.remoteHead(projectId)) !== receipt.status.commit
        )
          throw new HostedHelperError(
            409,
            "The push finished, but this revision could not be confirmed on the remote. Check the saved state before retrying.",
          );
      }
      receipt.status = {
        ...receipt.status,
        phase: "saved",
        error: undefined,
        message:
          "Changes saved to the repository. Check the staging deployment before publishing.",
      };
    } catch (error) {
      receipt.status.error =
        error instanceof HostedHelperError && error.status === 409
          ? error.message
          : "The push was rejected or could not be confirmed. Your commit and files are kept. Check the saved state, or ask the owner to check branch permissions and retry saving.";
    }
    return this.status(projectId, actor.id, planId);
  }
}
