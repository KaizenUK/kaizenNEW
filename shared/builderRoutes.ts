import { clone, newId, type Workspace } from "./visualBuilder.ts";
import {
  validateBuilderRedirects,
  mergeRedirectConfiguration,
  localRedirectPaths,
} from "./builderRedirects.js";
import type { BuilderRedirect, RouteState } from "./builderRouteTypes.ts";
export type { BuilderRedirect, RouteState } from "./builderRouteTypes.ts";
export const initialRoutes = (): RouteState => ({
  version: 0,
  draft: [],
  published: [],
  revisions: [],
});
export function validateRouteState(state: RouteState): RouteState {
  if (
    !state ||
    !Number.isInteger(state.version) ||
    state.version < 0 ||
    !Array.isArray(state.revisions) ||
    state.revisions.length > 30
  )
    throw new Error("Invalid redirect history.");
  validateBuilderRedirects(state.draft);
  validateBuilderRedirects(state.published);
  for (const revision of state.revisions) {
    if (
      typeof revision.id !== "string" ||
      typeof revision.createdAt !== "string"
    )
      throw new Error("Invalid redirect revision.");
    validateBuilderRedirects(revision.rules);
  }
  return clone(state);
}
export function saveRoutes(
  old: RouteState | undefined,
  version: number,
  rules: BuilderRedirect[],
): RouteState {
  const state = old || initialRoutes();
  if (state.version !== version)
    throw new Error(
      "Redirects changed in another window. Reopen them before saving.",
    );
  const draft = validateBuilderRedirects(rules) as BuilderRedirect[];
  return {
    ...clone(state),
    version: version + 1,
    draft,
    revisions: [
      ...state.revisions,
      { id: newId(), createdAt: new Date().toISOString(), rules: clone(draft) },
    ].slice(-30),
  };
}
export function publishLocalRoutes(
  workspace: Workspace,
  version: number,
): Workspace {
  if (!workspace.routes || workspace.routes.version !== version)
    throw new Error("Save the latest redirects before publishing.");
  const next = {
    ...workspace,
    routes: { ...workspace.routes, published: clone(workspace.routes.draft) },
  };
  assertLocalPublicationRoutes(next);
  return next;
}
/** Check the complete candidate before any local publication is written. */
export function assertLocalPublicationRoutes(workspace: Workspace) {
  const rules = workspace.routes?.published || [];
  validateBuilderRedirects(
    rules,
    workspace.pages.map((page) => `/${page.draft.slug}/`),
  );
  try {
    mergeRedirectConfiguration(rules, [], localRedirectPaths(workspace.pages));
  } catch (error) {
    throw new Error(
      `${(error as Error).message} Update or remove the affected redirect and publish it before changing this page's live URL.`,
    );
  }
}
