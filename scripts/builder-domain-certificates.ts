/** Exact-hostname ACME for an already-owned DirectAdmin domain. */
import { normalizeDomainHostname } from "../shared/builderDomains";
import {
  DirectAdminError,
  type directAdminApi,
} from "./builder-directadmin-api";

export class DomainCertificateError extends Error {
  constructor(
    public reason: "tls_pending" | "provider_failed" | "configuration_changed",
  ) {
    super("The website domain certificate could not be confirmed.");
    this.name = "DomainCertificateError";
  }
}
type Api = ReturnType<typeof directAdminApi>;
type Configuration = {
  creatorDnsProvider: string;
  dnsEnvironment: Record<string, string>;
  dnsProvider: string;
  enabled: boolean;
  globalDnsProvider: string;
  keyType: string;
  preferWildcard: boolean;
  provider: string;
  skipDNSNames: string[];
};
type CertificateRequest = {
  certID: string;
  dnsNames: string[];
  challengeType?: string;
};
type Plan = {
  acmeEnabled: boolean;
  acmeInProgress: boolean;
  ratelimitReached: boolean;
  certsPending: CertificateRequest[];
  certsFulfilled: CertificateRequest[];
  certsObsolete: CertificateRequest[];
  dnsNamesFailedCAA: string[];
  dnsNamesFailedChallenge: string[];
  dnsNamesSkipped: string[];
};
const invalid = () => new DomainCertificateError("configuration_changed");
function dnsName(input: unknown): string {
  if (typeof input !== "string") throw invalid();
  const hostname = input.startsWith("*.") ? input.slice(2) : input;
  if (normalizeDomainHostname(hostname) !== hostname) throw invalid();
  return input;
}
function names(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 1000) throw invalid();
  return input.map(dnsName);
}
function configuration(input: any): Configuration {
  if (
    !input ||
    typeof input !== "object" ||
    ["enabled", "preferWildcard"].some(
      (key) => typeof input[key] !== "boolean",
    ) ||
    [
      "creatorDnsProvider",
      "dnsProvider",
      "globalDnsProvider",
      "keyType",
      "provider",
    ].some((key) => typeof input[key] !== "string") ||
    !input.dnsEnvironment ||
    typeof input.dnsEnvironment !== "object" ||
    Array.isArray(input.dnsEnvironment)
  )
    throw invalid();
  return { ...input, skipDNSNames: names(input.skipDNSNames) };
}
const desired = (enabled: boolean, excluded: string[]): Configuration => ({
  creatorDnsProvider: "",
  dnsEnvironment: {},
  dnsProvider: "",
  enabled,
  globalDnsProvider: "",
  keyType: "ec256",
  preferWildcard: false,
  provider: "letsencrypt",
  skipDNSNames: [...new Set(excluded)].sort(),
});
const httpSettings = (c: Configuration, hostname: string) =>
  c.creatorDnsProvider === "" &&
  c.globalDnsProvider === "" &&
  c.dnsProvider === "" &&
  Object.keys(c.dnsEnvironment).length === 0 &&
  c.keyType === "ec256" &&
  !c.preferWildcard &&
  c.provider === "letsencrypt" &&
  !c.skipDNSNames.includes(hostname);
