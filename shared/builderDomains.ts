export const DOMAIN_VERIFICATION_LABEL = "_kaizen-verification";
const verificationPrefix = "kaizen-domain-verification=";
const unavailableSuffixes = new Set([
  "localhost",
  "local",
  "internal",
  "invalid",
  "test",
  "example",
  "onion",
]);

/** Use the same ASCII hostname in DNS, certificates and release identities. */
export function normalizeDomainHostname(value: unknown): string {
  const invalid = () =>
    new Error(
      "Enter a domain name, such as www.yourwebsite.com, without a link or path.",
    );
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    /[\p{Cc}\p{Cf}]/u.test(value)
  )
    throw invalid();
  const input = value.trim();
  if (!input || /[\s/@\\:#?%\[\]*]/u.test(input)) throw invalid();
  let hostname: string;
  try {
    hostname = new URL(`https://${input}`).hostname.toLowerCase();
  } catch {
    throw invalid();
  }
  // A single final root dot is harmless; empty interior labels are not.
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  const labels = hostname.split(".");
  const suffix = labels[labels.length - 1];
  if (
    hostname.length + DOMAIN_VERIFICATION_LABEL.length + 1 > 253 ||
    labels.length < 2 ||
    labels.some(
      (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    ) ||
    !/[a-z]/.test(suffix) ||
    unavailableSuffixes.has(suffix)
  )
    throw invalid();
  return hostname;
}

/** Reservations are operator configuration, never values supplied by a website owner. */
export function assertUnreservedDomain(
  hostname: string,
  reserved: readonly string[],
): void {
  const host = normalizeDomainHostname(hostname);
  if (
    reserved.some((entry) => {
      const reservation = normalizeDomainHostname(entry);
      return host === reservation || host.endsWith(`.${reservation}`);
    })
  )
    throw new Error(
      "This domain is reserved for an existing service. Choose another domain.",
    );
}

export function domainVerificationRecord(hostname: string, token: string) {
  const host = normalizeDomainHostname(hostname);
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error(
      "The domain verification record is invalid. Refresh the domain settings.",
    );
  return {
    type: "TXT" as const,
    name: `${DOMAIN_VERIFICATION_LABEL}.${host}`,
    value: `${verificationPrefix}${token}`,
  };
}

export type DomainStatus =
  | "waiting_dns"
  | "queued"
  | "checking_dns"
  | "provisioning"
  | "connected"
  | "removing"
  | "attention"
  | "removed";
export type DomainReason =
  | "ownership_missing"
  | "routing_missing"
  | "routing_mismatch"
  | "lookup_failed"
  | "domain_in_use"
  | "provider_failed"
  | "tls_pending"
  | "routing_failed"
  | "access_changed"
  | "configuration_changed";
export type WebsiteDomain = {
  id: string;
  projectId: string;
  hostname: string;
  status: DomainStatus;
  operation: "connect" | "remove";
  version: number;
  bindingKind: "client-primary" | "client-alias" | "repository-alias";
  verification: { type: "TXT"; name: string; value: string };
  reason: DomainReason | null;
  dnsCheckedAt: string | null;
  connectedAt: string | null;
  removedAt: string | null;
  certificateExpiresAt: string | null;
};
export type WebsiteDomainState = {
  projectId: string;
  canManage: boolean;
  archived: boolean;
  domain: WebsiteDomain | null;
  history: WebsiteDomain[];
  hosting: { ipv4: string[]; ipv6: string[] } | null;
};
export const domainOperationRunning = (domain: WebsiteDomain) =>
  ["queued", "checking_dns", "provisioning", "removing"].includes(
    domain.status,
  );
export const domainHttpsReady = (domain: WebsiteDomain, now = Date.now()) =>
  domain.status === "connected" &&
  domain.certificateExpiresAt !== null &&
  Date.parse(domain.certificateExpiresAt) > now;

/** Validate account/project-scoped responses before storing or displaying them. */
export function readWebsiteDomainState(
  value: unknown,
  projectId: string,
): WebsiteDomainState {
  const invalid = () =>
    new Error(
      "The website domain status could not be checked. Refresh before trying again.",
    );
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const date = (value: unknown) => {
    if (value === null) return null;
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) ||
      !Number.isFinite(Date.parse(value))
    )
      throw invalid();
    return value;
  };
  const domain = (input: any): WebsiteDomain => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.id !== "string" ||
      !uuid.test(input.id) ||
      input.projectId !== projectId ||
      typeof input.hostname !== "string" ||
      normalizeDomainHostname(input.hostname) !== input.hostname ||
      ![
        "waiting_dns",
        "queued",
        "checking_dns",
        "provisioning",
        "connected",
        "removing",
        "attention",
        "removed",
      ].includes(input.status) ||
      !["connect", "remove"].includes(input.operation) ||
      !Number.isInteger(input.version) ||
      input.version < 1 ||
      input.version > 2147483647 ||
      !["client-primary", "client-alias", "repository-alias"].includes(
        input.bindingKind,
      ) ||
      (input.reason !== null &&
        ![
          "ownership_missing",
          "routing_missing",
          "routing_mismatch",
          "lookup_failed",
          "domain_in_use",
          "provider_failed",
          "tls_pending",
          "routing_failed",
          "access_changed",
          "configuration_changed",
        ].includes(input.reason)) ||
      input.verification?.type !== "TXT" ||
      typeof input.verification.value !== "string" ||
      !input.verification.value.startsWith(verificationPrefix)
    )
      throw invalid();
    const record = domainVerificationRecord(
      input.hostname,
      input.verification.value.slice(verificationPrefix.length),
    );
    if (
      input.verification.name !== record.name ||
      input.verification.value !== record.value
    )
      throw invalid();
    const dates = {
      dnsCheckedAt: date(input.dnsCheckedAt),
      connectedAt: date(input.connectedAt),
      removedAt: date(input.removedAt),
      certificateExpiresAt: date(input.certificateExpiresAt),
    };
    if (
      (input.status === "removed") !== (dates.removedAt !== null) ||
      (input.status === "connected" &&
        (!dates.dnsCheckedAt ||
          !dates.connectedAt ||
          !dates.certificateExpiresAt ||
          input.reason !== null)) ||
      (["waiting_dns", "checking_dns", "provisioning", "connected"].includes(
        input.status,
      ) &&
        input.operation !== "connect") ||
      (["removing", "removed"].includes(input.status) &&
        input.operation !== "remove")
    )
      throw invalid();
    return {
      id: input.id,
      projectId,
      hostname: input.hostname,
      status: input.status,
      operation: input.operation,
      version: input.version,
      bindingKind: input.bindingKind,
      verification: record,
      reason: input.reason,
      ...dates,
    };
  };
  try {
    const input = value as any;
    if (
      !input ||
      typeof input !== "object" ||
      input.projectId !== projectId ||
      typeof input.canManage !== "boolean" ||
      typeof input.archived !== "boolean" ||
      !Array.isArray(input.history) ||
      input.history.length > 10 ||
      input.domain === undefined ||
      input.hosting === undefined
    )
      throw invalid();
    const current = input.domain === null ? null : domain(input.domain);
    const history = input.history.map(domain);
    if (
      current?.status === "removed" ||
      history.some((item: WebsiteDomain) => item.status !== "removed") ||
      new Set([
        ...(current ? [current.id] : []),
        ...history.map((item: WebsiteDomain) => item.id),
      ]).size !==
        history.length + (current ? 1 : 0)
    )
      throw invalid();
    let hosting: WebsiteDomainState["hosting"] = null;
    if (input.hosting !== null) {
      const { ipv4, ipv6 } = input.hosting;
      if (
        !Array.isArray(ipv4) ||
        !Array.isArray(ipv6) ||
        ipv4.length + ipv6.length < 1 ||
        ipv4.length + ipv6.length > 16 ||
        ipv4.some(
          (ip: unknown) =>
            typeof ip !== "string" ||
            !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(ip) ||
            ip.split(".").some((part) => Number(part) > 255),
        ) ||
        ipv6.some(
          (ip: unknown) =>
            typeof ip !== "string" ||
            !/^[a-f0-9:.]+$/.test(ip) ||
            !ip.includes(":") ||
            new URL(`https://[${ip}]/`).hostname.slice(1, -1) !== ip,
        )
      )
        throw invalid();
      hosting = { ipv4: [...ipv4], ipv6: [...ipv6] };
    }
    return {
      projectId,
      canManage: input.canManage,
      archived: input.archived,
      domain: current,
      history,
      hosting,
    };
  } catch {
    throw invalid();
  }
}

