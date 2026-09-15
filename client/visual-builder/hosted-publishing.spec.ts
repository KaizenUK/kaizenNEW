import { afterEach, describe, expect, it, vi } from "vitest";
import {
  writeFile,
  readFile,
  lstat,
  rm,
  symlink,
  link,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import { HostedRepositoryBilling } from "../../scripts/builder-hosted-billing";
import type {
  RepositoryBillingInput,
  RepositoryUsageState,
  RepositoryUsageInput,
} from "../../shared/builderRepositoryBilling";
import {
  hostedHelperFixture,
  helperProject,
  helperOwner,
  helperEditor,
  helperOtherProject,
} from "../../tests/builder/hosted-helper-fixture";
import { hostedProjectRepositories } from "../../scripts/builder-hosted-folders";
import { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";
import { hostedReleaseMarker } from "../../scripts/builder-hosted-publishing";
import {
  HostedReceiptStore,
  receiptError,
} from "../../scripts/builder-hosted-receipts";

type Fixture = Awaited<ReturnType<typeof hostedHelperFixture>>;
const fixtures: Fixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const api of fixtures.splice(0).reverse()) await api.close();
});
const staging = {
  environment: "staging" as const,
  url: "https://stage.fixture.invalid",
};
const production = {
  environment: "production" as const,
  branch: "main",
  url: "https://production.fixture.invalid",
};
async function fixture(
  billing?: HostedRepositoryBilling,
  buildScript?: string,
) {
  const deployed = {
    stage: "",
    main: "",
    stageId: "fixture-stage",
    mainId: "fixture-main",
  };
  const requests: { url: string; options?: RequestInit }[] = [];
  const api = await hostedHelperFixture(
    undefined,
    buildScript,
    undefined,
    undefined,
    { target: staging },
    undefined,
    {
      target: production,
      billing,
      fetch: async (url: string | URL | Request, options?: RequestInit) => {
        requests.push({ url: String(url), options });
        const stage = new URL(String(url)).origin === staging.url;
        return Response.json({
          schemaVersion: 1,
          commit: stage ? deployed.stage : deployed.main,
          releaseId: stage ? deployed.stageId : deployed.mainId,
        });
      },
    },
  );
  fixtures.push(api);
  await api.git(api.seed, [
    "commit",
    "--allow-empty",
    "-m",
    "Second baseline commit",
  ]);
  await api.git(api.seed, ["push", api.remote, "stage"]);
  const base = await api.git(api.remote, ["rev-parse", "stage"]);
  await api.git(api.remote, ["branch", "main", base]);
  deployed.stage = deployed.main = base;
  return { api, deployed, requests, base };
}
async function saved(api: Fixture) {
  const inspected = (
    await api.send({
      action: "repository-source-inspect",
      route: "src/pages/index.astro",
    })
  ).body;
  const heading = inspected.fields.find(
    (field: { value: string }) => field.value === "Hosted original",
  );
  const plan = await api.send({
    action: "repository-source-prepare",
    edits: {
      inspection: inspected,
      values: { [heading.id]: "Reviewed staging heading" },
      orders: {},
    },
  });
  expect(plan.status).toBe(200);
  expect(
    (await api.send({ action: "repository-apply", planId: plan.body.id }))
      .status,
  ).toBe(200);
  const result = await api.send({
    action: "repository-save",
    planId: plan.body.id,
    message: "Update the website heading",
  });
  expect(result).toMatchObject({ status: 200, body: { phase: "saved" } });
  return result.body.commit as string;
}
const review = (api: Fixture, actor = helperOwner) =>
  api.send({ action: "repository-publish-review" }, actor);
const publish = (
  api: Fixture,
  reviewId: unknown,
  actor = helperOwner,
  extra = {},
) => api.send({ action: "repository-publish", reviewId, ...extra }, actor);
const status = (api: Fixture, reviewId?: string) =>
  api.send({
    action: "repository-publish-status",
    ...(reviewId ? { reviewId } : {}),
  });
const main = (api: Fixture) => api.git(api.remote, ["rev-parse", "main"]);
async function ready(billing?: HostedRepositoryBilling) {
  const data = await fixture(billing);
  data.deployed.stage = await saved(data.api);
  return data;
}
const receiptFile = (api: Fixture) =>
  path.join(
    api.folders.projectDirectory(helperProject),
    "publication-receipts.json",
  );

