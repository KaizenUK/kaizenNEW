import { afterEach, describe, expect, it, vi } from "vitest";
import { Resolver } from "node:dns/promises";
import {
  assertUnreservedDomain,
  domainVerificationRecord,
  normalizeDomainHostname,
} from "../../shared/builderDomains.ts";
import {
  checkDomainDns,
  createDomainDnsResolver,
  createDomainVerificationToken,
  normalizeDomainIngress,
  type DomainDnsResolver,
} from "../../scripts/builder-domain-dns.ts";

afterEach(() => vi.restoreAllMocks());

const hostname = "customer.fixture.co.uk";
const token = "a".repeat(64);
const ingress = { ipv4: ["144.91.72.17"], ipv6: ["2a01:4f8::17"] };
const input = {
  hostname,
  token,
  ingress,
  reservedHostnames: ["kaizenweb.co.uk"],
};
const verification = domainVerificationRecord(hostname, token);
const answer = (address: string) => ({ address, ttl: 300 });
function resolver(
  overrides: Partial<DomainDnsResolver> = {},
): DomainDnsResolver {
  return {
    txt: vi.fn(async () => [[verification.value]]),
    ipv4: vi.fn(async () => [answer(ingress.ipv4[0])]),
    ipv6: vi.fn(async () => []),
    ...overrides,
  };
}

describe("custom domain names and ownership records", () => {
  it("uses the same case, root-dot and IDNA identity across entry points", () => {
    expect(normalizeDomainHostname("  WWW.Café.co.uk.  ")).toBe(
      "www.xn--caf-dma.co.uk",
    );
    expect(normalizeDomainHostname("www.xn--caf-dma.co.uk")).toBe(
      "www.xn--caf-dma.co.uk",
    );
    expect(domainVerificationRecord("WWW.Café.co.uk.", token).name).toBe(
      "_kaizen-verification.www.xn--caf-dma.co.uk",
    );
  });

  it.each([
    "https://customer.co.uk",
    "customer.co.uk/path",
    "user@customer.co.uk",
    "customer.co.uk:443",
    "customer.co.uk?x=1",
    "customer.co.uk#x",
    "customer.co.uk\\evil",
    "*.customer.co.uk",
    "customer..co.uk",
    "customer.co.uk..",
    "-bad.co.uk",
    "bad-.co.uk",
    "_bad.co.uk",
    "customer%2eco.uk",
    "customer.co.uk\n",
    "cust\u200bomer.co.uk",
    "foo bar.co.uk",
    "localhost",
    "foo.localhost",
    "foo.internal",
    "foo.onion",
    "foo.invalid",
    "foo.test",
    "foo.example",
    "foo.local",
    "127.0.0.1",
    "127.1",
    "0x7f000001",
    "2130706433",
    "[::1]",
    "a".repeat(64) + ".co.uk",
    [
      "a".repeat(63),
      "b".repeat(63),
      "c".repeat(63),
      "d".repeat(40),
      "com",
    ].join("."),
  ])("refuses non-domain or ambiguous input: %s", (value) => {
    expect(() => normalizeDomainHostname(value)).toThrow("Enter a domain name");
  });

  it("reserves whole hostname boundaries without matching unrelated suffixes", () => {
    for (const value of [
      "kaizenweb.co.uk",
      "studio.kaizenweb.co.uk",
      "STUDIO.KAIZENWEB.CO.UK.",
    ]) {
      expect(() => assertUnreservedDomain(value, ["kaizenweb.co.uk"])).toThrow(
        "reserved",
      );
    }
    expect(() =>
      assertUnreservedDomain("notkaizenweb.co.uk", ["kaizenweb.co.uk"]),
    ).not.toThrow();
    expect(() =>
      assertUnreservedDomain("kaizenweb.co.uk.customer.com", [
        "kaizenweb.co.uk",
      ]),
    ).not.toThrow();
  });

  it("generates 256-bit challenges and rejects malformed stored tokens", () => {
    const first = createDomainVerificationToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(createDomainVerificationToken()).not.toBe(first);
    for (const value of ["", token.slice(1), "A".repeat(64), token + "\n"]) {
      expect(() => domainVerificationRecord(hostname, value)).toThrow(
        "verification record is invalid",
      );
    }
  });
});

