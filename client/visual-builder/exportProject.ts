import { strToU8, zip } from "fflate";
import rendererSource from "./Renderer.tsx?raw";
import schemaSource from "../../shared/visualBuilder.ts?raw";
import pageCss from "./page.css?raw";
import {
  clone,
  safeUrl,
  validateDocument,
  type Asset,
  type PageDocument,
} from "../../shared/visualBuilder";
import { storage } from "./storage";

type ExportResult = { blob: Blob; files: string[]; warnings: string[] };
const pathPart = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "asset";
export async function exportProject(
  pages: PageDocument[],
  assets: Asset[],
  progress: (message: string) => void,
  fetchFile: (url: string) => Promise<Uint8Array> = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  },
): Promise<ExportResult> {
  if (!pages.length) throw new Error("Create a page before exporting.");
  pages.forEach(validateDocument);
  const documents = clone(pages);
  const files: Record<string, Uint8Array> = {};
  const warnings: string[] = [];
  const urls = new Set<string>();
  for (const page of documents) {
    if (page.theme.fontUrl) urls.add(page.theme.fontUrl);
    const collect = (blocks: typeof page.data.content) =>
      blocks.forEach((block) => {
        if (block.props.src) urls.add(block.props.src);
        Object.values(block.props.style || {}).forEach((style) => {
          if (style.backgroundImage) urls.add(style.backgroundImage);
        });
        if (block.props.children) collect(block.props.children);
      });
    collect(page.data.content);
  }
  const replacements = new Map<string, string>();
  let total = 0;
  let i = 0;
  async function addBinary(name: string, url: string) {
    const bytes = await fetchFile(url);
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
    const name = asset
      ? `${asset.id}-${pathPart(asset.name)}`
      : `external-${++i}-${pathPart(url.split("/").pop().split("?")[0])}`;
    progress(`Bundling ${asset?.name || name}…`);
    try {
      await addBinary(`public/assets/${name}`, url);
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
  addText("src/pages.json", JSON.stringify(portable, null, 2));
  addText("src/schema.ts", schemaSource);
  addText(
    "src/Renderer.tsx",
    rendererSource
      .replace('"../../shared/visualBuilder"', '"./schema"')
      .replace('import "./page.css";', ""),
  );
  addText("src/page.css", pageCss);
  addText(
    "src/main.tsx",
    `import React from 'react';\nimport {hydrateRoot,createRoot} from 'react-dom/client';\nimport PublishedPage from './Renderer';\nimport pages from './pages.json';\nimport type {PageDocument} from './schema';\nimport './page.css';\nconst slug = location.pathname.replace(/^\\/+|\\/+$/g, '');\nconst page = (pages.find(page => page.slug === slug) || pages[0]) as PageDocument;\nconst root=document.getElementById('root')!; if(root.querySelector('.kb-page'))hydrateRoot(root,<PublishedPage document={page}/>);else createRoot(root).render(<PublishedPage document={page}/>);\n`,
  );
  addText(
    "index.html",
    '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kaizen exported site</title></head><body style="margin:0"><div id="root"><!--app--></div><script type="module" src="/src/main.tsx"></script></body></html>',
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
        dependencies: { react: "19.2.4", "react-dom": "19.2.4" },
        devDependencies: {
          vite: "7.3.1",
          tsx: "4.21.0",
          typescript: "5.9.3",
          "@types/react": "19.2.14",
          "@types/react-dom": "19.2.3",
          "@types/node": "25.3.3",
        },
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
  addText(
    "scripts/prerender.tsx",
    `import React from 'react';\nimport {renderToStaticMarkup} from 'react-dom/server';\nimport {readFile,writeFile,mkdir} from 'node:fs/promises';\nimport PublishedPage from '../src/Renderer';\nimport pages from '../src/pages.json';\nimport {validateDocument,type PageDocument} from '../src/schema';\nconst template=await readFile('dist/index.html','utf8');\nconst escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));\nfor(const [index,value] of pages.entries()){\n const page=validateDocument(value as PageDocument);\n const head='<title>'+escape(page.title)+'</title><meta name="description" content="'+escape(page.description)+'"><meta name="robots" content="'+(page.noIndex?'noindex, nofollow':'index, follow')+'">';\n const html=template.replace('<title>Kaizen exported site</title>',head).replace('<!--app-->',renderToStaticMarkup(<PublishedPage document={page}/>));\n await mkdir('dist/'+page.slug,{recursive:true});\n await writeFile('dist/'+page.slug+'/index.html',html);\n if(index===0)await writeFile('dist/index.html',html);\n}\nconsole.log('Exported '+pages.length+' static pages.');\n`,
  );
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
