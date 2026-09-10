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
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Please sign in" });
  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: auth, error } = await service.auth.getUser(token);
    if (error || !auth.user)
      return json(401, {
        error: "Your session expired. Please sign in again.",
      });
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
