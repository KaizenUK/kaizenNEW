/** Service-owned producers use the existing private RPCs. Hosted editor
 * requests continue to use the separate signed helper/Auth connection. */
import {
  isNativeOperationInput,
  isNativeAssetPage,
  matchesNativeOperation,
} from "../shared/builderNativeOperations";
import type { NativeOperationConnection } from "./builder-native-operations";

export function nativeWorkerConnection(client: {
  rpc: (name: string, body: Record<string, unknown>) => Promise<unknown>;
}): NativeOperationConnection {
  return {
    async nativeOperation(_token, input) {
      if (!isNativeOperationInput(input))
        throw new Error("Invalid native worker operation.");
      const args = {
        request_id: input.id,
        worker: input.workerId,
        fingerprint: input.configuration,
        target: input.projectId,
        process_id: input.processId,
        host: input.host,
        instance: input.instanceId,
      };
      const result =
        input.action === "native-operation-assets"
          ? await client.rpc("builder_native_operation_assets", {
              request_id: input.id,
              worker: input.workerId,
              fingerprint: input.configuration,
              after_key: input.afterKey || "",
            })
          : await client.rpc(
              input.action === "native-operation-begin"
                ? "builder_native_operation_begin"
                : "builder_native_operation_end",
              {
                ...args,
                ...(input.action === "native-operation-begin"
                  ? { actor: null }
                  : {}),
              },
            );
      if (
        input.action === "native-operation-assets"
          ? !isNativeAssetPage(result, input.id)
          : !matchesNativeOperation(result, input)
      )
        throw new Error(
          "The native worker response could not be confirmed. Existing files remain protected.",
        );
      return result;
    },
  };
}