function plan(input: any): Plan {
  if (
    !input ||
    ["acmeEnabled", "acmeInProgress", "ratelimitReached"].some(
      (key) => typeof input[key] !== "boolean",
    )
  )
    throw invalid();
  const parsed: any = {
    acmeEnabled: input.acmeEnabled,
    acmeInProgress: input.acmeInProgress,
    ratelimitReached: input.ratelimitReached,
  };
  for (const key of ["certsPending", "certsFulfilled", "certsObsolete"]) {
    if (!Array.isArray(input[key]) || input[key].length > 1000) throw invalid();
    parsed[key] = input[key].map((entry: any) => {
      if (
        !entry ||
        typeof entry.certID !== "string" ||
        !/^[a-zA-Z0-9_.-]{1,253}$/.test(entry.certID)
      )
        throw invalid();
      const dnsNames = names(entry.dnsNames);
      if (
        !dnsNames.length ||
        (key === "certsPending" &&
          !["HTTP-01", "DNS-01"].includes(entry.challengeType))
      )
        throw invalid();
      return {
        certID: entry.certID,
        dnsNames,
        ...(key === "certsPending"
          ? { challengeType: entry.challengeType }
          : {}),
      };
    });
  }
  for (const key of [
    "dnsNamesFailedCAA",
    "dnsNamesFailedChallenge",
    "dnsNamesSkipped",
  ])
    parsed[key] = names(input[key]);
  return parsed;
}
function excludedNames(p: Plan, hostname: string) {
  return [
    ...new Set(
      [
        ...p.certsPending.flatMap((c) => c.dnsNames),
        ...p.certsFulfilled.flatMap((c) => c.dnsNames),
        ...p.certsObsolete.flatMap((c) => c.dnsNames),
        ...p.dnsNamesFailedCAA,
        ...p.dnsNamesFailedChallenge,
        ...p.dnsNamesSkipped,
      ].filter((name) => name !== hostname),
    ),
  ].sort();
}
function exactPlan(p: Plan, hostname: string): boolean {
  const certificates = [...p.certsPending, ...p.certsFulfilled];
  return (
    certificates.length > 0 &&
    certificates.every(
      (c) => c.dnsNames.length === 1 && c.dnsNames[0] === hostname,
    ) &&
    p.certsPending.every((c) => c.challengeType === "HTTP-01") &&
    !p.dnsNamesFailedCAA.includes(hostname) &&
    !p.dnsNamesFailedChallenge.includes(hostname) &&
    !p.dnsNamesSkipped.includes(hostname)
  );
}
const restrictedPlan = (p: Plan, c: Configuration, hostname: string) =>
  exactPlan(p, hostname) &&
  excludedNames(p, hostname).every((name) => c.skipDNSNames.includes(name));
function pending(p: Plan) {
  if (p.acmeInProgress || p.ratelimitReached)
    throw new DomainCertificateError("tls_pending");
}
export function normalizeDomainCertificateSerial(value: unknown): string {
  if (typeof value !== "string" || !/^[a-fA-F0-9:]{1,120}$/.test(value))
    throw invalid();
  return value.replace(/:/g, "").replace(/^0+/, "").toLowerCase() || "0";
}
type CertificateEvidence = {
  certificateAutoRenew: true;
  certificateSerialNumber: string;
  certificateNames: string[];
  certificateExpiresAt: string;
};
function inventoryEvidence(
  value: any,
  p: Plan,
  hostname: string,
): CertificateEvidence | null {
  if (
    !value ||
    !Array.isArray(value.certIds) ||
    !Array.isArray(value.certs) ||
    value.certs.length > 1000
  )
    throw invalid();
  const missing = names(value.missingDNSNames);
  if (missing.includes(hostname)) return null;
  const acceptableIds = [...p.certsPending, ...p.certsFulfilled].map(
    (c) => c.certID,
  );
  const candidates = value.certs.filter(
    (c: any) =>
      c &&
      value.certIds.includes(c.id) &&
      acceptableIds.includes(c.id) &&
      c.autorenewEnabled === true &&
      c.selfSigned === false &&
      c.validationError === "" &&
      c.certificate?.dnsNames?.length === 1 &&
      c.certificate.dnsNames[0] === hostname,
  );
  if (candidates.length !== 1) return null;
  const certificate = candidates[0].certificate;
  if (
    !Array.isArray(certificate.ipAddresses) ||
    certificate.ipAddresses.length ||
    !Number.isFinite(Date.parse(certificate.notAfter)) ||
    Date.parse(certificate.notAfter) <= Date.now() + 3600000 ||
    !Number.isFinite(Date.parse(certificate.notBefore)) ||
    Date.parse(certificate.notBefore) > Date.now()
  )
    return null;
  return {
    certificateAutoRenew: true,
    certificateSerialNumber: normalizeDomainCertificateSerial(
      certificate.serialNumber,
    ),
    certificateNames: [hostname],
    certificateExpiresAt: new Date(certificate.notAfter).toISOString(),
  };
}

/** Bind renewal metadata to the exact leaf actually observed by HTTPS checks. */
export function assertDomainCertificateMatches(
  provider: CertificateEvidence,
  served: {
    certificateSerialNumber: string;
    certificateNames: string[];
    certificateExpiresAt: string;
  },
) {
  if (
    provider.certificateSerialNumber !==
      normalizeDomainCertificateSerial(served.certificateSerialNumber) ||
    provider.certificateNames.length !== 1 ||
    served.certificateNames.length !== 1 ||
    provider.certificateNames[0] !== served.certificateNames[0] ||
    Date.parse(provider.certificateExpiresAt) !==
      Date.parse(served.certificateExpiresAt)
  )
    throw new DomainCertificateError("tls_pending");
}

