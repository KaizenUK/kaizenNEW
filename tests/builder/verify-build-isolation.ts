/** Run under a temporary systemd service with delegated cpu/memory/pids and
 * DelegateSubgroup=supervisor. Uses only its own temporary files and accounts. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readlink,
  lstat,
  readdir,
  rm,
  cp,
  symlink,
  unlink,
  rmdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  isolatedBuildCommand,
  runIsolatedBuild,
} from "../../scripts/builder-build-sandbox";
import { RepositoryRunner } from "../../scripts/builder-runner";

/** Include existing caches, file bytes, links and metadata; ignore read atimes. */
async function dependencyFingerprint(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function visit(relative: string) {
    const file = path.join(root, relative);
    const info = await lstat(file);
    hash.update(
      JSON.stringify([relative, info.mode, info.uid, info.gid, info.mtimeMs]),
    );
    if (info.isSymbolicLink()) {
      hash.update(JSON.stringify(["link", await readlink(file)]));
    } else if (info.isDirectory()) {
      hash.update("directory");
      for (const name of (await readdir(file)).sort())
        await visit(path.join(relative, name));
    } else {
      assert.ok(
        info.isFile(),
        "Fixture dependencies must contain only files, directories and links",
      );
      hash.update(
        JSON.stringify([
          "file",
          info.size,
          createHash("sha256")
            .update(await readFile(file))
            .digest("hex"),
        ]),
      );
    }
  }
  await visit("");
  return hash.digest("hex");
}