function billingFixture() {
  const secret = "ab".repeat(32),
    calls: RepositoryBillingInput[] = [];
  const faults = {
    quota: false,
    lostReserve: false,
    settlement: false,
    sourceQuota: false,
    lostUsage: false,
  };
  const usage: RepositoryUsageState = { version: 0, measurements: {} };
  const usageCalls: RepositoryUsageInput[] = [];
  const billing = new HostedRepositoryBilling({
    url: "https://billing.fixture.test/",
    anonKey: "fixture-public",
    secret,
    fetch: async (url, init) => {
      expect(String(url)).toBe(
        "https://billing.fixture.test/functions/v1/builder-billing",
      );
      const headers = new Headers(init?.headers),
        body = JSON.parse(String(init?.body));
      const token = headers.get("authorization")!.slice(7);
      expect(headers.get("x-kaizen-helper-signature")).toBe(
        createHmac("sha256", Buffer.from(secret, "hex"))
          .update(JSON.stringify(body) + "\n" + token)
          .digest("hex"),
      );
      expect(body).not.toHaveProperty("actor");
      if (body.action === "repository-usage-read") return Response.json(usage);
      if (body.action === "repository-usage-write") {
        usageCalls.push(body);
        if (body.version !== usage.version)
          return Response.json(
            { error: "Website storage changed." },
            { status: 409 },
          );
        if (faults.sourceQuota && body.operation === "reserve")
          return Response.json(
            { error: "This website exceeds its storage plan." },
            { status: 429 },
          );
        if (body.channel === "preview" && body.sample.pages > 5)
          return Response.json(
            { error: "This website exceeds its page plan." },
            { status: 429 },
          );
        usage.version++;
        usage.measurements[body.channel] = body.sample;
        if (faults.lostUsage && body.operation === "reserve") {
          faults.lostUsage = false;
          throw new Error("Fixture storage acknowledgement lost");
        }
        return Response.json(usage);
      }
      calls.push(body);
      if (body.action === "repository-reserve" && faults.quota)
        return Response.json(
          { error: "The monthly publishing limit is reached." },
          { status: 429 },
        );
      if (body.action === "repository-reserve" && faults.lostReserve) {
        faults.lostReserve = false;
        throw new Error("Fixture reserve acknowledgement lost");
      }
      if (body.action === "repository-settle" && faults.settlement)
        throw new Error("Fixture settlement unavailable");
      return Response.json({
        attempt: body.attempt,
        phase: body.action === "repository-reserve" ? "reserved" : body.outcome,
      });
    },
  });
  return { billing, calls, faults, secret, usage, usageCalls };
}

