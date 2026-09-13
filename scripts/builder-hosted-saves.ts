import {
  HostedHelperError,
  repositoryAuthor,
  type RepositoryActor,
} from "./builder-hosted-auth";
import type { HostedWebsiteFolders } from "./builder-hosted-folders";
import type { RepositoryCompanion } from "./builder-repository";
import type { RepositorySaveStatus } from "../shared/builderRepositorySave";
import { HostedSaveReleases } from "./builder-hosted-save-release";

type Receipt = {
  actorId: string;
  base: string;
  route?: string;
  status: RepositorySaveStatus;
};
/** Runs under the service's project lock. Receipts keep explicit push retries separate from creating commits. */
export class HostedWebsiteSaves {
  private receipts = new Map<string, Receipt>();
  constructor(
    private folders: HostedWebsiteFolders,
    private releases = new HostedSaveReleases(),
  ) {}
  assertCanApply(projectId: string) {
    if (
      [...this.receipts.values()].some(
        (receipt) =>
          receipt.status.projectId === projectId &&
          receipt.status.phase === "committed",
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
  forget(projectId: string) {
    this.assertCanReconfigure(projectId);
    for (const [id, receipt] of this.receipts)
      if (receipt.status.projectId === projectId) this.receipts.delete(id);
  }
  remember(
    projectId: string,
    actor: RepositoryActor,
    base: string,
    result: { planId: string; files: string[] },
    route?: string,
  ) {
    const config = this.folders.configuration(projectId);
    if (!config.saveToWebsite || !result.files.length) return;
    for (const [id, receipt] of this.receipts)
      if (
        receipt.status.projectId === projectId &&
        receipt.status.phase === "applied"
      )
        this.receipts.delete(id);
    // Bound completed history without discarding an unsent commit.
    const completed = [...this.receipts.entries()].filter(
      ([, receipt]) =>
        receipt.status.projectId === projectId &&
        receipt.status.phase === "saved",
    );
    while (completed.length >= 20) this.receipts.delete(completed.shift()![0]);
    this.receipts.set(result.planId, {
      actorId: actor.id,
      base,
      route,
      status: {
        planId: result.planId,
        projectId,
        phase: "applied",
        files: result.files,
        branch: config.branch,
        destinationUrl: config.saveToWebsite.url,
        message:
          "Changes are applied to the website folder. Save to website to send them to staging.",
      },
    });
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
      const result = await repositories.commit(
        receipt.status.planId,
        projectId,
        message as string,
        {
          git: this.folders.localGit(projectId),
          identity,
          expectedHead: receipt.base,
        },
      );
      receipt.status = {
        ...receipt.status,
        phase: "committed",
        commit: result.commit,
        message:
          "Changes are committed in the website folder and have not yet been confirmed on the remote.",
      };
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
