/** Trusted domain lifecycle. The service owns paths, DNS ingress and provider configuration. */
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { withRecoveryLock } from "./release-recovery.mjs";
import {
  checkDomainDns,
  normalizeDomainIngress,
  type DomainDnsResolver,
  type DomainIngress,
} from "./builder-domain-dns";
import {
  ensureDomainCertificate,
  assertDomainCertificateMatches,
} from "./builder-domain-certificates";
import { verifyDomainHttps } from "./builder-domain-https";
import { normalizeDomainHostname } from "../shared/builderDomains";
import type { directAdminDomains } from "./builder-domain-provider";
import type {
  domainReleases,
  DomainReleaseTarget,
} from "./builder-domain-releases";

type Failure =
  | "provider_failed"
  | "tls_pending"
  | "routing_failed"
  | "access_changed"
  | "configuration_changed";
export class DomainWorkerError extends Error {
  constructor(public reason: Failure | "recovery_required") {
    super("The website domain operation needs a verified retry.");
    this.name = "DomainWorkerError";
  }
}
type Attempt = {
  schemaVersion: 1;
  domainId: string;
  workerId: string;
  token: string;
  pid: number;
  host: string;
  finish: { name: string; args: Record<string, unknown> } | null;
};
export type DomainWorkerServices = {
  workerId: string;
  jobsRoot: string;
  ingress: DomainIngress;
  reservedHostnames: readonly string[];
  client: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<any>;
  };
  provider: ReturnType<typeof directAdminDomains>;
  releases: ReturnType<typeof domainReleases>;
  /** Trusted fixtures only; production uses the DNS, certificate and TLS implementations. */
  dns?: DomainDnsResolver;
  certificate?: typeof ensureDomainCertificate;
  https?: typeof verifyDomainHttps;
};
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const failure = (error: any): Failure => {
  if (error?.code === "P0403") return "access_changed";
  return [
    "provider_failed",
    "tls_pending",
    "routing_failed",
    "access_changed",
    "configuration_changed",
  ].includes(error?.reason)
    ? error.reason
    : "provider_failed";
};
async function privateDirectory(directory: string) {
  const stat = await lstat(directory);
  if (
    !path.isAbsolute(directory) ||
    path.normalize(directory) !== directory ||
    (await realpath(directory)) !== directory ||
    !stat.isDirectory() ||
    stat.uid !== process.getuid?.() ||
    stat.mode & 0o077
  )
    throw new DomainWorkerError("configuration_changed");
}
async function readAttempt(file: string): Promise<Attempt | null> {
  const stat = await lstat(file).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!stat) return null;
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== process.getuid?.() ||
    stat.mode & 0o077 ||
    stat.size > 65536
  )
    throw new DomainWorkerError("configuration_changed");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = await handle.stat();
    if (
      current.ino !== stat.ino ||
      current.dev !== stat.dev ||
      current.size > 65536
    )
      throw new DomainWorkerError("configuration_changed");
    const value = JSON.parse(await handle.readFile("utf8"));
    if (
      Object.keys(value).sort().join(",") !==
        "domainId,finish,host,pid,schemaVersion,token,workerId" ||
      value.schemaVersion !== 1 ||
      !uuid.test(value.domainId) ||
      !uuid.test(value.token) ||
      !Number.isInteger(value.pid) ||
      value.pid <= 0 ||
      typeof value.host !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(value.workerId)
    )
      throw new DomainWorkerError("configuration_changed");
    return value;
  } finally {
    await handle.close();
  }
}
async function saveAttempt(file: string, value: Attempt) {
  const temporary = `${file}.${randomUUID()}.tmp`,
    handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
    const parent = await open(
      path.dirname(file),
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await unlink(temporary).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
function stopped(attempt: Attempt) {
  if (attempt.host !== os.hostname()) return false;
  try {
    process.kill(attempt.pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}

/** Run one due job. An uncertain final database acknowledgement never triggers rollback. */
export async function runDomainJob(
  requestId: string,
  services: DomainWorkerServices,
) {
  if (
    !uuid.test(requestId) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(services.workerId)
  )
    throw new DomainWorkerError("configuration_changed");
  const ingress = normalizeDomainIngress(services.ingress);
  await privateDirectory(services.jobsRoot);
  const root = path.join(services.jobsRoot, requestId);
  await mkdir(root, { mode: 0o700 }).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  await privateDirectory(root);
  const rpc = services.client.rpc;
  const get = async () => {
    const value = await rpc("builder_domain_worker_get", {
      request_id: requestId,
      worker: services.workerId,
    });
    if (
      value?.id !== requestId ||
      value.worker_id !== services.workerId ||
      normalizeDomainHostname(value.hostname) !== value.hostname ||
      (value.owner_token !== null && !uuid.test(value.owner_token))
    )
      throw new DomainWorkerError("configuration_changed");
    return value;
  };
  const summary = (job: any) => ({
    domainId: requestId,
    status: job.status as string,
    reason: job.reason as string | null,
  });
  return withRecoveryLock(path.join(root, "worker.lock"), async () => {
    let job = await get();
    if (
      job.status === "removed" ||
      (!job.owner_token &&
        job.status !== "queued" &&
        Date.parse(job.next_check_at) > Date.now())
    )
      return summary(job);
    const token = randomUUID(),
      previousOwner = job.owner_token;
    if (previousOwner) {
      const prior = await readAttempt(
        path.join(root, `attempt-${previousOwner}.json`),
      );
      if (
        !prior ||
        prior.domainId !== requestId ||
        prior.workerId !== services.workerId ||
        prior.token !== previousOwner ||
        !stopped(prior)
      )
        throw new DomainWorkerError("recovery_required");
    }
    const attempt: Attempt = {
      schemaVersion: 1,
      domainId: requestId,
      workerId: services.workerId,
      token,
      pid: process.pid,
      host: os.hostname(),
      finish: null,
    };
    const file = path.join(root, `attempt-${token}.json`);
    await saveAttempt(file, attempt);
    let cleanupReason: Failure | null = null;
    try {
      await rpc("builder_domain_claim", {
        request_id: requestId,
        worker: services.workerId,
        token,
        previous_owner: previousOwner,
      });
    } catch (error) {
      const observed = await get();
      if (observed.owner_token !== token) {
        if (
          !observed.owner_token &&
          !observed.claimed_at &&
          error?.code === "P0403"
        ) {
          await rpc("builder_domain_fail_queued", {
            request_id: requestId,
            worker: services.workerId,
            failure: "access_changed",
          });
          return summary(await get());
        }
        if (["P0403", "P0409"].includes(error?.code)) {
          // Cleanup is an explicitly restricted claim. Neither normal guards,
          // verified DNS nor connection finalization accept this token's mode.
          await rpc("builder_domain_claim", {
            request_id: requestId,
            worker: services.workerId,
            token,
            previous_owner: previousOwner,
            cleanup_only: true,
          });
          cleanupReason =
            error.code === "P0403" ? "access_changed" : "configuration_changed";
        } else throw new DomainWorkerError("recovery_required");
      }
      // The claim may have committed despite a lost response. This exact attempt
      // still holds the local lock, so it can continue without taking over a process.
    }
    job = await get();
    const item: DomainReleaseTarget = {
      domainId: requestId,
      projectId: job.project_id,
      hostname: job.hostname,
      bindingKind: job.binding_kind,
      destinationId: job.candidate_destination_id,
    };
    const assert = async (withdrawalOnly: boolean) => {
      const observed = await rpc("builder_domain_worker_assert", {
        request_id: requestId,
        worker: services.workerId,
        token,
        withdrawal_only: withdrawalOnly,
      });
      if (
        observed?.owner_token !== token ||
        observed.id !== requestId ||
        observed.project_id !== item.projectId ||
        observed.hostname !== item.hostname ||
        observed.binding_kind !== item.bindingKind ||
        observed.candidate_destination_id !== item.destinationId
      )
        throw new DomainWorkerError("access_changed");
      return observed;
    };
    const guard = async () => {
      await assert(false);
    };
    const cleanupGuard = async () => {
      await assert(true);
    };
    const withdraw = async (disableCertificates: boolean) => {
      const provider = await services.provider.withdraw(
        item,
        disableCertificates,
        cleanupGuard,
      );
      const routing = await services.releases.route(
        item,
        false,
        null,
        cleanupGuard,
      );
      if (
        provider.providerWithdrawn !== true ||
        routing.routingRemoved !== true
      )
        throw new DomainWorkerError("routing_failed");
      await cleanupGuard();
      return {
        domainId: requestId,
        attemptId: token,
        projectId: item.projectId,
        hostname: item.hostname,
        providerWithdrawn: true,
        routingRemoved: true,
        verifiedAt: new Date().toISOString(),
      };
    };
    let finishing = false;
    const finish = async (name: string, args: Record<string, unknown>) => {
      attempt.finish = { name, args };
      await saveAttempt(file, attempt);
      finishing = true;
      try {
        await rpc(name, args);
      } catch {
        const observed = await get();
        if (observed.completed_token === token && !observed.owner_token)
          return summary(observed);
        throw new DomainWorkerError("recovery_required");
      }
      const observed = await get();
      if (observed.completed_token !== token || observed.owner_token)
        throw new DomainWorkerError("recovery_required");
      return summary(observed);
    };
    const dns = () =>
      checkDomainDns(
        {
          hostname: item.hostname,
          token: job.verification_token,
          ingress,
          reservedHostnames: services.reservedHostnames,
        },
        services.dns,
      );
    const dnsFailure = async (result: string) =>
      finish("builder_domain_dns_result", {
        request_id: requestId,
        token,
        result,
        withdrawal: job.claimed_at ? await withdraw(true) : null,
      });
    try {
      if (cleanupReason && job.operation !== "remove")
        throw new DomainWorkerError(cleanupReason);
      if (job.operation === "remove") {
        const removed = await services.provider.remove(item, cleanupGuard);
        const routing = await services.releases.route(
          item,
          false,
          null,
          cleanupGuard,
        );
        if (
          removed.providerRemoved !== true ||
          removed.routingRemoved !== true ||
          routing.routingRemoved !== true
        )
          throw new DomainWorkerError("routing_failed");
        await cleanupGuard();
        return finish("builder_domain_remove_finish", {
          request_id: requestId,
          token,
          verification: {
            domainId: requestId,
            attemptId: token,
            projectId: item.projectId,
            hostname: item.hostname,
            providerRemoved: true,
            routingRemoved: true,
            verifiedAt: new Date().toISOString(),
          },
        });
      }
      if (job.destination_enabled === false)
        throw new DomainWorkerError("configuration_changed");
      await guard();
      const firstDns = await dns();
      if (firstDns.status !== "verified")
        return await dnsFailure(firstDns.status);
      await rpc("builder_domain_dns_result", {
        request_id: requestId,
        token,
        result: "verified",
      });
      job = await get();
      // A verified hostname already owned by another project ends this claim.
      if (!job.owner_token && job.completed_token === token)
        return summary(job);
      await guard();
      const owned = await services.provider.ensure(item, guard);
      if (owned.providerOwned !== true || owned.domainId !== requestId)
        throw new DomainWorkerError("provider_failed");
      const release = await services.releases.prepare(
        item,
        job.active_artifact_id,
        guard,
      );
      const certificate = await services.provider.withOwned(
        item,
        guard,
        (api) =>
          (services.certificate ?? ensureDomainCertificate)(
            item.hostname,
            api,
            guard,
          ),
      );
      await services.releases.route(item, true, release.artifactId, guard);
      await services.provider.route(item, true, guard);
      // Certificate setup may have taken several attempts. Check current DNS
      // again before accepting any public HTTPS or served-release evidence.
      const finalDns = await dns();
      if (finalDns.status !== "verified")
        return await dnsFailure(finalDns.status);
      await rpc("builder_domain_dns_result", {
        request_id: requestId,
        token,
        result: "verified",
      });
      const served = await (services.https ?? verifyDomainHttps)({
        hostname: item.hostname,
        ingress,
        origin: release.origin,
        manifest: release.manifest,
      });
      assertDomainCertificateMatches(certificate, served);
      await guard();
      return await finish("builder_domain_connect_finish", {
        request_id: requestId,
        token,
        verification: {
          domainId: requestId,
          attemptId: token,
          projectId: item.projectId,
          hostname: item.hostname,
          origin: `https://${item.hostname}`,
          bindingKind: item.bindingKind,
          destinationId: item.destinationId,
          artifactId: release.artifactId,
          manifestSha256: release.manifestSha256,
          certificateSha256: served.certificateSha256,
          certificateNames: served.certificateNames,
          certificateAutoRenew: certificate.certificateAutoRenew,
          certificateSelfSigned: served.certificateSelfSigned,
          certificateExpiresAt: served.certificateExpiresAt,
          verifiedAt: served.verifiedAt,
          providerOwned: true,
        },
      });
    } catch (error) {
      if (finishing) throw new DomainWorkerError("recovery_required");
      job = await get();
      if (!job.owner_token && job.completed_token === token)
        return summary(job);
      if (job.owner_token !== token)
        throw new DomainWorkerError("access_changed");
      const reason = failure(error);
      const withdrawal = job.claimed_at
        ? await withdraw(reason !== "tls_pending")
        : null;
      return finish("builder_domain_worker_error", {
        request_id: requestId,
        token,
        failure: reason,
        withdrawal,
      });
    }
  });
}

/** A bounded scheduler pass keeps processing independent domains after a failure. */
export async function runDomainQueue(services: DomainWorkerServices) {
  const jobs = await services.client.rpc("builder_domain_worker_queue", {
    worker: services.workerId,
  });
  if (
    !Array.isArray(jobs) ||
    jobs.length > 100 ||
    jobs.some(
      (job) => !uuid.test(job.id) || job.worker_id !== services.workerId,
    )
  )
    throw new DomainWorkerError("configuration_changed");
  const results: { domainId: string; status: string; reason: string | null }[] =
    [];
  for (const job of jobs) {
    try {
      results.push(await runDomainJob(job.id, services));
    } catch {
      results.push({
        domainId: job.id,
        status: "recovery_required",
        reason: "configuration_changed",
      });
    }
  }
  return results;
}