/** Creation triggers are disabled on the host before making this owned object. */
export async function disableDomainCertificate(
  hostname: string,
  api: Api,
  guard: () => Promise<void>,
) {
  if (normalizeDomainHostname(hostname) !== hostname) throw invalid();
  await guard();
  await api(
    "PUT",
    `/api/domain-tls/${hostname}/acme-config`,
    desired(false, []),
  );
  await guard();
  const observed = configuration(
    await api("GET", `/api/domain-tls/${hostname}/acme-config`),
  );
  if (
    observed.enabled ||
    !httpSettings(observed, hostname) ||
    observed.skipDNSNames.length
  )
    throw invalid();
}

/**
 * Called under the provider's ownership lock. Each request rechecks the current
 * database attempt. No certificate is requested until a disabled dry run proves
 * the exact HTTP-01 name; settings and renewal inventory are read back afterward.
 */
export async function ensureDomainCertificate(
  hostname: string,
  api: Api,
  guard: () => Promise<void>,
): Promise<CertificateEvidence> {
  if (normalizeDomainHostname(hostname) !== hostname) throw invalid();
  const base = `/api/domain-tls/${hostname}/`;
  const call: Api = async (...args) => {
    await guard();
    return api(...args);
  };
  const read = async () =>
    configuration(await call("GET", base + "acme-config"));
  const inspect = async () =>
    plan(await call("POST", base + "provision-certs-dry-run"));
  const set = async (next: Configuration) => {
    await call("PUT", base + "acme-config", next);
    const observed = await read();
    if (
      !httpSettings(observed, hostname) ||
      observed.enabled !== next.enabled ||
      JSON.stringify([...new Set(observed.skipDNSNames)].sort()) !==
        JSON.stringify(next.skipDNSNames)
    )
      throw invalid();
    return observed;
  };
  let current = await read(),
    observed: Plan | undefined;
  if (current.enabled && httpSettings(current, hostname)) {
    observed = await inspect();
    if (!observed.acmeEnabled) throw invalid();
    pending(observed);
  }
  if (!observed || !restrictedPlan(observed, current, hostname)) {
    // Include failed challenges/CAA and obsolete names, not only issuable names.
    // DirectAdmin can otherwise start requesting www or mail after DNS changes.
    current = await set(desired(false, []));
    observed = await inspect();
    if (observed.acmeEnabled) throw invalid();
    pending(observed);
    current = await set(desired(false, excludedNames(observed, hostname)));
    observed = await inspect();
    if (observed.acmeEnabled) throw invalid();
    pending(observed);
    if (!restrictedPlan(observed, current, hostname))
      throw new DomainCertificateError("tls_pending");
    current = await set({ ...current, enabled: true });
    observed = await inspect();
    if (!observed.acmeEnabled || !restrictedPlan(observed, current, hostname)) {
      await set({ ...current, enabled: false });
      throw invalid();
    }
    pending(observed);
  }
  let evidence = inventoryEvidence(
    await call("GET", base + "certs"),
    observed,
    hostname,
  );
  if (
    !evidence ||
    observed.certsPending.length ||
    observed.certsObsolete.length
  ) {
    try {
      const result = await call("POST", base + "provision-certs");
      if (
        !result ||
        !Array.isArray(result.provisionResults) ||
        result.provisionResults.some(
          (r: any) =>
            !r ||
            r.success !== true ||
            r.request?.challengeType !== "HTTP-01" ||
            r.request.dnsNames?.length !== 1 ||
            r.request.dnsNames[0] !== hostname,
        )
      )
        throw new DomainCertificateError("tls_pending");
    } catch (error) {
      // Lost replies and in-progress/rate-limited work are reconciled on the next
      // owned attempt; never retry issuance immediately or expose ACME output.
      if (error instanceof DirectAdminError)
        throw new DomainCertificateError("tls_pending");
      throw error;
    }
    current = await read();
    observed = await inspect();
    if (
      !current.enabled ||
      !httpSettings(current, hostname) ||
      !observed.acmeEnabled ||
      !restrictedPlan(observed, current, hostname)
    )
      throw invalid();
    pending(observed);
    evidence = inventoryEvidence(
      await call("GET", base + "certs"),
      observed,
      hostname,
    );
  }
  if (!evidence) throw new DomainCertificateError("tls_pending");
  await call(
    "POST",
    "/CMD_API_DOMAIN?json=yes",
    {
      action: "modify",
      domain: hostname,
      ubandwidth: "unlimited",
      uquota: "unlimited",
      ssl: "ON",
    },
    true,
  );
  return evidence;
}
