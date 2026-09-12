import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormEndpointContext } from "./FormEndpointContext";
import PublishedPage from "./Renderer";
import {
  needsBuilderRuntime,
  type PageDocument,
} from "../../shared/visualBuilder";
import { validatePreviewDocument } from "../../shared/builderPreviews";
import runtimeSource from "./runtime.js?raw";
import pageCss from "./page.css?inline";

export function previewHtml(document: PageDocument, formEndpoint = "") {
  validatePreviewDocument(document);
  // Only reviewed renderer/runtime code is emitted. All user text is escaped by the React renderer.
  return `<!doctype html><html lang="en" data-kb-preview><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><style>body{margin:0}${pageCss}</style></head><body>${renderToStaticMarkup(
    <FormEndpointContext.Provider value={formEndpoint}>
      <PublishedPage document={document} />
    </FormEndpointContext.Provider>,
  )}${needsBuilderRuntime(document.data.content) ? `<script>${runtimeSource}</script>` : ""}</body></html>`;
}
