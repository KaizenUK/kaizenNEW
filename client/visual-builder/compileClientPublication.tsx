/** Trusted server renderer, loaded through Vite SSR. Never imports uploaded source. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { strFromU8, strToU8, unzipSync } from "fflate";
import { exportProject } from "./exportProject";
import PublishedPage from "./Renderer";
import { FormEndpointContext } from "./FormEndpointContext";
import { pageMetadataHead } from "../../shared/builderSiteMetadata";
import {
  needsBuilderRuntime,
  type PageDocument,
} from "../../shared/visualBuilder";
import type { ClientPublicationSnapshot } from "../../shared/builderClientPublication";
import { defaultClientSettings } from "../../shared/builderSettings";
import { hasContentBindings } from "../../shared/builderContent";

export async function compileClientPublication(
  snapshot: ClientPublicationSnapshot,
  assetBytes: (url: string) => Promise<Uint8Array>,
  progress: (message: string) => void,
) {
  const workspace = snapshot.workspace;
  if (
    !snapshot.catalogue &&
    (workspace.pages.some((page) =>
      hasContentBindings(page.draft.data.content),
    ) ||
      workspace.site?.draft.components.some((component) =>
        hasContentBindings(component.blocks),
      ))
  )
    throw new Error(
      "Capture this project's configured CMS catalogue before publishing connected content.",
    );
  const mediaFailures: Error[] = [];
  const exported = await exportProject(
    workspace.pages.map((page) => page.draft),
    workspace.assets,
    progress,
    async (url) => {
      try {
        return await assetBytes(url);
      } catch (error) {
        mediaFailures.push(error);
        throw error;
      }
    },
    workspace.site?.draft,
    snapshot.catalogue,
    workspace.routes?.draft,
    workspace,
  );
  if (mediaFailures.length)
    throw new Error(
      `Publication stopped because required media could not be bundled. ${mediaFailures[0].message}`,
    );
  const source = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()));
  const pages: PageDocument[] = JSON.parse(strFromU8(source["src/pages.json"]));
  const config = JSON.parse(strFromU8(source["src/siteConfig.json"]));
  const settings = workspace.settings?.value || defaultClientSettings();
  const files: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(source))
    if (name.startsWith("public/") && name !== "public/builder-runtime.js")
      files[name.slice(7)] = bytes;
  async function staticAsset(
    label: string,
    bytes: Uint8Array,
    extension: string,
  ) {
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", bytes as BufferSource),
      ),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
    const file = `assets/${label}-${hash.slice(0, 32)}.${extension}`;
    files[file] = bytes;
    return `/${file}`;
  }
  const css = await staticAsset("page", source["src/page.css"], "css");
  const runtime = await staticAsset(
    "runtime",
    source["public/builder-runtime.js"],
    "js",
  );
  for (const [index, page] of pages.entries()) {
    const body = renderToStaticMarkup(
      <FormEndpointContext.Provider value={settings.formEndpoint}>
        <PublishedPage document={page} />
      </FormEndpointContext.Provider>,
    );
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${pageMetadataHead(page, config)}${config.favicon ? "" : '<link rel="icon" href="data:,">'}<link rel="stylesheet" href="${css}"></head><body style="margin:0">${body}${needsBuilderRuntime(page.data.content) ? `<script src="${runtime}" defer></script>` : ""}</body></html>`;
    files[`${page.slug}/index.html`] = strToU8(html);
    if (index === 0) files["index.html"] = strToU8(html);
  }
  return {
    files,
    backup: source[".kaizen/project.zip"],
    redirects: workspace.routes?.draft || [],
    warnings: exported.warnings,
  };
}