const directory = await mkdtemp(path.join(tmpdir(), "kaizen-build-isolation-"));
const root = path.join(directory, "checkout");
const privateFile = path.join(directory, "another-project-private-canary.txt");
const oldSentinel = process.env.KAIZEN_FIXTURE_PRIVATE;
let checks = 0;
let server: ReturnType<typeof createServer> | undefined;
try {
  const command = await isolatedBuildCommand(
    process.env.KAIZEN_SANDBOX_MANAGER || "",
  );
  await mkdir(root);
  await writeFile(privateFile, "private fixture bytes");
  await writeFile(
    path.join(root, ".env"),
    "FIXTURE_TOKEN=private fixture bytes\n",
  );
  await writeFile(
    path.join(root, ".npmrc"),
    "//fixture.test/:_authToken=private-fixture-value\n",
  );
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, ".git", "fixture"), "git metadata canary");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ type: "module", scripts: { build: "node build.mjs" } }),
  );
  process.env.KAIZEN_FIXTURE_PRIVATE = "must-not-enter-the-build";
  server = createServer((_request, response) => {
    response.end("Host listener canary");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const hostUrl = `http://127.0.0.1:${address.port}`;
  assert.equal(await (await fetch(hostUrl)).text(), "Host listener canary");
  const membership = (await readFile("/proc/self/cgroup", "utf8"))
    .trim()
    .split("::")[1];
  const groups = path.dirname(`/sys/fs/cgroup${membership}`);
  const baseline = (await readdir(groups)).filter((name) =>
    name.startsWith("build-"),
  );
  const dist = `fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','<h1>Isolated fixture</h1>');`;
  async function build(
    script: string,
    options: {
      memoryBytes?: number;
      processes?: number;
      cancelOn?: string;
    } = {},
  ) {
    await writeFile(
      path.join(root, "build.mjs"),
      `import fs from 'node:fs';\n${script}`,
    );
    const controller = new AbortController();
    const id = randomUUID();
    let log = "";
    const timer = setTimeout(
      () => controller.abort(new Error("Fixture safety deadline")),
      20000,
    );
    try {
      const result = await runIsolatedBuild(
        {
          id,
          root,
          command,
          signal: controller.signal,
          log(chunk) {
            log = (log + chunk.toString()).slice(-20000);
            if (options.cancelOn && log.includes(options.cancelOn))
              controller.abort(new Error("Fixture cancellation"));
          },
        },
        {
          memoryBytes: options.memoryBytes ?? 512 * 1024 ** 2,
          processes: options.processes ?? 128,
          cpuPercent: 50,
        },
      );
      assert.equal((await readdir(groups)).includes(`build-${id}`), false);
      return { result, log };
    } catch (error) {
      assert.equal((await readdir(groups)).includes(`build-${id}`), false);
      if (!options.cancelOn) console.error(log);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  const success = await build(`
    import assert from 'node:assert/strict';
    assert.equal(process.env.KAIZEN_FIXTURE_PRIVATE,undefined);
    for(const file of ${JSON.stringify([privateFile, root, "/etc/kaizen-helper", "/sys/fs/cgroup", "/input/.env", "/input/.npmrc", "/input/.git", "/work/.env", "/work/.npmrc", "/work/.git"])}) assert.equal(fs.existsSync(file),false,file);
    assert.throws(()=>fs.writeFileSync('/input/host-write','forbidden'));
    assert.throws(()=>fs.writeFileSync('/usr/host-write','forbidden'));
    const status=fs.readFileSync('/proc/self/status','utf8');
    assert.match(status,/NoNewPrivs:\\s+1\\s*$/m);assert.match(status,/CapEff:\\s+0+\\s*$/m);
    await assert.rejects(fetch(${JSON.stringify(hostUrl)},{signal:AbortSignal.timeout(1000)}));
    ${dist}
  `);
  assert.equal(
    success.result.get("/index.html")?.toString(),
    "<h1>Isolated fixture</h1>",
  );
  checks++;
  assert.equal(await readFile(privateFile, "utf8"), "private fixture bytes");
  assert.equal((await readdir(root)).includes("dist"), false);
  checks++;
  await assert.rejects(
    build(`${dist}fs.symlinkSync('/proc/self/status','dist/leak');`),
    /isolated build stopped/,
  );
  checks++;
  // Reject dependency traversal before any build code runs, including absolute
  // links that happen to resolve internally on the host but break after copying.
  await mkdir(path.join(root, "node_modules"));
  const dependencyLink = path.join(root, "node_modules", "unsafe-link");
  for (const target of [
    privateFile,
    "../../another-project-private-canary.txt",
  ]) {
    await symlink(target, dependencyLink);
    await assert.rejects(
      build(dist),
      /dependency links must be relative and remain inside/,
    );
    await unlink(dependencyLink);
    checks++;
  }
  const dependencyFile = path.join(root, "node_modules", "fixture.js");
  await writeFile(dependencyFile, "export default 'fixture';");
  await symlink(dependencyFile, dependencyLink);
  await assert.rejects(
    build(dist),
    /dependency links must be relative and remain inside/,
  );
  await unlink(dependencyLink);
  await unlink(dependencyFile);
  await rmdir(path.join(root, "node_modules"));
  checks++;
  await assert.rejects(
    build(
      `console.error('fixture-ready-to-cancel');setInterval(()=>{},1000);`,
      { cancelOn: "fixture-ready-to-cancel" },
    ),
    /Fixture cancellation/,
  );
  checks++;
  await assert.rejects(
    build(
      `const blocks=[];setInterval(()=>blocks.push(Buffer.alloc(8*1024*1024,1)),1);`,
      { memoryBytes: 128 * 1024 ** 2 },
    ),
    /exceeded its memory limit/,
  );
  checks++;
  // Writable tmpfs also counts against memory.max: a build cannot fill host disk.
  await assert.rejects(
    build(
      `const file=fs.openSync('/work/fill','w');const block=Buffer.alloc(8*1024*1024,1);for(let i=0;i<128;i++)fs.writeSync(file,block);`,
      { memoryBytes: 128 * 1024 ** 2 },
    ),
    /exceeded its memory limit/,
  );
  checks++;
  const forks = await build(
    `
    import {spawn} from 'node:child_process';
    const results=await Promise.all(Array.from({length:150},()=>new Promise(resolve=>{
      const child=spawn('/usr/bin/sleep',['60'],{stdio:'ignore'});child.once('error',()=>resolve('limited'));child.once('spawn',()=>resolve('started'));
    })));
    if(!results.includes('limited'))throw new Error('process limit was not enforced');
    ${dist}
    process.exit(0);
  `,
    { processes: 48 },
  );
  assert.ok(forks.result.has("/index.html"));
  checks++;
  // Exercise the same reviewed runner used by the helper, including its
  // existing recovery folders, fingerprints and served-snapshot verification.
  await mkdir(path.join(root, "src/pages"), { recursive: true });
  await writeFile(
    path.join(root, "src/pages/index.astro"),
    "<h1>Fixture source</h1>",
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { build: "node build.mjs" },
      dependencies: { astro: "7.3.2", "@astrojs/react": "6.0.5" },
    }),
  );
  const exec = promisify(execFile);
  await exec(
    "git",
    ["-c", "core.hooksPath=/dev/null", "init", "-b", "fixture", root],
    {
      env: {
        PATH: "/usr/bin:/bin",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  );
  await mkdir(path.join(root, "dist"));
  await writeFile(
    path.join(root, "dist/index.html"),
    "Previous verified output",
  );
  const runner = new RepositoryRunner(20000, 60000, {
    isolatedBuild: { command: async () => command, run: runIsolatedBuild },
  });
  async function runReview(script: string, cancel = false) {
    await writeFile(
      path.join(root, "build.mjs"),
      `import fs from 'node:fs';\n${script}`,
    );
    const review = await runner.prepare(root, "fixture");
    const started = await runner.start(review.id, "fixture");
    const deadline = Date.now() + 25000;
    let cancelled = false;
    for (;;) {
      const status = runner.status(started.id, "fixture");
      if (
        cancel &&
        !cancelled &&
        status.log.includes("fixture-ready-to-cancel")
      ) {
        cancelled = true;
        await runner.cancel(started.id, "fixture");
      }
      if (["failed", "cancelled", "succeeded"].includes(status.status))
        return status;
      if (Date.now() > deadline)
        throw new Error("Runner fixture exceeded its safety deadline");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  try {
    assert.equal(
      (await runReview("throw new Error('Deliberate build failure');")).status,
      "failed",
    );
    assert.equal(
      await readFile(path.join(root, "dist/index.html"), "utf8"),
      "Previous verified output",
    );
    checks++;
    assert.equal(
      (
        await runReview(
          "console.error('fixture-ready-to-cancel');setInterval(()=>{},1000);",
          true,
        )
      ).status,
      "cancelled",
    );
    assert.equal(
      await readFile(path.join(root, "dist/index.html"), "utf8"),
      "Previous verified output",
    );
    checks++;
    const result = await runReview(dist);
    assert.equal(result.status, "succeeded", result.error);
    assert.equal(
      await readFile(path.join(root, "dist/index.html"), "utf8"),
      "<h1>Isolated fixture</h1>",
    );
    assert.ok(result.previewUrl);
    checks++;
    assert.equal(
      await readFile(path.join(root, "src/pages/index.astro"), "utf8"),
      "<h1>Fixture source</h1>",
    );
    checks++;
  } finally {
    await runner.close();
  }
  const installed = process.env.KAIZEN_SANDBOX_DEPENDENCIES;
  assert.ok(
    installed && path.isAbsolute(installed),
    "Provide separately provisioned fixture dependencies",
  );
  await cp(installed, path.join(root, "node_modules"), {
    recursive: true,
    verbatimSymlinks: true,
    force: false,
    errorOnExist: true,
  });
  // Provisioned dependencies can already contain caches from an earlier build.
  // The sandbox may replace/create caches only in its disposable dependency copy.
  const dependencyRoot = path.join(root, "node_modules");
  await mkdir(path.join(dependencyRoot, ".vite"), { recursive: true });
  await writeFile(
    path.join(dependencyRoot, ".vite/kaizen-existing-cache.txt"),
    "Existing host cache",
  );
  const dependenciesBefore = await dependencyFingerprint(dependencyRoot);
  await writeFile(
    path.join(root, "cache-fixture.mjs"),
    `import assert from 'node:assert/strict';import fs from 'node:fs';
assert.equal(fs.readFileSync('node_modules/.vite/kaizen-existing-cache.txt','utf8'),'Existing host cache');
fs.writeFileSync('node_modules/.vite/kaizen-existing-cache.txt','Changed inside the sandbox');
fs.writeFileSync('node_modules/.vite/kaizen-new-cache.txt','Created inside the sandbox');`,
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      type: "module",
      scripts: { build: "node cache-fixture.mjs && astro build" },
      dependencies: {
        astro: "7.3.2",
        "@astrojs/react": "6.0.5",
        react: "19.2.4",
        "react-dom": "19.2.4",
      },
    }),
  );
  await writeFile(
    path.join(root, "astro.config.mjs"),
    "import {defineConfig} from 'astro/config';import react from '@astrojs/react';export default defineConfig({integrations:[react()]});",
  );
  await mkdir(path.join(root, "src/components"));
  await writeFile(
    path.join(root, "src/components/Counter.tsx"),
    "import {useState} from 'react';export default function Counter(){const [count,setCount]=useState(0);return <button onClick={()=>setCount(count+1)}>Count {count}</button>}",
  );
  await writeFile(
    path.join(root, "src/pages/index.astro"),
    "---\nimport Counter from '../components/Counter';\n---\n<html lang='en'><body><h1>Real isolated Astro</h1><p>{import.meta.env.FIXTURE_TOKEN ?? 'No private environment'}</p><Counter client:load /></body></html>",
  );
  const realRunner = new RepositoryRunner(30000, 60000, {
    isolatedBuild: { command: async () => command, run: runIsolatedBuild },
  });
  try {
    const review = await realRunner.prepare(root, "fixture");
    const job = await realRunner.start(review.id, "fixture");
    const deadline = Date.now() + 35000;
    for (;;) {
      const state = realRunner.status(job.id, "fixture");
      if (state.status === "succeeded") break;
      assert.ok(
        state.status === "building" && Date.now() < deadline,
        `${state.error}\n${state.log}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const html = await readFile(path.join(root, "dist/index.html"), "utf8");
    assert.ok(
      html.includes("Real isolated Astro") &&
        html.includes("No private environment") &&
        html.includes("astro-island"),
    );
    assert.ok(
      (await readdir(path.join(root, "dist/_astro"))).some((name) =>
        name.endsWith(".js"),
      ),
    );
    checks++;
    assert.equal(
      await dependencyFingerprint(dependencyRoot),
      dependenciesBefore,
      "Host dependencies and existing caches must remain unchanged",
    );
    checks++;
  } finally {
    await realRunner.close();
  }
  assert.deepEqual(
    (await readdir(groups)).filter((name) => name.startsWith("build-")).sort(),
    baseline.sort(),
  );
  checks++;
  console.log(
    `Build isolation: ${checks} checks passed; no live account or website data used.`,
  );
} finally {
  if (oldSentinel === undefined) delete process.env.KAIZEN_FIXTURE_PRIVATE;
  else process.env.KAIZEN_FIXTURE_PRIVATE = oldSentinel;
  await new Promise<void>((resolve) =>
    server ? server.close(() => resolve()) : resolve(),
  );
  await rm(directory, { recursive: true, force: true });
}
