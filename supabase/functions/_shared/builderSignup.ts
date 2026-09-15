import { isBuilderAccountStart } from "../../../shared/builderSignup.ts";

export async function bootstrapAccount(
  service: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<any>;
  },
  actor: string,
) {
  let result;
  try {
    result = await service.rpc("builder_bootstrap_account", { actor });
  } catch {
    return {
      status: 503,
      body: {
        error:
          "Your first project could not be confirmed. Retry to check its status.",
      },
    };
  }
  if (result.error) {
    const messages: Record<string, string> = {
      P0401:
        "Confirm your email before opening the Builder. Use the link in your confirmation email, then sign in again.",
      P0403:
        "The documents need your acceptance. Reload the Builder to review the current version.",
    };
    return {
      status: messages[result.error.code] ? 403 : 503,
      body: {
        error:
          messages[result.error.code] ||
          "Your first project could not be confirmed. Retry to check; the same request will not create a second project.",
      },
    };
  }
  if (!isBuilderAccountStart(result.data))
    return {
      status: 503,
      body: {
        error:
          "Your first project could not be confirmed. Retry to check its status.",
      },
    };
  return { status: 200, body: result.data };
}
