import { randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import {
  assertUnreservedDomain,
  domainVerificationRecord,
  normalizeDomainHostname,
} from "../shared/builderDomains.ts";

type AddressRecord = { address: string; ttl: number };
export type DomainDnsResolver = {
  txt(name: string): Promise<string[][]>;
  ipv4(name: string): Promise<AddressRecord[]>;
  ipv6(name: string): Promise<AddressRecord[]>;
};
export type DomainIngress = { ipv4: string[]; ipv6: string[] };
export type DomainDnsCheck = {
  hostname: string;
  checkedAt: string;
  status:
    | "verified"
    | "ownership_missing"
    | "routing_missing"
    | "routing_mismatch"
    | "lookup_failed";
  ownershipVerified: boolean;
  addresses: DomainIngress;
};

export const createDomainVerificationToken = () =>
  randomBytes(32).toString("hex");

function canonicalAddress(value: unknown, family: 4 | 6): string {
  if (typeof value !== "string" || isIP(value) !== family)
    throw new Error("Invalid DNS address.");
  return family === 4
    ? value
    : new URL(`http://[${value}]/`).hostname.slice(1, -1);
}

/** This allowlist comes from the server configuration, never from the domain request. */
export function normalizeDomainIngress(value: DomainIngress): DomainIngress {
  if (
    !value ||
    !Array.isArray(value.ipv4) ||
    !Array.isArray(value.ipv6) ||
    value.ipv4.length + value.ipv6.length < 1 ||
    value.ipv4.length + value.ipv6.length > 16
  ) {
    throw new Error("Configure the domain worker's fixed hosting addresses.");
  }
  return {
    ipv4: [
      ...new Set(value.ipv4.map((address) => canonicalAddress(address, 4))),
    ].sort(),
    ipv6: [
      ...new Set(value.ipv6.map((address) => canonicalAddress(address, 6))),
    ].sort(),
  };
}

function addresses(records: AddressRecord[], family: 4 | 6): string[] {
  if (!Array.isArray(records) || records.length > 64)
    throw new Error("Invalid DNS answer.");
  return [
    ...new Set(
      records.map((record) => {
        if (
          !record ||
          !Number.isInteger(record.ttl) ||
          record.ttl < 0 ||
          record.ttl > 2147483647
        ) {
          throw new Error("Invalid DNS answer.");
        }
        return canonicalAddress(record.address, family);
      }),
    ),
  ].sort();
}

function hasOwnership(records: string[][], expected: string): boolean {
  if (!Array.isArray(records) || records.length > 64)
    throw new Error("Invalid DNS answer.");
  const values = records.map((chunks) => {
    if (
      !Array.isArray(chunks) ||
      chunks.length > 32 ||
      chunks.some(
        (chunk) => typeof chunk !== "string" || Buffer.byteLength(chunk) > 255,
      ) ||
      Buffer.byteLength(chunks.join("")) > 4096
    )
      throw new Error("Invalid DNS answer.");
    // DNS TXT fragments form one record. Separate records must never be joined.
    return chunks.join("");
  });
  return values.includes(expected);
}

/** Check DNS only. A passing result does not prove a certificate or a publication. */
export async function checkDomainDns(
  input: {
    hostname: string;
    token: string;
    ingress: DomainIngress;
    reservedHostnames: readonly string[];
  },
  dns: DomainDnsResolver = createDomainDnsResolver(),
): Promise<DomainDnsCheck> {
  const hostname = normalizeDomainHostname(input.hostname);
  assertUnreservedDomain(hostname, input.reservedHostnames);
  const ingress = normalizeDomainIngress(input.ingress);
  const record = domainVerificationRecord(hostname, input.token);
  const result: DomainDnsCheck = {
    hostname,
    checkedAt: new Date().toISOString(),
    status: "lookup_failed",
    ownershipVerified: false,
    addresses: { ipv4: [], ipv6: [] },
  };
  try {
    if (!hasOwnership(await dns.txt(record.name), record.value)) {
      return { ...result, status: "ownership_missing" };
    }
    result.ownershipVerified = true;
    // Settle both families: a timeout must not be mistaken for an absent AAAA.
    const answers = await Promise.allSettled([
      dns.ipv4(hostname),
      dns.ipv6(hostname),
    ]);
    if (answers[0].status !== "fulfilled" || answers[1].status !== "fulfilled")
      return result;
    result.addresses = {
      ipv4: addresses(answers[0].value, 4),
      ipv6: addresses(answers[1].value, 6),
    };
    if (!result.addresses.ipv4.length && !result.addresses.ipv6.length) {
      return { ...result, status: "routing_missing" };
    }
    const matches =
      result.addresses.ipv4.every((address) =>
        ingress.ipv4.includes(address),
      ) &&
      result.addresses.ipv6.every((address) => ingress.ipv6.includes(address));
    return { ...result, status: matches ? "verified" : "routing_mismatch" };
  } catch {
    // Do not reflect resolver internals, arbitrary TXT content or provider errors.
    return result;
  }
}

/** One bounded resolver per check; hostname answers are never used as HTTP targets. */
export function createDomainDnsResolver(): DomainDnsResolver {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  const query = async <T>(operation: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await operation();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENODATA" || code === "ENOTFOUND") return [];
      throw new Error("The domain's DNS could not be checked. Try again.");
    }
  };
  return {
    txt: (name) => query(() => resolver.resolveTxt(name)),
    ipv4: (name) => query(() => resolver.resolve4(name, { ttl: true })),
    ipv6: (name) => query(() => resolver.resolve6(name, { ttl: true })),
  };
}
