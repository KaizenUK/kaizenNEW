import { expect, it } from "vitest";
import {
  ensureDomainCertificate,
  assertDomainCertificateMatches,
  DomainCertificateError,
} from "../../scripts/builder-domain-certificates";
import { DirectAdminError } from "../../scripts/builder-directadmin-api";

const hostname = "customer.fixture.co.uk";
const extra = [`www.${hostname}`, `mail.${hostname}`, `*.${hostname}`];
function fixture() {
  const state = {
    config: {
      creatorDnsProvider: "",
      dnsEnvironment: {},
      dnsProvider: "",
      enabled: false,
      globalDnsProvider: "",
      keyType: "ec256",
      preferWildcard: true,
      provider: "letsencrypt",
      skipDNSNames: [] as string[],
    },
    issued: false,
    failedTarget: false,
    failureCAA: false,
    inheritedProvider: false,
    changedAfterEnable: false,
    inProgress: false,
    rateLimited: false,
    lostResponse: false,
    ignoreSkip: false,
    renewable: true,
    certificateMode: "good",
    badProvision: false,
  };
  const calls: { method: string; pathname: string; body?: any }[] = [];
  const currentPlan = () => {
    const allowed = [hostname, extra[0]].filter(
      (name) => !state.config.skipDNSNames.includes(name),
    );
    if (state.changedAfterEnable && state.config.enabled)
      allowed.push("surprise.fixture.co.uk");
    const blocked = state.failedTarget
      ? allowed.filter((name) => name !== hostname)
      : allowed;
    return {
      acmeEnabled: state.config.enabled,
      acmeInProgress: state.inProgress,
      ratelimitReached: state.rateLimited,
      certsPending:
        state.issued || !blocked.length
          ? []
          : [{ certID: hostname, challengeType: "HTTP-01", dnsNames: blocked }],
      certsFulfilled: state.issued
        ? [{ certID: hostname, dnsNames: blocked }]
        : [],
      certsObsolete: !state.issued
        ? [{ certID: "old-wildcard", dnsNames: [extra[2]] }]
        : [],
      dnsNamesFailedCAA: state.failureCAA ? [hostname] : [],
      dnsNamesFailedChallenge: [
        ...(state.failedTarget ? [hostname] : []),
        ...(!state.config.skipDNSNames.includes(extra[1]) ? [extra[1]] : []),
      ],
      dnsNamesSkipped: [...state.config.skipDNSNames],
    };
  };
  const certificate = () => ({
    id: hostname,
    autorenewEnabled: state.renewable && state.config.enabled,
    selfSigned: state.certificateMode === "self",
    validationError: state.certificateMode === "invalid" ? "untrusted" : "",
    certificate: {
      dnsNames:
        state.certificateMode === "extra" ? [hostname, extra[0]] : [hostname],
      ipAddresses: state.certificateMode === "ip" ? ["144.91.72.17"] : [],
      serialNumber: "00:01:AB",
      notBefore: new Date(
        Date.now() +
          (state.certificateMode === "future" ? 86400000 : -86400000),
      ).toISOString(),
      notAfter: new Date(
        Date.now() +
          (state.certificateMode === "expires" ? 1000 : 86400000 * 30),
      ).toISOString(),
    },
  });
  const api = async (
    method: "GET" | "POST" | "PUT",
    pathname: string,
    body?: any,
  ) => {
    calls.push({
      method,
      pathname,
      body: body === undefined ? undefined : structuredClone(body),
    });
    if (pathname.endsWith("/acme-config")) {
      if (method === "PUT") {
        state.config = structuredClone(body);
        if (state.inheritedProvider)
          state.config.globalDnsProvider = "cloudflare";
        if (state.ignoreSkip) state.config.skipDNSNames = [];
        return undefined;
      }
      return structuredClone(state.config);
    }
    if (pathname.endsWith("/provision-certs-dry-run")) return currentPlan();
    if (pathname.endsWith("/certs"))
      return {
        certIds: state.issued ? [hostname] : [],
        certs: state.issued ? [certificate()] : [],
        missingDNSNames: state.issued ? [] : [hostname],
      };
    if (pathname.endsWith("/provision-certs")) {
      expect(state.config.enabled).toBe(true);
      expect(state.config.preferWildcard).toBe(false);
      expect(new Set(state.config.skipDNSNames)).toEqual(new Set(extra));
      const request = {
        certID: hostname,
        challengeType: "HTTP-01",
        dnsNames: [hostname],
      };
      state.issued = true;
      if (state.lostResponse) {
        state.lostResponse = false;
        throw new DirectAdminError();
      }
      return {
        provisionResults: [
          {
            request,
            success: !state.badProvision,
            output: "private ACME diagnostic must not escape",
          },
        ],
      };
    }
    if (pathname === "/CMD_API_DOMAIN?json=yes") return { error: "0" };
    throw new Error("Unexpected fixture API request");
  };
  const guard = async () => {};
  return {
    state,
    calls,
    api,
    guard,
    ensure: () => ensureDomainCertificate(hostname, api, guard),
  };
}

