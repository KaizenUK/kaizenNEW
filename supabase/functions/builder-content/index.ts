import { checkFunctionLimit } from "../_shared/functionLimits.ts";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { getCorsHeaders, isOriginAllowed } from "../_shared/editorAuth.ts";
import { fetchContentCatalogue } from "../../../shared/builderContent.ts";

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  const json = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), { status, headers });
  if (!isOriginAllowed(request))
    return json(403, { error: "Forbidden origin" });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!["GET", "POST"].includes(request.method))
    return json(405, { error: "Method not allowed" });
  const token = /^Bearer ([^\s]{1,8192})$/i.exec(
    request.headers.get("Authorization") || "",
  )?.[1];
  if (!token) return json(401, { error: "Please sign in" });
  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const globalLimit = await checkFunctionLimit(
      service,
      "builder-content",
      headers,
    );
    if (globalLimit) return globalLimit;
    const { data: auth, error } = await service.auth.getUser(token);
    if (error || !auth.user)
      return json(401, {
        error: "Your session expired. Please sign in again.",
      });
    const userLimit = await checkFunctionLimit(
      service,
      "builder-content",
      headers,
      auth.user.id,
    );
    if (userLimit) return userLimit;
    const { data: member, error: membershipError } = await service
      .from("builder_editors")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membershipError || !member)
      return json(403, { error: "Builder editor access required" });
    const catalogue = await fetchContentCatalogue({
      projectId:
        Deno.env.get("SANITY_PROJECT_ID") ||
        Deno.env.get("PUBLIC_SANITY_PROJECT_ID"),
      dataset:
        Deno.env.get("SANITY_DATASET") ||
        Deno.env.get("PUBLIC_SANITY_DATASET") ||
        "production",
      token: Deno.env.get("SANITY_API_TOKEN"),
    });
    return json(200, catalogue);
  } catch (error) {
    return json(503, {
      error:
        error instanceof Error
          ? error.message
          : "Sanity content could not be loaded.",
    });
  }
});