describe("repository publication billing", () => {
  it.each(["quota", "lostReserve"] as const)(
    "%s denial happens before Git and an explicit retry advances the fenced attempt",
    async (fault) => {
      const ledger = billingFixture(),
        { api, deployed, base } = await ready(ledger.billing);
      const inspected = await review(api);
      ledger.faults[fault] = true;
      const denied = await publish(api, inspected.body.review.id);
      expect(denied.status).toBe(fault === "quota" ? 429 : 503);
      expect(await main(api)).toBe(base);
      expect(ledger.calls.map((c) => [c.action, c.attempt, c.outcome])).toEqual(
        [
          ["repository-reserve", 1, undefined],
          ["repository-settle", 1, "failed"],
        ],
      );
      ledger.faults[fault] = false;
      expect((await publish(api, inspected.body.review.id)).body.phase).toBe(
        "sent",
      );
      expect(await main(api)).toBe(deployed.stage);
      expect(
        ledger.calls
          .filter((c) => c.action === "repository-reserve")
          .map((c) => c.attempt),
      ).toEqual([1, 2]);
      const receipt = await readFile(receiptFile(api), "utf8");
      expect(receipt).not.toContain(ledger.secret);
      expect(JSON.parse(receipt).data[0]).toMatchObject({
        billing: { attempt: 2, phase: "sent" },
        billingPushStarted: true,
      });
    },
  );
  it("retains the allowance across a rejected or uncertain Git push and reuses it after restart", async () => {
    const ledger = billingFixture(),
      { api, deployed, base } = await ready(ledger.billing);
    const inspected = await review(api),
      hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o700 });
    expect((await publish(api, inspected.body.review.id)).body.phase).toBe(
      "reviewed",
    );
    expect(await main(api)).toBe(base);
    expect(ledger.calls.map((c) => c.action)).toEqual(["repository-reserve"]);
    await api.restart();
    expect((await status(api)).body.phase).toBe("reviewed");
    expect(ledger.calls).toHaveLength(1);
    await rm(hook);
    const original = api.folders.pushPublication.bind(api.folders);
    vi.spyOn(api.folders, "pushPublication").mockImplementationOnce(
      async (...args) => {
        await original(...args);
        vi.spyOn(api.folders, "productionHead").mockRejectedValue(
          new Error("Fixture observation unavailable"),
        );
        throw new Error("Fixture lost Git acknowledgement");
      },
    );
    expect((await publish(api, inspected.body.review.id)).body.phase).toBe(
      "uncertain",
    );
    expect(
      ledger.calls
        .filter((c) => c.action === "repository-reserve")
        .map((c) => c.attempt),
    ).toEqual([1, 1]);
    expect(ledger.calls.some((c) => c.outcome === "failed")).toBe(false);
    await api.restart();
    const nextPush = vi.spyOn(api.folders, "pushPublication");
    expect((await status(api)).body.phase).toBe("sent");
    deployed.main = deployed.stage;
    expect((await status(api)).body.delivery).toBe("reported");
    await status(api);
    expect(ledger.calls.filter((c) => c.outcome === "live")).toHaveLength(1);
    expect(nextPush).not.toHaveBeenCalled();
  });
  it("keeps successful Git delivery separate from unavailable billing, then reconciles without pushing again", async () => {
    const ledger = billingFixture(),
      { api, deployed } = await ready(ledger.billing);
    const inspected = await review(api);
    ledger.faults.settlement = true;
    const result = await publish(api, inspected.body.review.id);
    expect(result.status).toBe(200);
    expect(result.body.phase).toBe("sent");
    expect(result.body.error).toContain("billing still needs");
    expect(await main(api)).toBe(deployed.stage);
    expect((await review(api)).status).toBe(409);
    ledger.faults.settlement = false;
    deployed.main = deployed.stage;
    await api.restart();
    const push = vi.spyOn(api.folders, "pushPublication");
    const checked = await status(api);
    expect(checked.body.delivery).toBe("reported");
    expect(checked.body.error).toBeUndefined();
    expect(push).not.toHaveBeenCalled();
    expect(
      JSON.parse(await readFile(receiptFile(api), "utf8")).data[0].billing
        .phase,
    ).toBe("live");
    expect(
      await api.folders.buildEnvironment(helperProject),
    ).not.toHaveProperty("BUILDER_HOSTED_BILLING_KEY");
  });
});