it("excludes pending, failed and obsolete names before enabling exact HTTP issuance", async () => {
  const f = fixture();
  const evidence = await f.ensure();
  expect(evidence).toMatchObject({
    certificateAutoRenew: true,
    certificateNames: [hostname],
    certificateSerialNumber: "1ab",
  });
  const updates = f.calls.filter((c) => c.method === "PUT");
  expect(updates.map((c) => c.body.enabled)).toEqual([false, false, true]);
  expect(updates[2].body.skipDNSNames).toEqual([...extra].sort());
  expect(f.calls[f.calls.length - 1].body).toEqual({
    action: "modify",
    domain: hostname,
    ubandwidth: "unlimited",
    uquota: "unlimited",
    ssl: "ON",
  });
});

it("reuses a current certificate and renewal setup without issuing again", async () => {
  const f = fixture();
  await f.ensure();
  const writes = f.calls.filter((c) => c.method === "PUT").length;
  await f.ensure();
  expect(f.calls.filter((c) => c.method === "PUT")).toHaveLength(writes);
  expect(
    f.calls.filter((c) => c.pathname.endsWith("/provision-certs")),
  ).toHaveLength(1);
});

it("recovers an issued certificate after its response was lost without duplicate issuance", async () => {
  const f = fixture();
  f.state.lostResponse = true;
  await expect(f.ensure()).rejects.toMatchObject({ reason: "tls_pending" });
  await expect(f.ensure()).resolves.toMatchObject({
    certificateAutoRenew: true,
  });
  expect(
    f.calls.filter((c) => c.pathname.endsWith("/provision-certs")),
  ).toHaveLength(1);
});

it.each(["failedTarget", "failureCAA", "inProgress", "rateLimited"])(
  "keeps %s work pending without issuance",
  async (key) => {
    const f = fixture();
    f.state[key] = true;
    await expect(f.ensure()).rejects.toMatchObject({ reason: "tls_pending" });
    expect(f.calls.some((c) => c.pathname.endsWith("/provision-certs"))).toBe(
      false,
    );
    expect(f.state.config.enabled).toBe(false);
  },
);

it.each(["inheritedProvider", "ignoreSkip"])(
  "refuses %s settings that do not match readback",
  async (key) => {
    const f = fixture();
    f.state[key] = true;
    await expect(f.ensure()).rejects.toMatchObject({
      reason: "configuration_changed",
    });
    expect(f.calls.some((c) => c.pathname.endsWith("/provision-certs"))).toBe(
      false,
    );
  },
);

it("disables setup if another name appears as soon as ACME is enabled", async () => {
  const f = fixture();
  f.state.changedAfterEnable = true;
  await expect(f.ensure()).rejects.toMatchObject({
    reason: "configuration_changed",
  });
  expect(f.state.config.enabled).toBe(false);
  expect(f.calls.some((c) => c.pathname.endsWith("/provision-certs"))).toBe(
    false,
  );
});

it("adds failed names to exclusions even when an enabled plan currently requests only the target", async () => {
  const f = fixture();
  f.state.config.enabled = true;
  f.state.config.preferWildcard = false;
  f.state.config.skipDNSNames = [extra[0], extra[2]];
  await f.ensure();
  expect(f.state.config.skipDNSNames).toContain(extra[1]);
});

it.each(["expires", "future", "self", "invalid", "extra", "ip"])(
  "refuses a %s inventory certificate without enabling its HTTPS host",
  async (mode) => {
    const f = fixture();
    f.state.certificateMode = mode;
    await expect(f.ensure()).rejects.toMatchObject({ reason: "tls_pending" });
    expect(f.calls.some((c) => c.pathname === "/CMD_API_DOMAIN?json=yes")).toBe(
      false,
    );
  },
);

it("requires actual automatic renewal and refuses unsuccessful provider results", async () => {
  const f = fixture();
  f.state.renewable = false;
  await expect(f.ensure()).rejects.toMatchObject({ reason: "tls_pending" });
  const failed = fixture();
  failed.state.badProvision = true;
  const error = await failed.ensure().catch((error) => error);
  expect(error).toBeInstanceOf(DomainCertificateError);
  expect(String(error)).not.toContain("private ACME");
});

it("rechecks authority before each request and stops before the next mutation", async () => {
  const f = fixture();
  let checks = 0;
  await expect(
    ensureDomainCertificate(hostname, f.api, async () => {
      if (++checks === 2) throw new Error("Authority changed");
    }),
  ).rejects.toThrow("Authority changed");
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0].method).toBe("GET");
});

it("requires the renewal record to match the actual served certificate", async () => {
  const f = fixture(),
    certificate = await f.ensure();
  expect(() =>
    assertDomainCertificateMatches(certificate, {
      ...certificate,
      certificateSerialNumber: "00:01:AB",
    }),
  ).not.toThrow();
  for (const change of [
    { certificateSerialNumber: "1ac" },
    { certificateNames: [hostname, extra[0]] },
    {
      certificateExpiresAt: new Date(
        Date.parse(certificate.certificateExpiresAt) + 1000,
      ).toISOString(),
    },
  ])
    expect(() =>
      assertDomainCertificateMatches(certificate, {
        ...certificate,
        ...change,
      }),
    ).toThrow();
});
