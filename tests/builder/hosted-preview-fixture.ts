import { createServer } from "node:https";
import { request as forward } from "node:http";
import {
  mkdtemp,
  readFile,
  rm,
  mkdir,
  writeFile,
  copyFile,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { hostedHelperFixture } from "./hosted-helper-fixture";
import { BUILDER_TEST_ORIGIN } from "./ports";

/** A real TLS reverse proxy and hosted service. Only certificates, SSH and Supabase accounts are fixtures. */
export async function hostedPreviewFixture(projectId: string) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kaizen-hosted-preview-"),
  );
  await promisify(execFile)("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    path.join(directory, "key.pem"),
    "-out",
    path.join(directory, "cert.pem"),
    "-days",
    "2",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  let helperOrigin: string | undefined;
  const requests: {
    path: string;
    status: number;
    cookie: boolean;
    origin?: string;
    destination?: string;
  }[] = [];
  const server = createServer(
    {
      key: await readFile(path.join(directory, "key.pem")),
      cert: await readFile(path.join(directory, "cert.pem")),
    },
    (req, res) => {
      const pathname = req.url || "/";
      const helper =
        pathname.startsWith("/editor-preview/") ||
        pathname === "/editor-api/builder-repository";
      const target = new URL(
        pathname,
        helper ? helperOrigin : BUILDER_TEST_ORIGIN,
      );
      const outgoing = forward(
        target,
        { method: req.method, headers: { ...req.headers, host: target.host } },
        (response) => {
          if (helper)
            requests.push({
              path: pathname,
              status: response.statusCode || 500,
              cookie: Boolean(req.headers.cookie),
              origin: req.headers.origin,
              destination: req.headers["sec-fetch-dest"] as string | undefined,
            });
          res.writeHead(response.statusCode || 500, response.headers);
          response.pipe(res);
        },
      );
      outgoing.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.on("aborted", () => outgoing.destroy());
      req.pipe(outgoing);
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `https://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const api = await hostedHelperFixture(
    [projectId],
    "import { build } from 'astro'; await build({logLevel:'silent'});",
    origin,
    async (seed) => {
      await mkdir(path.join(seed, "src/components"), { recursive: true });
      await mkdir(path.join(seed, "public"));
      await writeFile(
        path.join(seed, "astro.config.mjs"),
        "import {defineConfig} from 'astro/config'; import react from '@astrojs/react'; export default defineConfig({output:'static',integrations:[react()],vite:{build:{minify:false}}});",
      );
      await writeFile(
        path.join(seed, "src/components/Counter.jsx"),
        "import React,{useState,useEffect} from 'react'; export default function Counter(){const [n,set]=useState(0);const [ready,mark]=useState(false);useEffect(()=>mark(true),[]);return <button data-hydrated={ready} onClick={()=>set(n+1)}>Count {n}</button>;}",
      );
      await writeFile(
        path.join(seed, "src/pages/index.astro"),
        `---\nimport Counter from '../components/Counter.jsx';\n---\n<html><head><title>Private hosted website</title><link rel="stylesheet" href="/site.css"/></head><body><main><h1>Hosted original</h1><p>Keep the original layout.</p><a href="/contact/">Contact us</a><img src="/picture.svg" alt="A green square"/><Counter client:load /></main></body></html>`,
      );
      await writeFile(
        path.join(seed, "src/pages/contact.astro"),
        '<html><body><h1>Private contact</h1><a href="/">Home</a></body></html>',
      );
      await writeFile(
        path.join(seed, "public/site.css"),
        "@import '/theme.css'; @font-face{font-family:Fixture;src:url('/fixture.ttf')} h1{font-family:Fixture;color:rgb(12,34,56)} img{width:80px}",
      );
      await writeFile(
        path.join(seed, "public/theme.css"),
        "body{margin:32px;background:#faf8f3;color:#192b26;font-family:system-ui}button,a{padding:12px}h1{font-size:42px}",
      );
      await writeFile(
        path.join(seed, "public/picture.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="green"/></svg>',
      );
      await copyFile(
        path.resolve("public/fonts/manifa-v2-bold.ttf"),
        path.join(seed, "public/fixture.ttf"),
      );
    },
  );
  helperOrigin = api.helper.origin;
  await api.send({ action: "repository-connect", projectId });
  await symlink(
    path.resolve("node_modules"),
    path.join(api.folders.root(projectId), "node_modules"),
    "dir",
  );
  return {
    api,
    origin,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await api.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
