import { accountFixture, accountPerson } from "./account-fixture";
import type { Page } from "./browser-fixture";

export async function domainFixture(page: Page, owner = true) {
  const fixture = await accountFixture(page, { domains: true });
  if (owner)
    await fixture.db.query(
      "update builder_project_members set role='owner',can_publish=true where project_id=$1 and user_id=$2",
      [fixture.project.id, accountPerson],
    );
  // Account-only fixtures do not need a persisted workspace. Domain removal
  // does: keep real fixture content in the database to prove it survives.
  const workspace = await page.request.get(
    `/__builder-local?project=${fixture.project.id}`,
  );
  if (!workspace.ok()) throw new Error("Fixture workspace is unavailable");
  const loaded = await workspace.json();
  await fixture.db.query(
    "insert into builder_project_workspaces(project_id,payload) values($1,$2)",
    [fixture.project.id, loaded.payload || loaded],
  );
  const rpc = async (name: string, values: unknown[]) =>
    (
      await fixture.db.query<any>(
        `select ${name}(${values.map((_, index) => `$${index + 1}`).join(",")}) as value`,
        values,
      )
    ).rows[0].value;
  const currentDomain = async () =>
    (
      await fixture.db.query<any>(
        "select * from builder_domains where project_id=$1 and status<>'removed'",
        [fixture.project.id],
      )
    ).rows[0];
  return {
    ...fixture,
    currentDomain,
    /** Real database transitions; DNS/TLS/provider receipts are synthetic. */
    async advanceDomain(
      next:
        | "ownership_missing"
        | "provisioning"
        | "tls_pending"
        | "connected"
        | "removed",
    ) {
      let job = await currentDomain();
      if (!job) throw new Error("No current fixture domain");
      if (job.status === "queued")
        job = await rpc("builder_domain_claim", [
          job.id,
          "fixture-domains",
          crypto.randomUUID(),
        ]);
      if (!job.owner_token)
        throw new Error("The browser must request domain work first");
      // Explicit synthetic withdrawal evidence accompanies a simulated failed
      // hosting check. The production worker must actually withdraw both routes.
      const withdrawal = () => ({
        domainId: job.id,
        attemptId: job.owner_token,
        projectId: job.project_id,
        hostname: job.hostname,
        providerWithdrawn: true,
        routingRemoved: true,
        verifiedAt: new Date().toISOString(),
      });
      if (next === "removed") {
        if (job.operation !== "remove")
          throw new Error("The browser must confirm removal first");
        return rpc("builder_domain_remove_finish", [
          job.id,
          job.owner_token,
          {
            domainId: job.id,
            attemptId: job.owner_token,
            projectId: job.project_id,
            hostname: job.hostname,
            providerRemoved: true,
            routingRemoved: true,
            verifiedAt: new Date().toISOString(),
          },
        ]);
      }
      job = await rpc("builder_domain_dns_result", [
        job.id,
        job.owner_token,
        next === "ownership_missing" ? next : "verified",
        next === "ownership_missing" && job.claimed_at ? withdrawal() : null,
      ]);
      if (next === "ownership_missing" || next === "provisioning") return job;
      if (next === "tls_pending")
        return rpc("builder_domain_worker_error", [
          job.id,
          job.owner_token,
          "tls_pending",
          withdrawal(),
        ]);
      const destination =
        job.destination_id &&
        (
          await fixture.db.query<any>(
            "select active_artifact_id from builder_client_destinations where id=$1",
            [job.destination_id],
          )
        ).rows[0];
      return rpc("builder_domain_connect_finish", [
        job.id,
        job.owner_token,
        {
          domainId: job.id,
          attemptId: job.owner_token,
          projectId: job.project_id,
          hostname: job.hostname,
          origin: `https://${job.hostname}`,
          bindingKind: job.binding_kind,
          destinationId: job.candidate_destination_id,
          artifactId: destination?.active_artifact_id || `domain-${job.id}`,
          manifestSha256: "a".repeat(64),
          certificateSha256: "b".repeat(64),
          certificateNames: [job.hostname],
          certificateAutoRenew: true,
          certificateSelfSigned: false,
          certificateExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          verifiedAt: new Date(Date.now() + 100).toISOString(),
          providerOwned: true,
        },
      ]);
    },
  };
}
