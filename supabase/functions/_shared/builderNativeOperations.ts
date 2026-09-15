import type { SupabaseClient } from "npm:@supabase/supabase-js@2.98.0";
import {
  helperSignatureHeader,
  helperSignatureKey,
  verifyHelperBilling,
} from "../../../shared/builderHelperSignature.ts";
import {
  isNativeOperationInput,
  matchesNativeOperation,
  isNativeAssetPage,
} from "../../../shared/builderNativeOperations.ts";
import { BillingError } from "./stripeBilling.ts";

/** A narrow capability on the existing helper endpoint; no browser can obtain
 * a service-role key or release a native producer using only an Auth token. */
export async function nativeOperationRequest(options: {
  service: SupabaseClient;
  request: Request;
  secret: string;
  input: unknown;
  token: string;
  actor?: string;
}) {
  const { input, token } = options;
  if (!isNativeOperationInput(input))
    throw new BillingError(400, "Invalid native website operation.");
  let key: CryptoKey;
  try {
    key = await helperSignatureKey(options.secret);
  } catch {
    throw new BillingError(
      503,
      "The native website connection is not configured.",
    );
  }
  if (
    !(await verifyHelperBilling(
      key,
      options.request.headers.get(helperSignatureHeader) || "",
      input,
      token,
    ))
  )
    throw new BillingError(
      403,
      "Only the hosted helper can report native website operations.",
    );
  if (input.action !== "native-operation-end" && !options.actor)
    throw new BillingError(401, "Sign in before starting a website operation.");
  const args = {
    request_id: input.id,
    worker: input.workerId,
    fingerprint: input.configuration,
    target: input.projectId,
    process_id: input.processId,
    host: input.host,
    instance: input.instanceId,
  };
  const { data, error } =
    input.action === "native-operation-assets"
      ? await options.service.rpc("builder_native_operation_assets", {
          request_id: input.id,
          worker: input.workerId,
          fingerprint: input.configuration,
          after_key: input.afterKey || "",
        })
      : await options.service.rpc(
          input.action === "native-operation-begin"
            ? "builder_native_operation_begin"
            : "builder_native_operation_end",
          {
            ...args,
            ...(input.action === "native-operation-begin"
              ? { actor: options.actor }
              : {}),
          },
        );
  if (error)
    throw new BillingError(
      error.code === "P0403"
        ? 403
        : error.code === "P0409"
          ? 409
          : error.code === "P0429"
            ? 429
            : 503,
      "The website operation could not be confirmed. Existing files remain protected until it is reconciled.",
    );
  if (
    input.action === "native-operation-assets"
      ? !isNativeAssetPage(data, input.id)
      : !matchesNativeOperation(data, input)
  )
    throw new BillingError(
      503,
      "The website operation response could not be confirmed.",
    );
  return data;
}
