import type { HostedProjectRepository } from "./builder-hosted-folders";
import type { RepositorySaveStatus } from "../shared/builderRepositorySave";

type Release = NonNullable<RepositorySaveStatus["release"]>;
/** Observes the configured deployment workflow for this exact commit; a Git push alone is not a release. */
export class HostedSaveReleases {
  private cache = new Map<string, { expiresAt: number; value: Release }>();
  constructor(
    private options: { githubToken?: string; fetch?: typeof fetch } = {},
  ) {}
  async status(
    repository: HostedProjectRepository,
    commit: string,
  ): Promise<Release> {
    const unavailable: Release = {
      state: "unavailable",
      message:
        "Deployment status is unavailable. Your commit is saved; check staging or ask the owner to inspect the deployment.",
    };
    const repo = /^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/.exec(
      repository.repositoryUrl,
    );
    const workflow = repository.saveToWebsite?.workflow;
    if (!repo || !workflow)
      return {
        ...unavailable,
        message:
          "Deployment tracking is not configured. Open staging to check your saved changes.",
      };
    for (const [key, value] of this.cache)
      if (value.expiresAt <= Date.now()) this.cache.delete(key);
    const key = `${repository.projectId}:${commit}`;
    if (this.cache.has(key)) return this.cache.get(key)!.value;
    let result = unavailable;
    try {
      const url = new URL(
        `https://api.github.com/repos/${repo[1]}/${repo[2]}/actions/workflows/${workflow}/runs`,
      );
      url.search = new URLSearchParams({
        branch: repository.branch,
        head_sha: commit,
        event: "push",
        per_page: "5",
      }).toString();
      const response = await (this.options.fetch || fetch)(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(this.options.githubToken
            ? { Authorization: `Bearer ${this.options.githubToken}` }
            : {}),
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.workflow_runs)) throw new Error();
      const runs = data.workflow_runs
        .filter(
          (run) =>
            run.head_sha === commit &&
            run.head_branch === repository.branch &&
            run.event === "push" &&
            Number.isSafeInteger(run.id) &&
            run.id > 0,
        )
        .sort((a, b) => b.id - a.id);
      const run = runs[0];
      if (!run)
        result = {
          state: "waiting",
          message:
            "Saved to the repository. No deployment run has been reported for this revision yet.",
        };
      else {
        const url = `https://github.com/${repo[1]}/${repo[2]}/actions/runs/${run.id}`;
        if (run.status === "completed")
          result =
            run.conclusion === "success"
              ? {
                  state: "succeeded",
                  message:
                    "The staging deployment workflow succeeded. Open staging and check the page before publishing.",
                  url,
                }
              : {
                  state: "failed",
                  message:
                    "The staging deployment did not succeed. Your commit is saved; open the deployment details or ask the owner to check it.",
                  url,
                };
        else if (run.status === "in_progress")
          result = {
            state: "building",
            message: "Your saved changes are being deployed to staging.",
            url,
          };
        else if (
          ["queued", "requested", "waiting", "pending"].includes(run.status)
        )
          result = {
            state: "queued",
            message:
              "Your saved changes are waiting for the staging deployment.",
            url,
          };
      }
    } catch {
      /* A status outage never changes a successful repository save into a failed push. */
    }
    if (this.cache.size >= 256)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { expiresAt: Date.now() + 10000, value: result });
    return result;
  }
}
