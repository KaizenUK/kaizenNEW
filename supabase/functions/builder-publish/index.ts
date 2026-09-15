import { checkFunctionLimit } from "../_shared/functionLimits.ts";
import { readJsonObject, RequestBodyError } from "../_shared/requestBody.ts";
import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { getCorsHeaders, isOriginAllowed } from "../_shared/editorAuth.ts";
import type { Workspace } from "../../../shared/visualBuilder.ts";
import { prepareReleaseRequest } from "../../../shared/builderReleases.ts";
import {
  requireGithubPublication,
  PublicationAccessError,
} from "../_shared/githubPublication.ts";

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
  const token = /^Bearer ([^\s]{1,8192})$/i.exec(
    request.headers.get("Authorization") || "",
  )?.[1];
  if (!token) return json(401, { error: "Please sign in" });
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const globalLimit = await checkFunctionLimit(
    service,
    "builder-publish",
    headers,
  );
  if (globalLimit) return globalLimit;
  const { data: auth, error: authError } = await service.auth.getUser(token);
  if (authError || !auth.user)
    return json(401, { error: "Your session expired. Please sign in again." });
  const userLimit = await checkFunctionLimit(
    service,
    "builder-publish",
    headers,
    auth.user.id,
  );
  if (userLimit) return userLimit;
  let body;
  try {
    body = await readJsonObject(request, 64 * 1024);
    await requireGithubPublication(service, body?.projectId, auth.user.id);
  } catch (error) {
    return json(
      error instanceof PublicationAccessError ||
        error instanceof RequestBodyError
        ? error.status
        : 400,
      {
        error:
          error instanceof PublicationAccessError ||
          error instanceof RequestBodyError
            ? error.message
            : "Invalid publication request.",
      },
    );
  }
  const githubToken = Deno.env.get("GITHUB_DEPLOY_TOKEN");
  const repo = Deno.env.get("GITHUB_DEPLOY_REPO");
  if (!githubToken || !/^[\w.-]+\/[\w.-]+$/.test(repo || ""))
    return json(503, {
      error:
        "Publishing is not configured. Add the GitHub deployment credentials to this function.",
    });
  async function readAll(table: string) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await service
        .from(table)
        .select("payload")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data.map((row) => row.payload));
      if (data.length < 500) return rows;
    }
  }
  if (Deno.env.get("BUILDER_RELEASE_COORDINATOR") !== "1")
    return json(503, {
      error:
        "Set up the verified release worker before publishing. Follow docs/website-releases.md; no published data was changed.",
    });
  try {
    const uuid = (value: unknown): value is string =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      );
    const requestId = body.requestId || crypto.randomUUID();
    if (!uuid(requestId))
      return json(400, { error: "Invalid release request ID" });
    const action = body.action || "page";
    if (
      action !== "page" &&
      action !== "site" &&
      action !== "unpublish" &&
      action !== "rollback" &&
      action !== "retry" &&
      action !== "redirects"
    )
      return json(400, { error: "Unsupported publication action" });
    let release;
    let workspace: Workspace | undefined;
    if (action === "retry") {
      const { data, error } = await service
        .from("builder_releases")
        .select("id,status,request")
        .eq("id", requestId)
        .single();
      if (error || !data || data.status !== "queued")
        return json(409, {
          error:
            "Only an unclaimed queued release can be dispatched again. Refresh release status.",
        });
      release = {
        id: data.id,
        status: data.status,
        action: data.request.action,
      };
    } else if (action === "redirects") {
      if (
        typeof body.version !== "number" ||
        !Number.isSafeInteger(body.version) ||
        body.version < 0
      )
        return json(400, { error: "Invalid redirect version" });
      const { data, error } = await service.rpc(
        "builder_queue_routes_release",
        {
          request_id: requestId,
          editor_id: auth.user.id,
          expected_version: body.version,
        },
      );
      if (error) return json(409, { error: error.message });
      release = data;
    } else if (action === "rollback") {
      if (!uuid(body.targetId))
        return json(400, { error: "Choose an earlier verified release" });
      const { data, error } = await service.rpc("builder_queue_rollback", {
        request_id: requestId,
        editor_id: auth.user.id,
        target_id: body.targetId,
      });
      if (error) return json(409, { error: error.message });
      release = data;
    } else {
      const [pages, assets, saved, siteResult, routesResult] =
        await Promise.all([
          readAll("builder_pages"),
          readAll("builder_assets"),
          readAll("builder_saved"),
          service
            .from("builder_site")
            .select("payload")
            .eq("id", "site")
            .maybeSingle(),
          service
            .from("builder_routes")
            .select("payload")
            .eq("id", "site")
            .single(),
        ]);
      if (siteResult.error)
        throw new Error(
          "Builder site migrations are missing or could not be read.",
        );
      if (routesResult.error)
        throw new Error(
          "Builder redirect migration is missing or could not be read.",
        );
      workspace = {
        pages,
        assets,
        saved,
        site: siteResult.data?.payload,
        routes: routesResult.data?.payload,
      };
      if (
        typeof body.version !== "number" ||
        !Number.isSafeInteger(body.version) ||
        body.version < 0
      )
        return json(400, { error: "Invalid publication version" });
      if (action === "site") {
        const pageVersions = body.pageVersions;
        if (
          workspace.site?.version !== body.version ||
          !pageVersions ||
          typeof pageVersions !== "object" ||
          Array.isArray(pageVersions) ||
          Object.keys(pageVersions).length !== pages.length ||
          pages.some(
            (page) =>
              (pageVersions as Record<string, unknown>)[page.id] !==
              page.version,
          )
        )
          return json(409, {
            error:
              "The site or affected pages changed. Review publication again.",
          });
      } else {
        if (!uuid(body.id)) return json(400, { error: "Invalid page ID" });
        if (pages.find((page) => page.id === body.id)?.version !== body.version)
          return json(409, {
            error: "Save the latest draft before publishing.",
          });
      }
      const input = prepareReleaseRequest(
        workspace,
        action,
        action === "site" ? undefined : (body.id as string),
      );
      const { data, error } = await service.rpc("builder_queue_release", {
        request_id: requestId,
        editor_id: auth.user.id,
        input,
      });
      if (error) return json(409, { error: error.message });
      release = data;
    }
    // Dispatch acceptance is not live publication. All public database records remain unchanged here.
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
            projectId: body.projectId,
            releaseId: requestId,
            action: release.action || action,
            target: Deno.env.get("GITHUB_DEPLOY_TARGET") || "main",
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    ).catch(() => null);
    let message =
      "Release saved and deployment queued. Drafts remain editable. Open Releases from the page list to follow progress through live verification.";
    if (!response?.ok) {
      if (response && response.status >= 400 && response.status < 500) {
        const { data, error } = await service.rpc(
          "builder_fail_queued_release",
          {
            request_id: requestId,
            detail:
              "GitHub declined the deployment request. Check the deployment token and repository configuration, then publish again.",
          },
        );
        if (!error) release = data;
        message = error
          ? "Dispatch failed, but release ownership changed. Inspect release status before retrying."
          : "Deployment could not be queued. The previous live site is unchanged. Check the deployment configuration and publish again.";
      } else
        message =
          "The release is saved, but dispatch could not be confirmed. Inspect release status; retry dispatch only while it remains queued.";
    }
    return json(200, {
      release,
      workspace,
      page: workspace?.pages.find((page) => page.id === body.id),
      message,
    });
  } catch (error) {
    return json(400, {
      error: error instanceof Error ? error.message : "Publishing failed",
    });
  }
});