describe("reviewed production publication", () => {
  it("promotes the exact staged commit without creating a commit or switching the checkout and separately reports production delivery", async () => {
    const { api, deployed, requests, base } = await ready();
    expect(
      (await api.send({ action: "repository-connect" })).body.canPublishWebsite,
    ).toBe(true);
    const inspected = await review(api);
    expect(inspected).toMatchObject({
      status: 200,
      body: {
        phase: "reviewed",
        review: {
          commit: deployed.stage,
          productionBase: base,
          files: ["src/pages/index.astro"],
          stagingUrl: staging.url,
          productionUrl: production.url,
        },
      },
    });
    expect(await main(api)).toBe(base);
    for (const missingReview of [undefined, null, "", 123])
      expect((await publish(api, missingReview)).status).toBe(409);
    expect(await main(api)).toBe(base);
    const pushed = await publish(api, inspected.body.review.id, helperOwner, {
      branch: "attacker",
      commit: base,
      productionUrl: "https://outside.invalid",
    });
    expect(pushed).toMatchObject({
      status: 200,
      body: {
        phase: "sent",
        delivery: "waiting",
        release: { state: "unavailable" },
      },
    });
    expect(await main(api)).toBe(deployed.stage);
    expect(
      await api.git(api.folders.root(helperProject), [
        "branch",
        "--show-current",
      ]),
    ).toBe("stage");
    expect(
      await api.git(api.remote, ["show", "main:src/pages/index.astro"]),
    ).toContain("Reviewed staging heading");
    expect(
      await api.git(api.folders.root(helperProject), ["status", "--porcelain"]),
    ).toBe("");
    expect((await publish(api, inspected.body.review.id)).status).toBe(409);
    deployed.main = deployed.stage;
    expect((await status(api)).body).toMatchObject({
      phase: "sent",
      delivery: "reported",
    });
    expect((await review(api)).status).toBe(409);
    expect(
      requests.every((item) =>
        [staging.url, production.url].includes(new URL(item.url).origin),
      ),
    ).toBe(true);
    for (const request of requests) {
      expect(request.options).toMatchObject({
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      expect(request.options?.headers).not.toHaveProperty("Authorization");
    }
  });
  it("requires publish permission even for owners before touching disk, and keeps reviews bound to their project and publisher", async () => {
    const { api, deployed } = await fixture();
    api.publishers.get(helperProject)!.clear();
    for (const action of [
      "repository-publish-review",
      "repository-publish",
      "repository-publish-status",
    ])
      expect((await api.send({ action })).status).toBe(403);
    await expect(lstat(api.folders.directory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    deployed.stage = await saved(api);
    api.publishers.get(helperProject)!.add(helperEditor);
    const reviewed = await review(api, helperEditor);
    expect(reviewed.status).toBe(200);
    api.publishers.get(helperProject)!.add(helperOwner);
    expect((await publish(api, reviewed.body.review.id)).status).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-publish",
          projectId: helperOtherProject,
          reviewId: reviewed.body.review.id,
        })
      ).status,
    ).toBe(409);
    api.archived.add(helperProject);
    expect(
      (await publish(api, reviewed.body.review.id, helperEditor)).status,
    ).toBe(403);
  });
  it("requires the saved revision to be deployed on staging and refuses dirty work, moved staging and a changed staging release", async () => {
    const { api, deployed, base } = await fixture();
    const commit = await saved(api);
    expect((await review(api)).body.error).toContain("not serving");
    deployed.stage = commit;
    const root = api.folders.root(helperProject);
    await writeFile(path.join(root, "README.md"), "New pending work\n");
    expect((await review(api)).body.error).toContain("unsaved");
    await api.git(root, ["restore", "README.md"]);
    const reviewed = await review(api);
    deployed.stageId = "new-staging-release";
    expect((await publish(api, reviewed.body.review.id)).body.error).toContain(
      "staging deployment changed",
    );
    expect(await main(api)).toBe(base);
    const second = await review(api);
    await api.git(api.remote, ["update-ref", "refs/heads/stage", base, commit]);
    expect((await publish(api, second.body.review.id)).body.error).toContain(
      "staging branch changed",
    );
    expect(await main(api)).toBe(base);
  });
  it("checks permission again after waiting for the lock and immediately before pushing", async () => {
    const { api, deployed, base } = await ready();
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = api.folders.locked(helperProject, async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await waiting;
    const calls = api.calls.length;
    const request = review(api);
    await expect
      .poll(() =>
        api.calls
          .slice(calls)
          .some((call) => call.body?.capability === "publish"),
      )
      .toBe(true);
    api.publishers.get(helperProject)!.delete(helperOwner);
    release();
    await held;
    expect((await request).status).toBe(403);
    api.publishers.get(helperProject)!.add(helperOwner);
    const reviewed = await review(api);
    const original = api.folders.productionHead.bind(api.folders);
    vi.spyOn(api.folders, "productionHead").mockImplementationOnce(
      async (id) => {
        const result = await original(id);
        api.publishers.get(id)!.delete(helperOwner);
        return result;
      },
    );
    expect((await publish(api, reviewed.body.review.id)).status).toBe(403);
    expect(await main(api)).toBe(base);
    expect(deployed.stage).not.toBe(base);
  });
  it.each(["advance", "rewind"])(
    "rejects a production %s at push time without rewriting remote work",
    async (direction) => {
      const { api, base } = await ready();
      const reviewed = await review(api),
        original = api.folders.pushPublication.bind(api.folders);
      const changed =
        direction === "rewind"
          ? await api.git(api.seed, ["rev-parse", "HEAD^"])
          : (await api.git(api.seed, [
              "commit",
              "--allow-empty",
              "-m",
              "Concurrent production work",
            ]),
            await api.git(api.seed, ["rev-parse", "HEAD"]));
      if (direction === "advance")
        await api.git(api.seed, [
          "push",
          api.remote,
          "HEAD:refs/heads/fixture-production-object",
        ]);
      vi.spyOn(api.folders, "pushPublication").mockImplementationOnce(
        async (id, commit, old, authorize) => {
          await api.git(api.remote, [
            "update-ref",
            "refs/heads/main",
            changed,
            base,
          ]);
          return original(id, commit, old, authorize);
        },
      );
      const result = await publish(api, reviewed.body.review.id);
      expect(result).toMatchObject({
        status: 200,
        body: { phase: "uncertain" },
      });
      expect(await main(api)).toBe(changed);
      expect((await review(api)).body.error).toContain("outstanding");
    },
  );
  it("refuses divergent production history even when replacement refs make it appear ancestral", async () => {
    const { api, deployed } = await ready();
    await writeFile(
      path.join(api.seed, "README.md"),
      "Other production content\n",
    );
    await api.git(api.seed, ["commit", "-am", "Independent production work"]);
    await api.git(api.seed, ["push", api.remote, "HEAD:main"]);
    const remote = await main(api),
      root = api.folders.root(helperProject);
    await api.folders.fetchProduction(helperProject);
    await api.git(root, ["replace", "--graft", deployed.stage, remote]);
    expect((await review(api)).body.error).toContain(
      "outside this staging revision",
    );
    expect(await main(api)).toBe(remote);
  });
  it("keeps rejected publication available for explicit retry and resolves a lost acknowledgement without another push", async () => {
    const { api, deployed, base } = await ready();
    const reviewed = await review(api),
      hook = path.join(api.remote, "hooks/pre-receive");
    await writeFile(
      hook,
      "#!/bin/sh\necho private-rejection-detail >&2\nexit 1\n",
      { mode: 0o700 },
    );
    const failed = await publish(api, reviewed.body.review.id);
    expect(failed).toMatchObject({ status: 200, body: { phase: "reviewed" } });
    expect(JSON.stringify(failed.body)).not.toContain(
      "private-rejection-detail",
    );
    expect(await main(api)).toBe(base);
    expect((await status(api)).body.phase).toBe("reviewed");
    expect(await main(api)).toBe(base);
    await rm(hook);
    const original = api.folders.pushPublication.bind(api.folders);
    const push = vi
      .spyOn(api.folders, "pushPublication")
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new Error("lost fixture acknowledgement");
      });
    expect((await publish(api, reviewed.body.review.id)).body.phase).toBe(
      "sent",
    );
    expect(await main(api)).toBe(deployed.stage);
    await status(api);
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("expires reviews and refuses publication while the real build lock is held", async () => {
    const { api, base } = await ready();
    const reviewed = await review(api);
    const release = await api.folders.locked(helperProject, () =>
      api.folders.claimBuild(helperProject, "fixture-build"),
    );
    try {
      expect(
        (await publish(api, reviewed.body.review.id)).body.error,
      ).toContain("build owns");
    } finally {
      await release();
    }
    vi.spyOn(Date, "now").mockReturnValue(reviewed.body.review.expiresAt + 1);
    expect((await publish(api, reviewed.body.review.id)).body.error).toContain(
      "expired",
    );
    expect(await main(api)).toBe(base);
  });
  it("accepts only a distinct operator-configured production destination and does not let owner retargeting retain its approval", async () => {
    const repo = {
      projectId: helperProject,
      repositoryUrl: "git@github.com:fixture/site.git",
      branch: "stage",
      saveToWebsite: staging,
    };
    for (const target of [
      { ...production, branch: "stage" },
      { ...production, url: staging.url },
      { ...production, branch: "../main" },
      { ...production, url: "http://outside.invalid" },
      { ...production, privateKey: "no" },
      { ...production, workflow: "../deploy.yml" },
    ])
      expect(() =>
        hostedProjectRepositories({
          version: 1,
          projects: [{ ...repo, publishToWebsite: target }],
        }),
      ).toThrow();
    expect(() =>
      hostedProjectRepositories({
        version: 1,
        projects: [
          { ...repo, saveToWebsite: undefined, publishToWebsite: production },
        ],
      }),
    ).toThrow();
    const { api } = await fixture();
    const keyFile = path.join(api.credentials, helperProject, "known_hosts");
    // The non-setup transport fixture has a synthetic host line; replace only this temporary host file for settings validation.
    await writeFile(
      keyFile,
      "fixture.invalid ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n",
      { mode: 0o600 },
    );
    const result = await api.send({
      action: "repository-settings-save",
      version: 0,
      repository: {
        repositoryUrl: "git@fixture.invalid:fixture/site.git",
        branch: "preview",
      },
    });
    expect(result.status).toBe(200);
    expect(api.folders.configuration(helperProject)).not.toHaveProperty(
      "publishToWebsite",
    );
  });
});

describe("durable publication recovery", () => {
  it("reopens a private review after replacing all helper state and checks current account and project access", async () => {
    const { api, base } = await ready();
    const reviewed = await review(api);
    const bytes = await readFile(receiptFile(api), "utf8");
    expect((await lstat(receiptFile(api))).mode & 0o777).toBe(0o600);
    expect(bytes).not.toContain(api.directory);
    expect(bytes).not.toMatch(/fixture-signature|fixture-only-key-material/);
    const previous = api.service;
    await api.restart();
    expect(api.service).not.toBe(previous);
    const push = vi.spyOn(api.folders, "pushPublication");
    expect((await status(api)).body).toEqual(reviewed.body);
    api.publishers.get(helperProject)!.add(helperEditor);
    expect(
      (await api.send({ action: "repository-publish-status" }, helperEditor))
        .body,
    ).toBeNull();
    expect(
      (
        await api.send(
          {
            action: "repository-publish-status",
            reviewId: reviewed.body.review.id,
          },
          helperEditor,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await api.send({
          action: "repository-publish-status",
          projectId: helperOtherProject,
          reviewId: reviewed.body.review.id,
        })
      ).status,
    ).toBe(409);
    api.members.get(helperProject)!.delete(helperOwner);
    expect((await status(api)).status).toBe(403);
    expect(push).not.toHaveBeenCalled();
    expect(await main(api)).toBe(base);
    expect(await readFile(receiptFile(api), "utf8")).toBe(bytes);
  });
  it("resolves a lost push acknowledgement after restart by reading the remote without repeating the push", async () => {
    const { api, deployed } = await ready();
    const reviewed = await review(api);
    const original = api.folders.pushPublication.bind(api.folders);
    const firstPush = vi
      .spyOn(api.folders, "pushPublication")
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        vi.spyOn(api.folders, "productionHead").mockRejectedValue(
          new Error("fixture Git host unavailable"),
        );
        throw new Error("private lost acknowledgement");
      });
    expect((await publish(api, reviewed.body.review.id)).body.phase).toBe(
      "uncertain",
    );
    expect(
      JSON.parse(await readFile(receiptFile(api), "utf8")).data[0].status.phase,
    ).toBe("uncertain");
    expect(firstPush).toHaveBeenCalledTimes(1);
    await api.restart();
    const nextPush = vi.spyOn(api.folders, "pushPublication");
    expect((await status(api, reviewed.body.review.id)).body.phase).toBe(
      "sent",
    );
    expect((await publish(api, reviewed.body.review.id)).status).toBe(409);
    expect(nextPush).not.toHaveBeenCalled();
    expect(await main(api)).toBe(deployed.stage);
  });
  it.each(["before", "after"])(
    "keeps a recoverable record when storage fails %s the push",
    async (when) => {
      const { api, deployed, base } = await ready();
      const reviewed = await review(api);
      const original = HostedReceiptStore.prototype.write;
      const recordWrite = vi
        .spyOn(HostedReceiptStore.prototype, "write")
        .mockImplementation(async function (id, data) {
          if (
            Array.isArray(data) &&
            data.some(
              (entry) =>
                entry.status.phase ===
                (when === "before" ? "uncertain" : "sent"),
            )
          )
            throw receiptError();
          return original.call(this, id, data);
        });
      const firstPush = vi.spyOn(api.folders, "pushPublication");
      const result = await publish(api, reviewed.body.review.id);
      expect(result).toMatchObject({
        status: 503,
        body: { error: expect.stringContaining("operator check") },
      });
      expect(firstPush).toHaveBeenCalledTimes(when === "before" ? 0 : 1);
      const durable = JSON.parse(await readFile(receiptFile(api), "utf8"));
      expect(durable.data[0].status.phase).toBe(
        when === "before" ? "reviewed" : "uncertain",
      );
      recordWrite.mockRestore();
      await api.restart();
      const nextPush = vi.spyOn(api.folders, "pushPublication");
      expect((await status(api)).body.phase).toBe(
        when === "before" ? "reviewed" : "sent",
      );
      expect(nextPush).not.toHaveBeenCalled();
      expect(await main(api)).toBe(when === "before" ? base : deployed.stage);
    },
  );
  it.each([
    "invalid-json",
    "other-project",
    "symlink",
    "hardlink",
    "public-mode",
    "oversized",
  ])(
    "refuses a %s operation record without changing the remote or exposing private data",
    async (damage) => {
      const { api, base } = await ready();
      const reviewed = await review(api);
      const file = receiptFile(api),
        original = await readFile(file, "utf8");
      const privateFile = path.join(api.directory, "private-operation-record");
      await writeFile(privateFile, "private fixture operator detail", {
        mode: 0o600,
      });
      if (damage === "invalid-json")
        await writeFile(file, "private invalid fixture json");
      if (damage === "other-project")
        await writeFile(
          file,
          original.replace(helperProject, helperOtherProject),
        );
      if (damage === "symlink" || damage === "hardlink") {
        await rm(file);
        await (damage === "symlink" ? symlink : link)(privateFile, file);
      }
      if (damage === "public-mode") await chmod(file, 0o644);
      if (damage === "oversized")
        await writeFile(file, " ".repeat(4 * 1024 * 1024 + 1));
      await api.restart();
      const push = vi.spyOn(api.folders, "pushPublication");
      for (const result of [
        await status(api),
        await publish(api, reviewed.body.review.id),
      ]) {
        expect(result).toMatchObject({
          status: 503,
          body: { error: expect.stringContaining("operator check") },
        });
        expect(JSON.stringify(result.body)).not.toMatch(
          /private|fixture|credentials|\.json/,
        );
      }
      expect(push).not.toHaveBeenCalled();
      expect(await main(api)).toBe(base);
      expect(await readFile(privateFile, "utf8")).toBe(
        "private fixture operator detail",
      );
    },
  );
  it("preserves a concurrent record edit and refuses to start the push", async () => {
    const { api, base } = await ready();
    const reviewed = await review(api);
    const file = receiptFile(api),
      changed = (await readFile(file, "utf8")) + "\n";
    const original = HostedReceiptStore.prototype.write;
    vi.spyOn(HostedReceiptStore.prototype, "write").mockImplementation(
      async function (id, data) {
        if (
          Array.isArray(data) &&
          data.some((entry) => entry.status.phase === "uncertain")
        )
          await writeFile(file, changed);
        return original.call(this, id, data);
      },
    );
    const push = vi.spyOn(api.folders, "pushPublication");
    expect((await publish(api, reviewed.body.review.id)).status).toBe(503);
    expect(push).not.toHaveBeenCalled();
    expect(await main(api)).toBe(base);
    expect(await readFile(file, "utf8")).toBe(changed);
  });
  it.each(["files", "stagingUrl", "productionUrl", "binding"])(
    "rechecks restored %s against the repository and operator configuration",
    async (field) => {
      const { api, base, requests } = await ready();
      const reviewed = await review(api);
      const file = receiptFile(api),
        record = JSON.parse(await readFile(file, "utf8"));
      if (field === "binding") record.data[0].binding = "a".repeat(64);
      else
        record.data[0].status.review[field] =
          field === "files" ? ["README.md"] : "https://outside.invalid";
      await writeFile(file, JSON.stringify(record));
      await api.restart();
      requests.length = 0;
      const push = vi.spyOn(api.folders, "pushPublication");
      expect((await publish(api, reviewed.body.review.id)).status).toBe(
        field === "files" ? 409 : 503,
      );
      expect(push).not.toHaveBeenCalled();
      expect(requests).toEqual([]);
      expect(await main(api)).toBe(base);
    },
  );
});

