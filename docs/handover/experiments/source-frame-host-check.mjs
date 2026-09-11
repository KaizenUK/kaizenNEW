import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
const hostname = randomBytes(24).toString('hex') + '.localhost';
let port;
const server = createServer((req,res)=>{
  if(req.headers.host!==`${hostname}:${port}`){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Security-Policy', "frame-ancestors https://builder.example; connect-src 'none'; form-action 'none'");
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end("document.querySelector('h1').textContent='Rendered local page';");}
  else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>Loading</h1><script type="module" src="/app.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
port=server.address().port;
const context=await chromium.launchPersistentContext(await mkdtemp(path.join(tmpdir(),'kaizen-source-frame-')), {channel:'chrome',headless:true});
try {
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('https://builder.example/**', r=>r.fulfill({contentType:'text/html',body:`<!doctype html><iframe title="Source" src="http://${hostname}:${port}/"></iframe>`}));
  await page.goto('https://builder.example/');
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('Rendered local page');
  expect(errors).toEqual([]);
  console.log('Verified HTTPS editor iframe → private localhost hostname, including root-relative module assets, without cookies.');
} finally { await context.close();server.closeAllConnections();await new Promise(r=>server.close(r)); }
