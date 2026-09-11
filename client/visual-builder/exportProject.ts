import { strToU8, zip } from "fflate";
import rendererSource from "./Renderer.tsx?raw";
import richTextSource from "./RichText.tsx?raw";
import interactiveSource from "./InteractiveBlocks.tsx?raw";
import contactSource from "./ContactBlock.tsx?raw";
import formContextSource from "./FormEndpointContext.ts?raw";
import mediaContextSource from "./MediaContext.ts?raw";
import runtimeSource from "./runtime.js?raw";
import schemaSource from "../../shared/visualBuilder.ts?raw";
import siteSource from "../../shared/builderSite.ts?raw";
import contextSource from "./SiteContext.ts?raw";
import contentContextSource from "./ContentContext.ts?raw";
import contentListSource from "./ContentListBlock.tsx?raw";
import contentSource from "../../shared/builderContent.ts?raw";
import {
  hasContentBindings,
  resolveContentDocument,
} from "../../shared/builderContent";
import { resolveSiteDocument } from "../../shared/builderSite";
import pageCss from "./page.css?raw";
import {
  clone,
  safeUrl,
  validateDocument,
  type Asset,
  type PageDocument,
  type SiteDesign,
  type ContentCatalogue,
} from "../../shared/visualBuilder";
import { storage } from "./storage";
import { createProjectBackup } from "./projectBackup";
import type { Workspace } from "../../shared/visualBuilder";
import { materializeImages } from "../../shared/builderImages";
import imagesSource from "../../shared/builderImages.ts?raw";
import imageContextSource from "./ImageContext.ts?raw";
import registrySource from "../../shared/builderRegistry.ts?raw";
import conversionsSource from "../../shared/builderConversions.ts?raw";
import registeredSource from "./RegisteredBlocks.tsx?raw";
import routeTypesSource from "../../shared/builderRouteTypes.ts?raw";
import {
  builderNginxRules,
  validateBuilderRedirects,
} from "../../shared/builderRedirects.js";
import type { BuilderRedirect } from "../../shared/builderRouteTypes";
import {
  defaultClientSettings,
  validateClientSettings,
} from "../../shared/builderSettings";
import {
  siteSitemap,
  type PublicSiteConfig,
} from "../../shared/builderSiteMetadata";
import settingsSource from "../../shared/builderSettings.ts?raw";
import metadataSource from "../../shared/builderSiteMetadata.ts?raw";
import prerenderSource from "./exportPrerender.ts.txt?raw";