describe("publication delivery observations", () => {
  it("rejects missing, forged, oversized and unavailable markers and never sends credentials", async () => {
    for (const value of [
      { schemaVersion: 2, commit: "a".repeat(40), releaseId: "fixture" },
      { schemaVersion: 1, commit: "bad", releaseId: "fixture" },
      { schemaVersion: 1, commit: "a".repeat(40), releaseId: "../fixture" },
    ])
      await expect(
        hostedReleaseMarker(staging.url, async () => Response.json(value)),
      ).rejects.toThrow("deployed revision");
    await expect(
      hostedReleaseMarker(
        staging.url,
        async () => new Response("x".repeat(8193)),
      ),
    ).rejects.toThrow();
    await expect(
      hostedReleaseMarker(
        staging.url,
        async () => new Response("", { status: 503 }),
      ),
    ).rejects.toThrow();
  });
  it("does not reuse a staging workflow result when checking production for the same commit", async () => {
    const calls: URL[] = [];
    const releases = new HostedSaveReleases({
      fetch: async (url: string | URL | Request) => {
        const parsed = new URL(String(url));
        calls.push(parsed);
        return Response.json({
          workflow_runs: [
            {
              id: calls.length,
              head_sha: "a".repeat(40),
              head_branch: parsed.searchParams.get("branch"),
              event: "push",
              status: "completed",
              conclusion: "success",
            },
          ],
        });
      },
    });
    const repo = {
      projectId: helperProject,
      repositoryUrl: "git@github.com:fixture/site.git",
      branch: "stage",
      saveToWebsite: { ...staging, workflow: "deploy.yml" },
    };
    expect((await releases.status(repo, "a".repeat(40))).message).toContain(
      "staging",
    );
    expect(
      (
        await releases.status(repo, "a".repeat(40), {
          ...production,
          workflow: "deploy.yml",
        })
      ).message,
    ).toContain("production");
    expect(calls.map((url) => url.searchParams.get("branch"))).toEqual([
      "stage",
      "main",
    ]);
  });
});

