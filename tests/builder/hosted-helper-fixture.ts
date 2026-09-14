import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { HostedRepositoryAccess } from "../../scripts/builder-hosted-auth";
import type { RepositorySaveTarget } from "../../shared/builderRepositorySave";
import type { RepositoryPublishTarget } from "../../shared/builderRepositoryPublish";
import type { HostedSaveReleases } from "../../scripts/builder-hosted-save-release";
import type { HostedDiskLimits } from "../../scripts/builder-hosted-disk";
import { HostedWebsiteFolders } from "../../scripts/builder-hosted-folders";
import {
  HostedHelperService,
  startHostedHelper,
} from "../../scripts/builder-hosted-helper";

export const helperOwner = "22222222-2222-4222-8222-222222222222";
export const helperEditor = "33333333-3333-4333-8333-333333333333";
export const helperProject = "11111111-1111-4111-8111-111111111111";
export const helperOtherProject = "44444444-4444-4444-8444-444444444444";
export const helperToken = (
  actor = helperOwner,
  expires = Math.floor(Date.now() / 1000) + 3600,
) =>
  `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: actor, role: "authenticated", exp: expires })).toString("base64url")}.fixture-signature`;
const exec = promisify(execFile);

/** Real Git clone/fetch/upload-pack and real HTTP service; only SSH transport and Supabase are fixtures. */
export async function hostedHelperFixture(
  projectIds = [helperProject, helperOtherProject],
  buildScript?: string,
  previewOrigin?: string,
  setupSeed?: (seed: string) => Promise<void>,
  saving?: { target: RepositorySaveTarget; releases?: HostedSaveReleases },
  setup?: "empty" | "approved",
  publishing?: { target: RepositoryPublishTarget; fetch: typeof fetch },
  diskLimits?: HostedDiskLimits,
  buildIsolation?: { manager?: string },
) {
  const directory = await mkdtemp(path.join(tmpdir(), "kaizen-hosted-helper-"));
  const seed = path.join(directory, "seed"),
    remote = path.join(directory, "remote.git"),
    bin = path.join(directory, "bin");
  const git = async (cwd: string, args: string[]) =>
    (
      await exec("git", ["-C", cwd, ...args], {
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_COUNT: undefined,
          GIT_DIR: undefined,
          GIT_WORK_TREE: undefined,
          GIT_INDEX_FILE: undefined,
        },
      })
    ).stdout.trim();
  await mkdir(path.join(seed, "src/pages"), { recursive: true });
  await mkdir(bin);
  await writeFile(
    path.join(seed, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: {
        build: buildScript
          ? "node fixture-build.mjs"
          : 'node -e "process.exit(0)"',
      },
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
    }),
  );
  if (buildScript)
    await writeFile(path.join(seed, "fixture-build.mjs"), buildScript);
  await writeFile(
    path.join(seed, "src/pages/index.astro"),
    "<main><h1>Hosted original</h1><p>Keep the original layout.</p></main>",
  );
  await writeFile(
    path.join(seed, "README.md"),
    "Unrelated repository content\n",
  );
  await writeFile(
    path.join(seed, ".gitignore"),
    ".kaizen/\n.astro/\nnode_modules\ndist/\n.env\n",
  );
  await setupSeed?.(seed);
  await git(seed, ["init", "-b", "stage"]);
  await git(seed, ["config", "user.name", "Fixture owner"]);
  await git(seed, ["config", "user.email", "fixture@example.invalid"]);
  await git(seed, ["add", "."]);
  await git(seed, ["commit", "-m", "Fixture site"]);
  await git(directory, ["clone", "--bare", seed, remote]);
  const sshLog = path.join(directory, "ssh.jsonl");
  const authorizedKey = path.join(directory, "authorized-deploy-key.pub");
  await writeFile(
    path.join(bin, "ssh"),
    `#!${process.execPath}
const {appendFileSync}=require('node:fs');const {spawn}=require('node:child_process');
const args=process.argv.slice(2);appendFileSync(${JSON.stringify(sshLog)},JSON.stringify({args,environment:Object.keys(process.env)})+'\\n');
const operation=args[args.length-1];
if(!["git-upload-pack 'fixture/site.git'","git-receive-pack 'fixture/site.git'"].includes(operation)||!args.includes('StrictHostKeyChecking=yes')||!args.includes('IdentitiesOnly=yes')||!args.includes('BatchMode=yes'))process.exit(74);
if(${Boolean(setup)}){try{const {readFileSync}=require('node:fs');const {spawnSync}=require('node:child_process');const key=args[args.indexOf('-i')+1];const publicKey=spawnSync('ssh-keygen',['-y','-f',key],{encoding:'utf8'}).stdout.trim().split(' ').slice(0,2).join(' ');if(publicKey!==readFileSync(${JSON.stringify(authorizedKey)},'utf8').trim().split(' ').slice(0,2).join(' '))process.exit(78);}catch{process.exit(78);}}
const child=spawn(operation.split(' ')[0],[${JSON.stringify(remote)}],{stdio:'inherit',env:{...process.env,GIT_CONFIG_PARAMETERS:undefined,GIT_CONFIG_COUNT:undefined}});child.on('exit',code=>process.exit(code??1));
`,
    { mode: 0o700 },
  );
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`;
  const credentials = path.join(directory, "credentials");
  const configured = projectIds.map((projectId) => ({
    projectId,
    repositoryUrl: `git@${saving?.target.workflow ? "github.com" : "fixture.invalid"}:fixture/site.git`,
    branch: "stage",
    ...(saving ? { saveToWebsite: saving.target } : {}),
    ...(publishing ? { publishToWebsite: publishing.target } : {}),
  }));
  let hostKey: string | undefined;
  if (setup) {
    const key = path.join(directory, "host-key");
    await exec("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", key]);
    hostKey = (await readFile(`${key}.pub`, "utf8")).trim();
  }
  for (const id of projectIds) {
    await mkdir(path.join(credentials, id), { recursive: true, mode: 0o700 });
    if (!setup)
      await writeFile(
        path.join(credentials, id, "deploy-key"),
        "fixture-only-key-material",
        { mode: 0o600 },
      );
    await writeFile(
      path.join(credentials, id, "known_hosts"),
      hostKey
        ? `fixture.invalid,github.com ${hostKey}\n`
        : "fixture.invalid fixture-host-key",
      { mode: 0o600 },
    );
  }
  const members = new Map(
    projectIds.map((id) => [id, new Set([helperOwner, helperEditor])]),
  );
  const owners = new Map(projectIds.map((id) => [id, new Set([helperOwner])]));
  const publishers = new Map(
    projectIds.map((id) => [id, new Set([helperOwner])]),
  );
  const archived = new Set<string>();
  const calls: { route: string; token: string; body?: any }[] = [];
  let unavailable = false;
  let beforeMembership: (() => Promise<void>) | undefined;
  const profiles = new Map(
    [helperOwner, helperEditor].map((id) => [
      id,
      {
        id,
        ...(saving
          ? {
              email:
                id === helperOwner
                  ? "owner@example.invalid"
                  : "editor@example.invalid",
              user_metadata: {
                full_name:
                  id === helperOwner ? "Fixture owner" : "Fixture editor",
              },
            }
          : {}),
      },
    ]),
  );
  const access = new HostedRepositoryAccess({
    url: "https://supabase.fixture.invalid",
    anonKey: "fixture-anon-key",
    fetch: async (url, options) => {
      const route = new URL(String(url)).pathname;
      const token =
        new Headers(options?.headers).get("authorization")?.slice(7) || "";
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ route, token, body });
      if (unavailable)
        throw new Error("private fixture outage credential must not escape");
      let claims: any;
      try {
        claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
      } catch {
        return Response.json({}, { status: 401 });
      }
      if (!token.endsWith(".fixture-signature"))
        return Response.json({}, { status: 401 });
      if (route === "/auth/v1/user")
        return Response.json(profiles.get(claims.sub) || { id: claims.sub });
      if (route === "/rest/v1/rpc/builder_project_access") {
        await beforeMembership?.();
        return Response.json(
          (body.capability === "edit" ||
            (body.capability === "publish" &&
              publishers.get(body.target)?.has(claims.sub)) ||
            (body.capability === "owner" &&
              owners.get(body.target)?.has(claims.sub))) &&
            body.actor === claims.sub &&
            !archived.has(body.target) &&
            Boolean(members.get(body.target)?.has(claims.sub)),
        );
      }
      return Response.json({}, { status: 404 });
    },
  });
  const start = async () => {
    const folders = new HostedWebsiteFolders(
      path.join(directory, "work"),
      credentials,
      setup === "empty"
        ? projectIds.map((projectId) => ({ projectId, setup: true as const }))
        : configured,
      diskLimits,
    );
    const service = new HostedHelperService(folders, access, {
      // These operator-owned scripts deliberately coordinate with the test
      // harness outside the checkout. Real untrusted builds have separate
      // namespace/cgroup tests and never receive this trust exception.
      trustedBuildProjects: buildIsolation ? [] : projectIds,
      buildManager: buildIsolation?.manager,
      ...(previewOrigin ? { editorOrigin: previewOrigin } : {}),
      ...(saving?.releases ? { saveReleases: saving.releases } : {}),
      ...(publishing ? { publicationFetch: publishing.fetch } : {}),
    });
    const helper = await startHostedHelper({
      service,
      port: 0,
      origins: [previewOrigin || "https://builder.example"],
    });
    return { folders, service, helper };
  };
  let running = await start();
  const send = async (
    input: Record<string, unknown>,
    actor = helperOwner,
    options: RequestInit = {},
  ) => {
    const response = await fetch(
      `${running.helper.origin}/editor-api/builder-repository`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${helperToken(actor)}`,
          Origin: previewOrigin || "https://builder.example",
        },
        body: JSON.stringify({ projectId: helperProject, ...input }),
        ...options,
      },
    );
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  };
  return {
    directory,
    seed,
    remote,
    credentials,
    configured,
    git,
    get folders() {
      return running.folders;
    },
    get service() {
      return running.service;
    },
    get helper() {
      return running.helper;
    },
    restart: async () => {
      await running.helper.close();
      running = await start();
    },
    send,
    members,
    owners,
    publishers,
    authorizeKey: (publicKey: string) => writeFile(authorizedKey, publicKey),
    profiles,
    archived,
    calls,
    outage: (value: boolean) => {
      unavailable = value;
    },
    beforeMembership: (fn?: () => Promise<void>) => {
      beforeMembership = fn;
    },
    sshCalls: async () =>
      (await readFile(sshLog, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    close: async () => {
      await running.helper.close();
      process.env.PATH = previousPath;
      await rm(directory, { recursive: true, force: true });
    },
  };
}
