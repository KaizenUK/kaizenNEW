import assert from "node:assert/strict";
import { copyUploadId } from "../../supabase/functions/_shared/builderCopyUploads.ts";
import { projectAssetUrl } from "../../shared/builderProjectOperations.ts";

Deno.test(
  "website copies use the actual authenticated Edge handler and resumable quota service",
  async (test) => {
    const actor = "11111111-1111-4111-8111-111111111111",
      sourceId = "22222222-2222-4222-8222-222222222222";
    const api = "https://copy-fixture.supabase.test",
      origin = "https://builder.example.test";
    const environment = {
      SUPABASE_URL: api,
      SUPABASE_ANON_KEY: "fixture-public",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      ALLOWED_STUDIO_ORIGINS: origin,
      BUILDER_UPLOAD_ORIGIN: origin,
    };
    const prior = new Map(
      Object.keys(environment).map((key) => [key, Deno.env.get(key)]),
    );
    const originalFetch = globalThis.fetch,
      descriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    let handler!: (request: Request) => Promise<Response>;
    let membership = true,
      quotaDenied = false,
      failPatch = false,
      copy: any = null;
    let beginCalls = 0,
      transferCalls = 0,
      finishes = 0;
    let cancellationCalls = 0,
      purged = false;
    const bytes = new TextEncoder().encode("copy bytes"),
      hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
    const assets = Array.from({ length: 4 }, (_, index) => {
      const id = crypto.randomUUID();
      return {
        id,
        name: `Image ${index}`,
        size: bytes.length,
        hash,
        mime: "image/png",
        kind: "image",
        url: projectAssetUrl(sourceId, id),
      };
    });
    let source: any = {
      pages: [],
      assets,
      saved: [],
      note: "Original snapshot",
    };
    const sourceProject = {
      id: sourceId,
      name: "Source",
      version: 1,
      archived: false,
      capabilities: {
        legacyWorkspace: false,
        hasInventory: false,
        publishPath: "worker",
      },
      destination: { kind: "unconfigured", label: "Not configured" },
    };
    const transfers = new Map<string, { file: any; offset: number }>();
    const copied = new Set<string>();
    const project = () => ({
      ...sourceProject,
      id: copy.project_id,
      name: copy.requested_name,
    });
    const state = () => ({ ...copy, storedAssets: [...copied] });
    try {
      for (const [key, value] of Object.entries(environment))
        Deno.env.set(key, value);
      Object.defineProperty(Deno, "serve", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        writable: true,
        value: (next: typeof handler) => {
          handler = next;
        },
      });
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url);
        if (url.origin === origin) {
          transferCalls++;
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-session",
          );
          assert.equal(request.redirect, "error");
          assert.ok(url.pathname.startsWith("/editor-uploads"));
          if (request.method === "POST" && url.pathname === "/editor-uploads") {
            const encoded = request.headers.get("upload-metadata")!.slice(5);
            const file = JSON.parse(atob(encoded));
            assert.equal(file.projectId, copy.project_id);
            const id = await copyUploadId(file.projectId, file.assetId);
            if (!transfers.has(id)) transfers.set(id, { file, offset: 0 });
            return new Response(null, {
              status: 201,
              headers: { Location: `/editor-uploads/${id}` },
            });
          }
          const id = url.pathname.split("/")[2],
            transfer = transfers.get(id)!;
          assert.ok(transfer);
          if (request.method === "HEAD")
            return new Response(null, {
              status: 200,
              headers: {
                "Upload-Length": String(transfer.file.bytes),
                "Upload-Offset": String(transfer.offset),
              },
            });
          if (request.method === "PATCH") {
            if (failPatch)
              return Response.json(
                { error: "Private fixture failure" },
                { status: 503 },
              );
            assert.equal(
              Number(request.headers.get("upload-offset")),
              transfer.offset,
            );
            transfer.offset += (await request.arrayBuffer()).byteLength;
            return new Response(null, {
              status: 204,
              headers: { "Upload-Offset": String(transfer.offset) },
            });
          }
          assert.equal(url.pathname, `/editor-uploads/${id}/finish`);
          assert.equal(transfer.offset, transfer.file.bytes);
          copied.add(transfer.file.assetId);
          return Response.json({
            id,
            projectId: copy.project_id,
            assetId: transfer.file.assetId,
            bytes: transfer.file.bytes,
            sha256: transfer.file.sha256,
            status: "stored",
          });
        }
        assert.equal(
          url.origin,
          api,
          "No user-supplied origin may receive credentials",
        );
        if (url.pathname === "/auth/v1/user")
          return Response.json({
            id: actor,
            aud: "authenticated",
            email: "fixture@example.test",
          });
        if (url.pathname.startsWith("/storage/v1/object/")) {
          assert.equal(
            request.method,
            "GET",
            "Source storage must never be written directly",
          );
          assert.equal(
            request.headers.get("authorization"),
            "Bearer fixture-session",
          );
          assert.ok(url.pathname.includes(`/${sourceId}/`));
          return new Response(bytes, {
            headers: { "Content-Type": "image/png" },
          });
        }
        if (url.pathname === "/rest/v1/builder_project_members")
          return Response.json(
            url.searchParams.get("select") === "role,can_publish"
              ? membership
                ? { role: "owner", can_publish: true }
                : null
              : [sourceId, ...(copy ? [copy.project_id] : [])].map((id) => ({
                  project_id: id,
                  user_id: actor,
                  role: "owner",
                  can_publish: true,
                })),
          );
        if (url.pathname === "/rest/v1/builder_projects")
          return Response.json(
            url.searchParams.has("id")
              ? url.searchParams.get("id") === `eq.${sourceId}`
                ? sourceProject
                : project()
              : [sourceProject, ...(copy ? [project()] : [])],
          );
        if (url.pathname === "/rest/v1/builder_project_workspaces")
          return Response.json({ payload: source });
        if (url.pathname === "/rest/v1/builder_client_destinations")
          return Response.json([]);
        const name = url.pathname.split("/").at(-1),
          body = await request.json();
        if (name === "builder_consume_function_limit")
          return Response.json({ allowed: true, retryAfter: 0 });
        assert.equal(
          request.headers.get("authorization"),
          "Bearer fixture-service",
        );
        assert.equal(body.actor, actor);
        if (name === "builder_project_copy_cancel") {
          cancellationCalls++;
          assert.equal(body.target, copy.project_id);
          assert.equal(body.expected_version, 1);
          if (!membership && !purged)
            return Response.json(
              {
                code: "P0403",
                message: "Only a website owner can cancel this copy",
              },
              { status: 400 },
            );
          copy.status = "cancelling";
          return Response.json({
            projectId: copy.project_id,
            cancelled: true,
            cleanupPending: !purged,
          });
        }
        if (name === "builder_project_copy_begin") {
          beginCalls++;
          if (quotaDenied)
            return Response.json(
              {
                code: "P0429",
                message: "The billing account has reached its storage limit",
              },
              { status: 400 },
            );
          assert.equal(body.source, sourceId);
          if (!copy)
            copy = {
              project_id: body.request_id,
              actor_id: actor,
              source_project_id: sourceId,
              source_legacy: false,
              requested_name: body.project_name,
              workspace: body.workspace,
              status: "pending",
            };
          assert.equal(body.request_id, copy.project_id);
          return Response.json(state());
        }
        if (name === "builder_project_copy_resume") {
          assert.equal(body.target, copy.project_id);
          return Response.json(state());
        }
        if (name === "builder_project_copy_summaries")
          return Response.json(
            copy?.status === "pending"
              ? [
                  {
                    projectId: copy.project_id,
                    pending: true,
                    canResume: true,
                    files: copy.workspace.assets.length,
                    copied: copied.size,
                  },
                ]
              : [],
          );
        if (name === "builder_project_copy_finish") {
          assert.equal(body.target, copy.project_id);
          assert.equal(copied.size, copy.workspace.assets.length);
          finishes++;
          copy.status = "complete";
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fixture request ${url.pathname}`);
      };
      await import("../../supabase/functions/builder-projects/index.ts");
      const send = (input: any) =>
        handler(
          new Request(api + "/functions/v1/builder-projects", {
            method: "POST",
            headers: {
              origin,
              authorization: "Bearer fixture-session",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              actor: "forged",
              uploadOrigin: "https://untrusted.example.test",
              ...input,
            }),
          }),
        );
      const requestId = crypto.randomUUID(),
        duplicate = {
          action: "duplicate",
          id: sourceId,
          requestId,
          name: "Copied website",
        };
      await test.step("membership and quota denial prevent any transfer", async () => {
        membership = false;
        assert.equal((await send(duplicate)).status, 403);
        assert.equal(beginCalls, 0);
        membership = true;
        quotaDenied = true;
        assert.match(
          (await (await send(duplicate)).json()).error,
          /storage limit/,
        );
        assert.equal(transferCalls, 0);
        assert.equal(copy, null);
        quotaDenied = false;
      });
      await test.step("a failed transfer keeps the durable copy and safe recovery wording", async () => {
        failPatch = true;
        const response = await send(duplicate);
        assert.equal(response.status, 409);
        assert.match((await response.json()).error, /Resume this copy/);
        assert.equal(copy.project_id, requestId);
        assert.equal(copy.status, "pending");
        assert.equal(finishes, 0);
        failPatch = false;
      });
      await test.step("retry reuses the same snapshot and copies a bounded batch through TUS", async () => {
        source = {
          ...source,
          note: "Later source changes",
          assets: source.assets.slice(0, 1),
        };
        const response = await send(duplicate);
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).copy, {
          projectId: requestId,
          pending: true,
          canResume: true,
          files: 4,
          copied: 3,
        });
        assert.equal(copy.workspace.note, "Original snapshot");
        assert.equal(finishes, 0);
        assert.equal(
          copy.workspace.assets[0].url,
          projectAssetUrl(requestId, assets[0].id),
        );
      });
      await test.step("resume completes the remaining file without another project or overwrite", async () => {
        const before = beginCalls;
        const response = await send({
          action: "duplicate-resume",
          id: requestId,
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.id, requestId);
        assert.equal(result.copy, undefined);
        assert.equal(finishes, 1);
        assert.equal(beginCalls, before);
        assert.equal(copied.size, 4);
        assert.equal(source.note, "Later source changes");
        await send({ action: "duplicate-resume", id: requestId });
        assert.equal(finishes, 1);
      });
      await test.step("missing trusted upload configuration fails before allocating another copy", async () => {
        Deno.env.delete("BUILDER_UPLOAD_ORIGIN");
        const before = beginCalls;
        assert.match(
          (
            await (
              await send({ ...duplicate, requestId: crypto.randomUUID() })
            ).json()
          ).error,
          /not configured/,
        );
        assert.equal(beginCalls, before);
      });
      await test.step("cancellation requires confirmation and uses verified actor and owner checks", async () => {
        Deno.env.set("BUILDER_UPLOAD_ORIGIN", origin);
        copy = null;
        copied.clear();
        transfers.clear();
        source = { ...source, assets };
        const id = crypto.randomUUID();
        assert.equal((await send({ ...duplicate, requestId: id })).status, 200);
        const cancel = {
          action: "duplicate-cancel",
          id,
          version: 1,
          confirm: true,
        };
        assert.equal((await send({ ...cancel, confirm: false })).status, 400);
        assert.equal(cancellationCalls, 0);
        membership = false;
        assert.match((await (await send(cancel)).json()).error, /owner/);
        assert.equal(copy.status, "pending");
        membership = true;
        const before = transferCalls;
        assert.deepEqual(await (await send(cancel)).json(), {
          projectId: id,
          cancelled: true,
          cleanupPending: true,
        });
        assert.equal(transferCalls, before);
        purged = true;
        membership = false;
        assert.deepEqual(await (await send(cancel)).json(), {
          projectId: id,
          cancelled: true,
          cleanupPending: false,
        });
        assert.equal(transferCalls, before);
      });
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(Deno, "serve", descriptor);
      for (const [key, value] of prior)
        value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  },
);