type ExportResult = { blob: Blob; files: string[]; warnings: string[] };
const pathPart = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "asset";
export async function exportProject(
  pages: PageDocument[],
  assets: Asset[],
  progress: (message: string) => void,
  fetchFile: (url: string) => Promise<Uint8Array> = async (url) => {
    const response = await fetch(await storage.resolveMediaUrl(url));
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  },
  site?: SiteDesign,
  catalogue?: ContentCatalogue,
  routes: BuilderRedirect[] = [],
  editableWorkspace?: Workspace,
): Promise<ExportResult> {
  if (!pages.length) throw new Error("Create a page before exporting.");
  const settings = validateClientSettings(
    editableWorkspace?.settings?.value || defaultClientSettings(),
  );
  pages.forEach(validateDocument);
  const sharedDocuments = pages.map((page) => resolveSiteDocument(page, site));
  const connected = sharedDocuments.some((page) =>
    hasContentBindings(page.data.content),
  );
  if (connected && !catalogue) {
    progress("Loading published Sanity content…");
    catalogue = await storage.loadContent();
  }
  const documents = sharedDocuments.map((page) =>
    materializeImages(resolveContentDocument(page, catalogue), assets),
  );
  const files: Record<string, Uint8Array> = {};
  const warnings: string[] = [];
  const redirects = validateBuilderRedirects(routes, [
    "/",
    ...pages.map((page) => `/${page.slug}/`),
  ]);
  const exportedPaths = new Set([
    "/",
    ...pages.map((page) => `/${page.slug}/`),
  ]);
  const internalLinks = new Set<string>();
  const collectLinks = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collectLinks);
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([key, item]) => {
        if (
          key === "href" &&
          typeof item === "string" &&
          item.startsWith("/") &&
          !item.startsWith("//")
        )
          internalLinks.add(item);
        collectLinks(item);
      });
    else if (typeof value === "string" && value.includes("<a")) {
      for (const match of value.matchAll(/href\s*=\s*["'](\/[^"']*)["']/gi))
        if (!match[1].startsWith("//")) internalLinks.add(match[1]);
    }
  };
  documents.forEach(collectLinks);
  for (const href of internalLinks) {
    const pathname = new URL(href, "https://export.invalid").pathname.replace(
      /\/?$/,
      "/",
    );
    if (
      !exportedPaths.has(pathname) &&
      !redirects.some((rule) => rule.source === pathname)
    )
      warnings.push(
        `Link ${href} has no page or redirect in this project. Add the destination or update the link before delivery.`,
      );
  }
  for (const rule of redirects) {
    let destination = rule.destination;
    while (redirects.some((next) => next.source === destination))
      destination = redirects.find(
        (next) => next.source === destination,
      )!.destination;
    if (!exportedPaths.has(destination))
      warnings.push(
        `Redirect ${rule.source} ends at ${destination}, which is outside this export. Provide that page on the destination host or update this rule.`,
      );
  }
  if (connected)
    warnings.push(
      "Sanity content was captured at export time. This project runs without a CMS connection; article links still point to the existing /blog/ routes, which are not generated by this export.",
    );
  if (
    JSON.stringify(documents).includes('"ContactForm"') &&
    !settings.formEndpoint
  )
    warnings.push(
      "Contact forms need a receiving service. Set the public form receiver in Client settings, then export again to preserve visual editability. CONTACT-FORMS.md describes the receiver contract and delivery checks. Kaizen credentials and development receivers are not exported.",
    );
  const urls = new Set<string>();
  if (!settings.siteUrl)
    warnings.push(
      "No website URL is configured. Set Client settings before delivery to generate canonical URLs and sitemap.xml.",
    );
  const favicon =
    settings.favicon &&
    assets.find(
      (asset) =>
        asset.id === settings.favicon.assetId &&
        ["image", "icon"].includes(asset.kind),
    );
  if (settings.favicon && !favicon)
    throw new Error(
      "The configured favicon is missing from this project. Choose another favicon in Client settings.",
    );
  if (favicon) urls.add(favicon.url);
  for (const page of documents) {
    if (page.theme.fontUrl) urls.add(page.theme.fontUrl);
    const collect = (blocks: typeof page.data.content) =>
      blocks.forEach((block) => {
        if (block.props.src) urls.add(block.props.src);
        const image = block.props.image as
          | import("../../shared/visualBuilder").AssetImage
          | undefined;
        for (const variant of image?.variants || []) urls.add(variant.url);
        for (const background of (block.props.backgroundImages ||
          []) as import("../../shared/visualBuilder").AssetImage[])
          for (const variant of background.variants) urls.add(variant.url);
        if (block.type === "ContentList" && Array.isArray(block.props.records))
          for (const record of block.props.records)
            if (record.image) urls.add(record.image);
        for (const key of ["poster", "captions"])
          if (typeof block.props[key] === "string" && block.props[key])
            urls.add(block.props[key] as string);
        Object.values(block.props.style || {}).forEach((style) => {
          if (style.backgroundImage && style.backgroundImage !== "none")
            urls.add(style.backgroundImage);
        });
        if (block.props.children) collect(block.props.children);
      });
    collect(page.data.content);
  }
  const replacements = new Map<string, string>();
  let total = 0;
  let i = 0;
  async function addBinary(name: string, url: string, content?: Uint8Array) {
    const bytes = content || (await fetchFile(url));
    total += bytes.byteLength;
    if (total > 500 * 1024 * 1024)
      throw new Error(
        "This export exceeds 500 MB. Export a smaller set of pages or packs.",
      );
    files[name] = bytes;
  }
  for (const url of urls) {
    const asset = assets.find((a) => a.url === url);
    if (!safeUrl(url, true))
      throw new Error("A page contains an invalid media URL.");
    const baseName = asset
      // Keep the uploaded filename's extension when its display name changes.
      ? `${asset.id}-${pathPart(asset.path.split("/").pop() || asset.name)}`
      : `external-${++i}-${pathPart(url.split("/").pop().split("?")[0])}`;
    progress(`Bundling ${asset?.name || baseName}…`);
    try {
      const bytes = await fetchFile(url);
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes as BufferSource),
        ),
        (value) => value.toString(16).padStart(2, "0"),
      )
        .join("")
        .slice(0, 16);
      const name = `${baseName.replace(/(\.[^.]+)?$/, `-${digest}$1`)}`;
      await addBinary(`public/assets/${name}`, url, bytes);
      replacements.set(url, `/assets/${name}`);
    } catch (error) {
      if (asset || url.startsWith("/"))
        throw new Error(
          `Could not bundle ${asset?.name || url}: ${(error as Error).message}. Retry before sharing this project.`,
        );
      warnings.push(
        `${url}: not bundled because the source could not be downloaded. The page still references this external URL.`,
      );
    }
  }
  // Licence and source files are references only, outside src/ and never imported by the app.
  for (const asset of assets.filter((a) =>
    ["licence", "design", "code"].includes(a.kind),
  )) {
    progress(`Including pack reference: ${asset.name}…`);
    const name = `reference-packs/${pathPart(asset.pack)}/${asset.id}/${asset.path.split("/").map(pathPart).join("/")}`;
    await addBinary(name, await storage.download(asset));
  }
  const replace = (value: unknown): unknown =>
    typeof value === "string"
      ? replacements.get(value) || value
      : Array.isArray(value)
        ? value.map(replace)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, v]) => [key, replace(v)]),
            )
          : value;
  const portable = replace(documents) as PageDocument[];
  const addText = (name: string, text: string) => {
    files[name] = strToU8(text);
  };
  const siteConfig: PublicSiteConfig = {
    siteUrl: settings.siteUrl,
    favicon: favicon ? replacements.get(favicon.url)! : "",
    formEndpoint: settings.formEndpoint,
  };
  addText("src/siteConfig.json", JSON.stringify(siteConfig, null, 2));
  addText(
    "SITE-SETTINGS.md",
    `# Client site settings\n\nWebsite URL: ${settings.siteUrl || "not configured"}\nPublic form receiver: ${settings.formEndpoint || "disabled"}\nCMS: ${settings.cms.kind === "none" ? "not connected" : `Public Sanity project ${settings.cms.projectId}, dataset ${settings.cms.dataset}. Content is captured at export time; no live CMS call is required.`}\n\nNo environment variables or secret values are required to build this snapshot. Receiver-side environment variables depend on the separately implemented form service; they must never be added to browser code.\n\nThe first exported page is also served at /; its canonical URL is its named route. sitemap.xml includes indexable builder pages only. Pages marked noindex and redirect aliases are excluded. Astro integration preserves existing routes, so a developer must merge their sitemap coverage if needed. Hosting must serve directory index.html files, apply hosting/nginx-redirects.conf (or equivalent redirect rules), and serve only dist/.\n\nClient settings are retained in the editable backup. src/siteConfig.json and src/formConfig.ts are generated: change them through Client settings for a visual round trip. Website-only handoffs may edit these files, but direct source edits do not synchronize to the builder.\n`,
  );
  addText("src/builderSettings.ts", settingsSource);
  addText("src/builderSiteMetadata.ts", metadataSource);
  if (siteConfig.siteUrl) {
    addText("public/sitemap.xml", siteSitemap(portable, siteConfig));
    addText(
      "public/robots.txt",
      `User-agent: *\nAllow: /\nSitemap: ${siteConfig.siteUrl}/sitemap.xml\n`,
    );
  }
  addText("src/pages.json", JSON.stringify(portable, null, 2));
  addText("src/builderRouteTypes.ts", routeTypesSource);
  addText("src/FormEndpointContext.ts", formContextSource);
  addText("src/MediaContext.ts", mediaContextSource);
  addText("redirects.json", JSON.stringify(redirects, null, 2));
  addText("hosting/redirects.json", JSON.stringify(redirects, null, 2));
  addText(
    "hosting/nginx-redirects.conf",
    builderNginxRules(redirects).join("\n") + "\n",
  );
  addText(
    "REDIRECTS.md",
    "# URL redirects\n\nredirects.json contains redirect drafts at export time. Include hosting/nginx-redirects.conf inside your Nginx server block to serve the specified HTTP 301/302 responses with tracking queries preserved, covering both trailing-slash forms. Other hosts need equivalent rules using redirects.json. These rules are not automatically activated by Vite or the static HTML build. Validate destinations, review permanent redirect caching and test the deployed responses before sharing old URLs.\n",
  );
  addText(
    "src/schema.ts",
    schemaSource
      .replace('"./builderSettings.ts"', '"./builderSettings"')
      .replace('"./builderRegistry.ts"', '"./builderRegistry"')
      .replace('"./builderRouteTypes.ts"', '"./builderRouteTypes"')
      .replace('"./builderConversions.ts"', '"./builderConversions"'),
  );
  addText("src/builderRegistry.ts", registrySource);
  addText(
    "src/builderConversions.ts",
    conversionsSource
      .replace('"./visualBuilder.ts"', '"./schema"')
      .replace('"./builderRegistry.ts"', '"./builderRegistry"'),
  );
  addText(
    "src/RegisteredBlocks.tsx",
    registeredSource
      .replace('"../../shared/visualBuilder"', '"./schema"')
      .replace('"../../shared/builderRegistry"', '"./builderRegistry"'),
  );
  addText(
    "REGISTERED-BLOCKS.md",
    "# Reviewed React blocks\n\nCompiled implementations live in src/RegisteredBlocks.tsx. Their immutable IDs, editable fields and source/requirements review contracts live in src/builderRegistry.ts. Asset conversion briefs and source hashes are retained in asset-manifest.json; original source and licences remain in reference-packs and are never imported or executed. This export includes the compiled reviewed implementations; arbitrary source changes do not synchronise back into the builder. See the Kaizen repository's docs/builder-component-integration.md for registration and review instructions.\n",
  );
  addText(
    "src/builderImages.ts",
    imagesSource.replace('"./visualBuilder.ts"', '"./schema"'),
  );
  addText(
    "src/ImageContext.ts",
    imageContextSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/builderSite.ts",
    siteSource
      .replace('"./visualBuilder.ts"', '"./schema"')
      .replace('"./builderImages.ts"', '"./builderImages"'),
  );
  addText(
    "src/SiteContext.ts",
    contextSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/InteractiveBlocks.tsx",
    interactiveSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/ContactBlock.tsx",
    contactSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/formConfig.ts",
    `// Public contact receiver URL. No secret values belong here.\nexport const builderFormEndpoint: string = ${JSON.stringify(settings.formEndpoint)};\n`,
  );
  addText("public/builder-runtime.js", runtimeSource);
  addText(
    "src/ContentContext.ts",
    contentContextSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/ContentListBlock.tsx",
    contentListSource
      .replace('"../../shared/visualBuilder"', '"./schema"')
      .replace('"../../shared/builderContent"', '"./builderContent"'),
  );
  addText(
    "src/builderContent.ts",
    contentSource
      .slice(0, contentSource.indexOf("export const CONTENT_QUERY"))
      .replace('"./visualBuilder.ts"', '"./schema"'),
  );
  addText(
    "src/RichText.tsx",
    richTextSource.replace('"../../shared/visualBuilder"', '"./schema"'),
  );
  addText(
    "src/Renderer.tsx",
    rendererSource
      .replace('"../../shared/visualBuilder"', '"./schema"')
      .replace('"../../shared/builderSite"', '"./builderSite"')
      .replace('"../../shared/builderContent"', '"./builderContent"')
      .replace('"../../shared/builderImages"', '"./builderImages"')
      .replace('import "./page.css";', ""),
  );
  addText("src/page.css", pageCss);
  addText(
    "src/main.tsx",
    `import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {flushSync} from 'react-dom';\nimport PublishedPage from './Renderer';\nimport pages from './pages.json';\nimport {needsBuilderRuntime,type PageDocument} from './schema';\nimport './page.css';\nconst slug = location.pathname.replace(/^\\/+|\\/+$/g, '');\nconst page = (pages.find(page => page.slug === slug) || pages[0]) as PageDocument;\nconst root=document.getElementById('root')!; flushSync(()=>createRoot(root).render(<PublishedPage document={page}/>));\nif(needsBuilderRuntime(page.data.content)){const script=document.createElement('script');script.src='/builder-runtime.js';document.body.appendChild(script);}\n`,
  );
  addText(
    "index.html",
    '<!doctype html><html lang="en"><head><link rel="icon" href="data:,"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kaizen exported site</title></head><body style="margin:0"><div id="root"><!--app--></div><script type="module" src="/src/main.tsx"></script></body></html>',
  );
  addText(
    "package.json",
    JSON.stringify(
      {
        name: "kaizen-exported-site",
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite --host 127.0.0.1",
          build: "vite build && tsx scripts/prerender.tsx",
          preview: "vite preview --host 127.0.0.1",
          typecheck: "tsc --noEmit",
        },
        dependencies: {
          react: "19.2.4",
          "react-dom": "19.2.4",
          htmlparser2: "12.0.0",
        },
        devDependencies: {
          vite: "8.3.0",
          tsx: "4.21.0",
          typescript: "5.9.3",
          "@types/react": "19.2.14",
          "@types/react-dom": "19.2.3",
          "@types/node": "25.3.3",
        },
        overrides: { esbuild: "0.28.1" },
        pnpm: { overrides: { esbuild: "0.28.1" } },
      },
      null,
      2,
    ),
  );
  addText(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          resolveJsonModule: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          lib: ["ES2022", "DOM"],
        },
        include: ["src", "scripts"],
      },
      null,
      2,
    ),
  );
  addText("scripts/prerender.tsx", prerenderSource);
  addText(
    "asset-manifest.json",
    JSON.stringify(
      assets.map((a) => ({
        ...a,
        exportedUrl: replacements.get(a.url),
        url: a.url.startsWith("private:")
          ? "private source included under reference-packs"
          : a.url,
      })),
      null,
      2,
    ),
  );
  addText(
    "HANDOFF.md",
    `# Kaizen website handoff\n\nThis ZIP is a working React/TypeScript project exported from Kaizen Builder. It contains the latest drafts at export time, not necessarily the live site. No editor, credentials, Supabase connection or uploaded source code is required to run it.\n\n## Run\n\nUse Node 22 or later. Run \`npm install\`, then \`npm run dev\`. Run \`npm run build\` to generate static HTML for every page in \`dist/\`; \`npm run preview\` serves that output. \`npm run typecheck\` checks the project. The first exported page also appears at /.\n\n## Ask Claude or Codex\n\n“Inspect HANDOFF.md, src/pages.json, src/Renderer.tsx and src/page.css. Implement and refine this website using the exported React components and bundled assets. Preserve the page URLs, SEO fields, responsive overrides and copy unless I request a change. Check desktop, tablet and mobile in a browser. Review reference-packs before converting any design/source file into code. Do not execute or import uploaded code automatically. Tell me about missing external assets or links.”\n\n## Structure\n\n- src/pages.json: version 1 page data, URLs, SEO and global page styles.\n- src/Renderer.tsx: shared React components; add reviewed components here.\n- src/page.css: desktop styles, tablet overrides at 1023px, mobile at 639px.\n- public/assets: media and fonts referenced by these pages.\n- reference-packs: supplied licences, source and design files; never executed.\n- asset-manifest.json: original pack names, filenames, folders and hashes.\n\nExisting links (for example /contact/) may point to pages outside this export. Review them before deploying. This archive does not contain the Kaizen editor, authentication or backend. Changes to generated source are a developer handoff; they do not automatically synchronise back to the builder.\n\n## External dependencies\n\n${warnings.length ? warnings.map((w) => "- " + w).join("\n") : "All referenced media and fonts were bundled."}\n\n## Pages\n\n${portable.map((p) => "- /" + p.slug + "/ — " + p.title).join("\n")}\n`,
  );
  addText(".gitignore", "node_modules/\ndist/\n.env\n");
  if (editableWorkspace) {
    progress("Including the separate editable project backup…");
    const backup = await createProjectBackup(
      editableWorkspace,
      progress,
      async (asset) => fetchFile(await storage.download(asset)),
    );
    files[".kaizen/project.zip"] = new Uint8Array(await backup.arrayBuffer());
    addText(
      ".kaizen/format.json",
      JSON.stringify(
        {
          format: "kaizen-repository",
          version: editableWorkspace.settings ? 2 : 1,
          editableSource: ".kaizen/project.zip",
          output: "react-static",
        },
        null,
        2,
      ),
    );
    addText(
      "EDITABILITY.md",
      "# Editing after handoff\n\n.kaizen/project.zip is the editable source of truth: versioned page structure, original assets, shared definitions and history. It is a separate editable backup, not part of the served website. Keep .kaizen private and deploy only dist/. Reopen it through the local Kaizen companion or restore it through Project backups.\n\nThe website export contains generated renderer code and resolved src/pages.json snapshots. Source edits are developer-managed and cannot automatically become visual edits. The local integration review detects changes to generated files and stops rather than overwriting them. Keep unrelated code in separate files. Use GitHub Desktop to review, commit and push after integration.\n",
    );
  }
  addText(
    "CONTACT-FORMS.md",
    `# Contact receipt and notification delivery

Contact forms render as static React HTML and use public/builder-runtime.js. Configure the public form receiver in Client settings, then export or integrate again. This keeps the receiver URL in the editable backup. For a website-only handoff, a developer may instead edit generated src/formConfig.ts and rebuild; that edit does not update the visual project and will require reconciliation before a later integration.

The configured receiver is listed in SITE-SETTINGS.md. An empty URL disables submission. The export includes no receiving backend, Kaizen receiver or credentials. The receiver must accept the exported site's origin, validate input on the server, limit spam and deduplicate request_id. Private service credentials and notification-provider settings belong on that receiver's server; document their required environment variable names there, without secret values.

## Request contract

The browser POSTs application/json with request_id (UUID), name, last_name, email, phone, website, message, company_address (empty honeypot), consent_to_gdpr (required true), marketing_consent (boolean, default false), source_page (pathname) and user_agent. Required name and message must be nonempty. Limits: name/last_name 100, email 254, phone 40, website 200, message 5000, source_page 1000, user_agent 500 characters. A separate-origin receiver must handle OPTIONS and allow the website origin, POST and Content-Type; requests omit cookies.

Return HTTP 200 with {"ok":true} only after durably accepting the enquiry. This acknowledges receipt, not delivery of an email notification. Keep the form's success message about receipt unless the receiver provides independently verified delivery evidence. Notification failure after storage must not erase the enquiry or ask the visitor to submit it again; handle retry and failure reporting at the receiver. Provider acceptance or queueing is not proof of inbox delivery.

Return 400 for invalid fields, 409 when a request_id is reused with changed content, 429 for rate limiting, or 503 when persistence is unavailable, with a JSON error message. The runtime preserves details after failure and reuses the request UUID for an unchanged retry. The receiver must acknowledge an already accepted identical request without storing or notifying twice. Keep privacy wording and links accurate for the client website.

## Checks before client delivery

1. On the deployed staging origin, send an agreed test enquiry and confirm its request_id and content in the receiver's durable records. An editor preview intentionally sends nothing.
2. Check notification processing separately in the receiver/provider, then confirm arrival with the designated recipient. Record receipt and notification outcomes separately; a successful form screen alone proves neither the configured mailbox nor inbox delivery.
3. Verify an unchanged retry after a lost acknowledgement creates one enquiry and does not send duplicate notifications. Verify invalid input, rate limiting and an unavailable receiver preserve useful visitor feedback and entered details.
4. Check the actual production origin's CORS configuration and the intended recipient before enabling the form. If delivery has not been verified, record that dependency in the client handoff rather than marking it complete.
`,
  );
  progress("Creating your project ZIP…");
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/zip" }),
    files: Object.keys(files),
    warnings,
  };
}
export function downloadProject(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kaizen-site-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
