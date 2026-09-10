import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { getCorsHeaders, isOriginAllowed } from "../_shared/editorAuth.ts";
import { validateDocument } from "../../../shared/visualBuilder.ts";

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);
  headers.set("Content-Type", "application/json");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!isOriginAllowed(request))
    return json(403, { error: "Forbidden origin" });
  if (request.method !== "POST")
    return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Please sign in" });
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: auth, error: authError } = await service.auth.getUser(token);
  if (authError || !auth.user)
    return json(401, { error: "Your session expired. Please sign in again." });
  const { data: membership, error: membershipError } = await service
    .from("builder_editors")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (membershipError || !membership)
    return json(403, { error: "Builder editor access required" });
  const githubToken = Deno.env.get("GITHUB_DEPLOY_TOKEN");
  const repo = Deno.env.get("GITHUB_DEPLOY_REPO");
  if (!githubToken || !/^[\w.-]+\/[\w.-]+$/.test(repo || ""))
    return json(503, {
      error:
        "Publishing is not configured. Add the GitHub deployment credentials to this function.",
    });
  try {
    const { id, version } = await request.json();
    const { data: row, error } = await service
      .from("builder_pages")
      .select("payload")
      .eq("id", id)
      .single();
    if (error || !row) return json(404, { error: "Page not found" });
    validateDocument(row.payload.draft);
    const { data: page, error: publishError } = await service.rpc(
      "builder_publish_page",
      { page_id: id, expected_version: version },
    );
    if (publishError) return json(409, { error: publishError.message });
    const response = await fetch(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "kaizen-builder",
        },
        body: JSON.stringify({
          event_type:
            Deno.env.get("GITHUB_DEPLOY_EVENT_TYPE") || "sanity-update",
          client_payload: {
            source: "builder",
            documentId: id,
            target: Deno.env.get("GITHUB_DEPLOY_TARGET") || "main",
          },
        }),
      },
    ).catch(() => null);
    // Return the committed version even if dispatch fails, so retry never overwrites another draft.
    return json(200, {
      page,
      message: response?.ok
        ? "Published snapshot saved. Deployment queued; your page goes live when the site build succeeds."
        : "Published snapshot saved, but deployment could not be queued. The live site is unchanged. Retry Publish or run the site deployment.",
    });
  } catch (error) {
    return json(400, {
      error: error instanceof Error ? error.message : "Publishing failed",
    });
  }
});
