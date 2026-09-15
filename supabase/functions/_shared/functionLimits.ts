type LimitService = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
};
export type BuilderFunction =
  | "builder-projects"
  | "builder-account"
  | "builder-invite"
  | "builder-publish"
  | "builder-content"
  | "builder-contact"
  | "builder-billing"
  | "builder-billing-webhook"
  | "builder-report";

/** Call before expensive authentication/work with no actor, then again with
 * the verified Auth user. Global limits also bound rotating invalid tokens.
 * Missing/broken limits fail closed; no raw IP, token or email is retained. */
export async function checkFunctionLimit(
  service: LimitService,
  target: BuilderFunction,
  headers: Headers,
  actor?: string,
): Promise<Response | undefined> {
  const response = (status: number, message: string, retryAfter: number) => {
    const limitedHeaders = new Headers(headers);
    limitedHeaders.set("Content-Type", "application/json");
    limitedHeaders.set("Cache-Control", "no-store");
    limitedHeaders.set("X-Content-Type-Options", "nosniff");
    limitedHeaders.set("Retry-After", String(retryAfter));
    limitedHeaders.set("Access-Control-Expose-Headers", "Retry-After");
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: limitedHeaders,
    });
  };
  try {
    const { data, error } = await service.rpc(
      "builder_consume_function_limit",
      {
        target_function: target,
        actor_id: actor ?? null,
      },
    );
    const result = data as { allowed?: unknown; retryAfter?: unknown } | null;
    if (
      error ||
      !result ||
      typeof result.allowed !== "boolean" ||
      !Number.isInteger(result.retryAfter) ||
      (result.retryAfter as number) < 0 ||
      (result.retryAfter as number) > 60 ||
      (!result.allowed && result.retryAfter === 0) ||
      (result.allowed && result.retryAfter !== 0)
    )
      throw new Error("Invalid request limit response");
    if (!result.allowed)
      return response(
        429,
        "Too many requests. Wait a moment, then try again.",
        result.retryAfter as number,
      );
  } catch {
    return response(
      503,
      "Requests are temporarily unavailable. Please try again shortly.",
      30,
    );
  }
}
