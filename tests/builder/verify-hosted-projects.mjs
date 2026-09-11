// Real hosted acceptance. Creates unique test accounts/projects and removes only those resources.
// Supply SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY privately in the process environment.
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const url = process.env.SUPABASE_URL,
  anon = process.env.SUPABASE_ANON_KEY,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !key)
  throw new Error(
    "Hosted acceptance requires SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the environment. No credentials are written to the repository.",
  );
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, key, options);
const clients = [],
  users = [],
  projects = [],
  objects = [];
function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function deniedAction(client, body, message) {
  const result = await client.functions.invoke("builder-projects", { body });
  assert.equal(
    result.error?.context?.status,
    403,
    "The API must deny access explicitly, not merely fail for another reason",
  );
  const response = await result.error.context.clone().json();
  assert.equal(response.error, message);
}
try {
  for (let index = 0; index < 2; index++) {
    const email = `kaizen-project-acceptance-${randomUUID()}@example.invalid`,
      password = randomUUID() + randomUUID();
    const created = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
      "Create isolated account",
    ).user;
    assert.equal(created.email, email);
    users.push(created.id);
    const client = createClient(url, anon, options);
    check(
      await client.auth.signInWithPassword({ email, password }),
      "Sign in isolated account",
    );
    clients.push(client);
    const id = check(
      await client.rpc("builder_create_project", {
        project_name: `Isolated acceptance ${index} ${randomUUID()}`,
      }),
      "Create isolated project",
    );
    projects.push(id);
  }
  const [owner, stranger] = clients,
    [alpha, beta] = projects;
  const invoke = async (client, body) =>
    check(
      await client.functions.invoke("builder-projects", { body }),
      "Project API",
    );
  const document = {
    schemaVersion: 1,
    title: "Hosted isolated draft",
    slug: "about",
    description: "Acceptance fixture",
    noIndex: true,
    theme: {
      accent: "#6c5dd3",
      background: "#ffffff",
      color: "#111111",
      fontFamily: "sans-serif",
      radius: 0,
    },
    data: { root: {}, content: [] },
  };
  await invoke(owner, {
    action: "save",
    projectId: alpha,
    id: randomUUID(),
    version: 0,
    document,
  });
  assert.equal(
    (await invoke(owner, { action: "load", projectId: alpha })).pages.length,
    1,
  );
  assert.equal(
    (await invoke(stranger, { action: "load", projectId: beta })).pages.length,
    0,
  );
  assert.deepEqual(
    check(
      await stranger
        .from("builder_project_workspaces")
        .select("*")
        .eq("project_id", alpha),
      "Unrelated workspace read",
    ),
    [],
  );
  assert.deepEqual(
    check(
      await stranger
        .from("builder_project_members")
        .select("*")
        .eq("project_id", alpha),
      "Unrelated members read",
    ),
    [],
  );
  for (const action of ["load", "client-release-list"])
    await deniedAction(
      stranger,
      { action, projectId: alpha },
      "Project membership required.",
    );
  const bytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="purple"/></svg>',
  );
  const asset = {
    id: randomUUID(),
    hash: createHash("sha256").update(bytes).digest("hex"),
    name: "fixture.svg",
    path: "fixture.svg",
    pack: "Isolated acceptance",
    mime: "image/svg+xml",
    kind: "icon",
    size: bytes.length,
    url: "",
    tags: [],
    favourite: false,
    createdAt: new Date().toISOString(),
  };
  const name = `${alpha}/${asset.id}`;
  check(
    await owner.storage
      .from("builder-project-files")
      .upload(name, bytes, { contentType: asset.mime, upsert: false }),
    "Private upload",
  );
  objects.push(name);
  await invoke(owner, { action: "register-asset", projectId: alpha, asset });
  assert.ok(
    (await stranger.storage.from("builder-project-files").download(name)).error,
    "Unrelated storage read must fail",
  );
  assert.ok(
    (
      await stranger.storage
        .from("builder-project-files")
        .createSignedUrl(name, 60)
    ).error,
    "Unrelated signed URL must fail",
  );
  assert.ok(
    (
      await owner.storage
        .from("builder-project-files")
        .update(name, Buffer.from("overwrite"))
    ).error,
    "Original file overwrite must fail",
  );
  check(
    await owner.rpc("builder_set_project_member", {
      target: alpha,
      member_id: users[1],
      member_role: "editor",
      publish_permission: false,
    }),
    "Grant editor",
  );
  assert.equal(
    check(
      await stranger.rpc("builder_project_access", {
        target: alpha,
        capability: "edit",
      }),
      "Editor permission",
    ),
    true,
  );
  assert.equal(
    check(
      await stranger.rpc("builder_project_access", {
        target: alpha,
        capability: "publish",
      }),
      "Publish permission",
    ),
    false,
  );
  await invoke(stranger, {
    action: "save",
    projectId: alpha,
    id: randomUUID(),
    version: 0,
    document: {
      ...document,
      title: "Editor saved this page",
      slug: "editor-check",
    },
  });
  assert.equal(
    (await invoke(owner, { action: "load", projectId: alpha })).pages.length,
    2,
  );
  check(
    await stranger.storage.from("builder-project-files").download(name),
    "Granted editor can read project media",
  );
  await deniedAction(
    stranger,
    {
      action: "client-release-review",
      projectId: alpha,
      destinationId: randomUUID(),
      releaseAction: "publish",
    },
    "You do not have permission to publish this project.",
  );
  check(
    await owner.rpc("builder_set_project_member", {
      target: alpha,
      member_id: users[1],
      member_role: "editor",
      publish_permission: true,
    }),
    "Grant separate publication permission",
  );
  assert.equal(
    check(
      await stranger.rpc("builder_project_access", {
        target: alpha,
        capability: "publish",
      }),
      "Granted publication permission",
    ),
    true,
  );
  const history = await invoke(stranger, {
    action: "client-release-list",
    projectId: alpha,
  });
  assert.deepEqual(history.jobs, []);
  assert.deepEqual(history.destinations, []);
  // Actual publication additionally needs a provisioned destination and running worker.
  // A permission grant or an empty history is not proof of served output.
  check(
    await owner.rpc("builder_set_project_member", {
      target: alpha,
      member_id: users[1],
      member_role: null,
      publish_permission: false,
    }),
    "Remove editor",
  );
  assert.equal(
    check(
      await stranger.rpc("builder_project_access", { target: alpha }),
      "Revoked membership",
    ),
    false,
  );
  await deniedAction(
    stranger,
    { action: "load", projectId: alpha },
    "Project membership required.",
  );
  assert.ok(
    (
      await stranger.storage
        .from("builder-project-files")
        .createSignedUrl(name, 60)
    ).error,
    "Revoked members cannot obtain new signed media URLs",
  );
  // Test a fresh request. Previously downloaded/cached bytes and issued signed URLs
  // cannot be recalled when membership is removed.
  const revokedDownload = await fetch(
    `${url}/storage/v1/object/authenticated/builder-project-files/${name}?acceptance=${randomUUID()}`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${(await stranger.auth.getSession()).data.session.access_token}`,
      },
    },
  );
  assert.ok(
    [400, 403, 404].includes(revokedDownload.status),
    "Fresh revoked storage read must be denied",
  );
  console.log(
    "Hosted checks passed: independent workspaces, API/database/storage isolation, immutable assets, editor/publish distinction and revocation.",
  );
} finally {
  const cleanupErrors = [];
  async function cleanup(action) {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (objects.length)
    await cleanup(async () =>
      check(
        await admin.storage.from("builder-project-files").remove(objects),
        "Remove only acceptance objects",
      ),
    );
  for (const id of projects)
    await cleanup(async () =>
      check(
        await admin.from("builder_projects").delete().eq("id", id),
        "Remove only acceptance project",
      ),
    );
  for (const id of users)
    await cleanup(async () =>
      check(
        await admin.auth.admin.deleteUser(id),
        "Remove only acceptance account",
      ),
    );
  for (const client of clients) await cleanup(() => client.auth.signOut());
  if (cleanupErrors.length) {
    console.error(
      "Acceptance cleanup incomplete. Inspect only these test resource IDs:",
      { objects, projects, users },
    );
    throw new AggregateError(
      cleanupErrors,
      "Some isolated acceptance resources need cleanup.",
    );
  }
}