export function websiteDomainStatus(domain: WebsiteDomain): string {
  if (domain.operation === "remove")
    return domain.status === "removed"
      ? "Removed"
      : domain.status === "attention"
        ? "Removal needs attention"
        : "Removing domain";
  switch (domain.status) {
    case "waiting_dns":
      return "Waiting for DNS";
    case "queued":
    case "checking_dns":
      return "Checking domain";
    case "provisioning":
      return "Setting up HTTPS";
    case "connected":
      return domainHttpsReady(domain) ? "Connected" : "HTTPS needs checking";
    default:
      return "Needs attention";
  }
}

export function websiteDomainMessage(domain: WebsiteDomain): string {
  if (domain.operation === "remove")
    return domain.status === "attention"
      ? "This address could not be fully disconnected. Retry removal to finish. Your saved work is kept."
      : "This address is being disconnected. Your pages and saved work are kept.";
  const messages: Record<DomainReason, string> = {
    ownership_missing:
      "The verification record was not found. Check the TXT name and value below, then check the domain again.",
    routing_missing:
      "The domain does not point to this website yet. Add the hosting records below, then check it again.",
    routing_mismatch:
      "Some records point somewhere else. Update the A and AAAA records for this hostname to match the addresses below.",
    lookup_failed:
      "The DNS records could not be checked. Try checking the domain again.",
    domain_in_use:
      "This domain is connected to another website. Remove it there before connecting it here.",
    provider_failed:
      "Hosting setup could not finish. Check the domain again to retry.",
    tls_pending:
      "HTTPS is not ready yet. Check the domain again to retry setup.",
    routing_failed:
      "The website could not be verified at this address. Check the domain again to retry.",
    access_changed:
      "Website access changed during setup. An owner with publishing permission can check the domain again.",
    configuration_changed:
      "The hosting setup changed. Check the domain again to retry.",
  };
  if (domain.reason) return messages[domain.reason];
  if (domain.status === "connected")
    return domainHttpsReady(domain)
      ? domain.bindingKind === "client-primary"
        ? "HTTPS is ready. Publish your pages from Releases to put them at this address."
        : "HTTPS is ready. This is an additional address for your existing published website."
      : "The certificate needs checking. Check the domain before publishing more changes.";
  if (domain.status === "provisioning")
    return "DNS is verified. We are setting up HTTPS and checking the website address.";
  if (domainOperationRunning(domain))
    return "We are checking the DNS records and website connection.";
  return "Add the DNS records below with your domain provider, then check the connection.";
}
