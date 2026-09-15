import { validProjectId } from "./builderProjects.ts";

export type NativeOperationIdentity = {
  id: string;
  workerId: string;
  configuration: string;
  projectId: string;
  processId: number;
  host: string;
  instanceId: string;
};
export type NativeOperationInput = NativeOperationIdentity & {
  action:
    | "native-operation-begin"
    | "native-operation-end"
    | "native-operation-assets";
  afterKey?: string;
};
export type NativeOperationReceipt = NativeOperationIdentity & {
  phase: "active" | "complete";
};
export type NativeRetiredAsset = {
  projectId: string;
  assetId: string;
  url: string | null;
};
export type NativeAssetPage = {
  id: string;
  assets: NativeRetiredAsset[];
  cursor: string | null;
};
const identityKeys: (keyof NativeOperationIdentity)[] = [
  "id",
  "workerId",
  "configuration",
  "projectId",
  "processId",
  "host",
  "instanceId",
];
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function isNativeOperationIdentity(
  value: unknown,
): value is NativeOperationIdentity {
  return (
    record(value) &&
    uuid(value.id) &&
    uuid(value.instanceId) &&
    typeof value.workerId === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.workerId) &&
    typeof value.configuration === "string" &&
    /^[a-f0-9]{64}$/.test(value.configuration) &&
    typeof value.projectId === "string" &&
    validProjectId(value.projectId) &&
    Number.isSafeInteger(value.processId) &&
    value.processId > 0 &&
    value.processId <= 2147483647 &&
    typeof value.host === "string" &&
    /^[a-zA-Z0-9_.-]{1,253}$/.test(value.host)
  );
}
export function isNativeOperationInput(
  value: unknown,
): value is NativeOperationInput {
  if (!isNativeOperationIdentity(value)) return false;
  const input = value as NativeOperationInput;
  return (
    [
      "native-operation-begin",
      "native-operation-end",
      "native-operation-assets",
    ].includes(input.action) &&
    Object.keys(input).every((key) =>
      [
        ...identityKeys,
        "action",
        ...(input.action === "native-operation-assets" ? ["afterKey"] : []),
      ].includes(key),
    ) &&
    (input.afterKey === undefined ||
      (typeof input.afterKey === "string" && input.afterKey.length <= 100))
  );
}
export function matchesNativeOperation(
  value: unknown,
  identity: NativeOperationIdentity,
): value is NativeOperationReceipt {
  return (
    isNativeOperationIdentity(value) &&
    ["active", "complete"].includes((value as NativeOperationReceipt).phase) &&
    Object.keys(value).every((key) =>
      [...identityKeys, "phase"].includes(key),
    ) &&
    identityKeys.every((key) => value[key] === identity[key])
  );
}
export function isNativeAssetPage(
  value: unknown,
  id: string,
): value is NativeAssetPage {
  return (
    record(value) &&
    value.id === id &&
    Object.keys(value).every((key) =>
      ["id", "assets", "cursor"].includes(key),
    ) &&
    (value.cursor === null ||
      (typeof value.cursor === "string" &&
        value.cursor.length > 0 &&
        value.cursor.length <= 100)) &&
    Array.isArray(value.assets) &&
    value.assets.length <= 100 &&
    value.assets.every(
      (asset) =>
        record(asset) &&
        uuid(asset.assetId) &&
        typeof asset.projectId === "string" &&
        validProjectId(asset.projectId) &&
        Object.keys(asset).every((key) =>
          ["assetId", "projectId", "url"].includes(key),
        ) &&
        (asset.url === null ||
          (typeof asset.url === "string" &&
            asset.url.length > 0 &&
            new TextEncoder().encode(asset.url).byteLength <= 8192 &&
            !/[\x00-\x1f\x7f]/.test(asset.url))),
    )
  );
}