it.each(["quota", "lost response"])(
  "keeps original source after a storage %s and requires a fresh explicit apply",
  async (failure) => {
    const ledger = billingFixture();
    const { api } = await fixture(ledger.billing);
    const inspected = (
      await api.send({
        action: "repository-source-inspect",
        route: "src/pages/index.astro",
      })
    ).body;
    const file = path.join(inspected.root, "src/pages/index.astro");
    const original = await readFile(file, "utf8");
    const heading = inspected.fields.find(
      (field: { value: string }) => field.value === "Hosted original",
    );
    const prepare = () =>
      api.send({
        action: "repository-source-prepare",
        edits: {
          inspection: inspected,
          values: {
            [heading.id]: "A larger heading reserved against the website plan",
          },
          orders: {},
        },
      });
    const plan = await prepare();
    expect(plan.status).toBe(200);
    if (failure === "quota") ledger.faults.sourceQuota = true;
    else ledger.faults.lostUsage = true;
    const result = await api.send({
      action: "repository-apply",
      planId: plan.body.id,
    });
    expect(result.status).toBe(failure === "quota" ? 429 : 503);
    expect(await readFile(file, "utf8")).toBe(original);
    expect(
      (await api.send({ action: "repository-apply", planId: plan.body.id }))
        .status,
    ).toBe(409);
    ledger.faults.sourceQuota = false;
    const fresh = await prepare();
    expect(
      (await api.send({ action: "repository-apply", planId: fresh.body.id }))
        .status,
    ).toBe(200);
    expect(await readFile(file, "utf8")).toContain("A larger heading reserved");
    expect(
      ledger.usageCalls.filter((call) => call.operation === "reserve"),
    ).toHaveLength(2);
  },
);