describe("DNS verification against a fake resolver", () => {
  it("requires the exact ownership record before checking the website addresses", async () => {
    for (const records of [
      [],
      [[verification.value + "suffix"]],
      [[verification.value.toUpperCase()]],
      [[verification.value.slice(0, 30)], [verification.value.slice(30)]],
      [[domainVerificationRecord(hostname, "b".repeat(64)).value]],
    ]) {
      const dns = resolver({ txt: vi.fn(async () => records) });
      expect((await checkDomainDns(input, dns)).status).toBe(
        "ownership_missing",
      );
      expect(dns.ipv4).not.toHaveBeenCalled();
      expect(dns.ipv6).not.toHaveBeenCalled();
    }
  });

  it("joins fragments within one TXT record and checks the normalized exact hostname", async () => {
    const dns = resolver({
      txt: vi.fn(async () => [
        ["unrelated value"],
        [verification.value.slice(0, 30), verification.value.slice(30)],
      ]),
    });
    const result = await checkDomainDns(
      { ...input, hostname: hostname.toUpperCase() + "." },
      dns,
    );
    expect(result).toMatchObject({
      hostname,
      status: "verified",
      ownershipVerified: true,
      addresses: { ipv4: ingress.ipv4, ipv6: [] },
    });
    expect(dns.txt).toHaveBeenCalledWith(verification.name);
    expect(dns.ipv4).toHaveBeenCalledWith(hostname);
    expect(dns.ipv6).toHaveBeenCalledWith(hostname);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("accepts configured IPv6 and canonicalizes equivalent address representations", async () => {
    const dns = resolver({
      ipv4: async () => [],
      ipv6: async () => [answer("2a01:04f8:0:0:0:0:0:17")],
    });
    expect((await checkDomainDns(input, dns)).status).toBe("verified");
    expect(
      normalizeDomainIngress({
        ipv4: [],
        ipv6: ["2a01:04f8:0:0:0:0:0:17", "2a01:4f8::17"],
      }),
    ).toEqual({ ipv4: [], ipv6: ingress.ipv6 });
  });

  it("refuses missing, mixed, stale, private and unconfigured IPv6 routing", async () => {
    expect(
      (await checkDomainDns(input, resolver({ ipv4: async () => [] }))).status,
    ).toBe("routing_missing");
    for (const address of [
      "127.0.0.1",
      "169.254.169.254",
      "10.0.0.1",
      "203.0.113.2",
    ]) {
      const dns = resolver({
        ipv4: async () => [answer(ingress.ipv4[0]), answer(address)],
      });
      expect((await checkDomainDns(input, dns)).status).toBe(
        "routing_mismatch",
      );
    }
    for (const address of ["::1", "::ffff:144.91.72.17", "2a01:4f8::18"]) {
      expect(
        (
          await checkDomainDns(
            input,
            resolver({ ipv6: async () => [answer(address)] }),
          )
        ).status,
      ).toBe("routing_mismatch");
    }
    expect(
      (
        await checkDomainDns(
          { ...input, ingress: { ipv4: ingress.ipv4, ipv6: [] } },
          resolver({ ipv6: async () => [answer(ingress.ipv6[0])] }),
        )
      ).status,
    ).toBe("routing_mismatch");
  });

  it("never treats a failed query as an absent record or reflects resolver details", async () => {
    for (const method of ["txt", "ipv4", "ipv6"] as const) {
      const dns = resolver({
        [method]: async () => {
          throw new Error("private resolver detail");
        },
      });
      const result = await checkDomainDns(input, dns);
      expect(result.status).toBe("lookup_failed");
      expect(JSON.stringify(result)).not.toContain("private resolver detail");
      expect(result.ownershipVerified).toBe(method !== "txt");
    }
  });

  it("rejects malformed and oversized answers instead of trusting partial valid records", async () => {
    for (const bad of [
      { txt: async () => [[verification.value], ["x".repeat(256)]] },
      {
        txt: async () => Array.from({ length: 65 }, () => [verification.value]),
      },
      { ipv4: async () => [answer("127.1")] },
      { ipv4: async () => [{ address: ingress.ipv4[0], ttl: -1 }] },
      { ipv4: async () => [{ address: ingress.ipv4[0], ttl: Infinity }] },
      { ipv4: async () => [answer(ingress.ipv6[0])] },
    ])
      expect((await checkDomainDns(input, resolver(bad))).status).toBe(
        "lookup_failed",
      );
  });

  it("rejects invalid operator configuration and reserved hosts before DNS", async () => {
    const dns = resolver();
    for (const config of [
      { ipv4: [], ipv6: [] },
      { ipv4: ["customer.co.uk"], ipv6: [] },
      { ipv4: ["127.1"], ipv6: [] },
      { ipv4: [], ipv6: ["https://[::1]"] },
    ]) {
      await expect(
        checkDomainDns({ ...input, ingress: config }, dns),
      ).rejects.toThrow();
    }
    await expect(
      checkDomainDns({ ...input, hostname: "studio.kaizenweb.co.uk" }, dns),
    ).rejects.toThrow("reserved");
    expect(dns.txt).not.toHaveBeenCalled();
  });

  it("requires fresh ownership and routing on each call", async () => {
    const txt = vi
      .fn()
      .mockResolvedValueOnce([[verification.value]])
      .mockResolvedValueOnce([]);
    const dns = resolver({ txt });
    expect((await checkDomainDns(input, dns)).status).toBe("verified");
    expect((await checkDomainDns(input, dns)).status).toBe("ownership_missing");
    expect(dns.ipv4).toHaveBeenCalledTimes(1);
  });

  it("distinguishes NXDOMAIN and NODATA from resolver failures at the Node DNS boundary", async () => {
    const txt = vi.spyOn(Resolver.prototype, "resolveTxt");
    const ipv4 = vi.spyOn(Resolver.prototype, "resolve4");
    const ipv6 = vi.spyOn(Resolver.prototype, "resolve6");
    const missing = (code: string) =>
      Object.assign(new Error("internal resolver detail"), { code });
    txt.mockResolvedValue([[verification.value]]);
    ipv4.mockResolvedValue([answer(ingress.ipv4[0])]);
    for (const code of ["ENODATA", "ENOTFOUND"]) {
      ipv6.mockRejectedValue(missing(code));
      expect(
        (await checkDomainDns(input, createDomainDnsResolver())).status,
      ).toBe("verified");
    }
    for (const code of ["ETIMEOUT", "ESERVFAIL", "EREFUSED", "ECANCELLED"]) {
      ipv6.mockRejectedValue(missing(code));
      expect(
        (await checkDomainDns(input, createDomainDnsResolver())).status,
      ).toBe("lookup_failed");
    }
    txt.mockRejectedValue(missing("ENOTFOUND"));
    expect(
      (await checkDomainDns(input, createDomainDnsResolver())).status,
    ).toBe("ownership_missing");
    txt.mockRejectedValue(missing("ETIMEOUT"));
    expect(
      (await checkDomainDns(input, createDomainDnsResolver())).status,
    ).toBe("lookup_failed");
  });
});
