import { expect, it } from "vitest";
import { nativeAssetInventory } from "../../scripts/builder-native-asset-cleanup";

const inventory = () => ({
  version: 1,
  workerId: "native-cleanup",
  projects: ["kaizen"],
  producers: [{ workerId: "native-deploy", projectIds: ["kaizen"] }],
  roots: [
    { kind: "repository", path: "/srv/fixture/source", projectIds: ["kaizen"] },
    { kind: "tree", path: "/var/lib/fixture/releases", projectIds: ["kaizen"] },
    {
      kind: "repository-collection",
      path: "/var/lib/fixture/candidates",
      projectIds: ["kaizen"],
    },
  ],
});
it("binds immutable native configuration to every producer and root with stable ordering", () => {
  const value = inventory();
  const first = nativeAssetInventory(value);
  value.roots.reverse();
  expect(nativeAssetInventory(value).fingerprint).toBe(first.fingerprint);
  expect(Object.isFrozen(first.configuration.roots[0])).toBe(true);
  value.roots[0].path = "/var/lib/fixture/other-candidates";
  expect(nativeAssetInventory(value).fingerprint).not.toBe(first.fingerprint);
});
it("refuses incomplete, duplicated or caller-shaped native inventories", () => {
  for (const mutate of [
    (v: any) => {
      v.roots = v.roots.filter((r: any) => r.kind !== "repository");
    },
    (v: any) => {
      v.producers = [];
    },
    (v: any) => {
      v.producers[0].workerId = v.workerId;
    },
    (v: any) => {
      v.roots.push(v.roots[0]);
    },
    (v: any) => {
      v.roots[0].path = "/";
    },
    (v: any) => {
      v.roots[0].path = "/srv/fixture/../other";
    },
    (v: any) => {
      v.roots[0].projectIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"];
    },
    (v: any) => {
      v.roots[0].ignoreErrors = true;
    },
    (v: any) => {
      v.fingerprint = "a".repeat(64);
    },
  ]) {
    const value = inventory();
    mutate(value);
    expect(() => nativeAssetInventory(value)).toThrow(
      "complete native website inventory",
    );
  }
});