it("meters generated hosted output before making the build available and permits a smaller explicit rebuild", async () => {
  const script = (pages: number) =>
    `import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); for(let i=0;i<${pages};i++) await writeFile('dist/'+(i?'page'+i:'index')+'.html','<h1>Generated</h1>');`;
  const ledger = billingFixture(),
    { api } = await fixture(ledger.billing, script(6));
  expect((await api.send({ action: "repository-connect" })).status).toBe(200);
  async function build() {
    const plan = await api.send({ action: "repository-build-review" });
    expect(plan.status).toBe(200);
    const start = await api.send({
      action: "repository-build-start",
      planId: plan.body.id,
    });
    expect(start.status).toBe(200);
    let result: any;
    await expect
      .poll(
        async () => {
          result = await api.send({
            action: "repository-build-status",
            jobId: start.body.id,
          });
          return result.body.status;
        },
        { timeout: 15000 },
      )
      .toMatch(/failed|succeeded/);
    return result.body;
  }
  const denied = await build();
  expect(denied.status).toBe("failed");
  expect(denied.error).toContain("page plan");
  expect(ledger.usage.measurements.preview).toBeUndefined();
  await expect(
    lstat(path.join(api.folders.root(helperProject), "dist")),
  ).rejects.toThrow(/ENOENT/);
  await writeFile(
    path.join(api.folders.root(helperProject), "fixture-build.mjs"),
    script(5),
  );
  const admitted = await build();
  expect(admitted.status).toBe("succeeded");
  expect(ledger.usage.measurements.preview).toMatchObject({
    pages: 5,
    bytes: 90,
  });
  expect(
    ledger.usageCalls
      .filter((call) => call.channel === "preview")
      .map((call) => call.sample?.pages),
  ).toEqual([6, 5]);
});
