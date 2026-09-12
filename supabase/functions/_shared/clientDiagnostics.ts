import { storedDiagnostic } from "../../../shared/builderDiagnostics.ts";

/** actor comes only from getUser(token), never from the request body. The RPC rechecks access. */
export async function recordClientDiagnostic(
  service: {
    rpc: (
      name: string,
      input: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: any }>;
  },
  projectId: string,
  actor: string,
  report: unknown,
): Promise<{ status: number; body: { recorded?: boolean; error?: string } }> {
  let diagnostic;
  try {
    diagnostic = storedDiagnostic(report);
  } catch {
    return {
      status: 400,
      body: { error: "A valid error report is required." },
    };
  }
  try {
    const { data, error } = await service.rpc("builder_record_client_error", {
      target: projectId,
      actor,
      diagnostic,
    });
    if (error)
      return {
        status: error.code === "42501" ? 403 : 503,
        body: {
          error:
            error.code === "42501"
              ? "Project membership required."
              : "Error reporting is unavailable.",
        },
      };
    return { status: 200, body: { recorded: data === true } };
  } catch {
    return { status: 503, body: { error: "Error reporting is unavailable." } };
  }
}
