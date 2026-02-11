import type { DocumentActionComponent } from "sanity";
import { applyDeployActions } from "../actions/deploy";
import { previewAction, createDiscardAction } from "../actions/preview";

/**
 * Handles singleton restrictions, deploy actions, and surfaces
 * Preview + Discard as visible top-level document actions.
 */
export const singletonPlugin = {
  name: "singleton-and-deploy-actions",
  document: {
    newDocumentOptions: (prev: any[], { creationContext }: any) =>
      creationContext?.type === "global"
        ? prev.filter(
            (templateItem) => templateItem.templateId !== "siteSettings",
          )
        : prev,
    actions: (
      prev: DocumentActionComponent[],
      { schemaType }: { schemaType: string },
    ) => {
      let allowedActions = prev;

      if (schemaType === "siteSettings") {
        allowedActions = prev.filter((action) =>
          action.action
            ? ["publish", "discardChanges", "restore"].includes(action.action)
            : false,
        );
      }

      // Apply deploy wrappers (Publish & Deploy, Deploy Now)
      allowedActions = applyDeployActions(allowedActions, schemaType);

      // Surface the built-in Discard Changes as a visible action (instead of
      // being buried in the dropdown menu). Keep it after Publish.
      const discardIdx = allowedActions.findIndex(
        (a) => a.action === "discardChanges",
      );
      if (discardIdx > -1) {
        const original = allowedActions[discardIdx];
        allowedActions[discardIdx] = createDiscardAction(original);
      }

      // Add Preview action at position 2 (after Publish & Deploy + Discard)
      if (!allowedActions.some((a) => a.displayName === "PreviewAction")) {
        // Insert after position 1 (Deploy Now is 0, Publish is 1)
        const insertAt = Math.min(2, allowedActions.length);
        allowedActions.splice(insertAt, 0, previewAction);
      }

      return allowedActions;
    },
  },
};
