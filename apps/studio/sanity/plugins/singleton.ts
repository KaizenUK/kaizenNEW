import type { DocumentActionComponent } from "sanity";
import { applyDeployActions } from "../actions/deploy";
import { previewAction, createDiscardAction } from "../actions/preview";

/**
 * Handles singleton restrictions, publish action wrappers, and surfaces
 * Preview + Discard (+ Delete for content docs) as visible top-level actions.
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

      // Keep publish label as "Publish" while still triggering deploy webhook.
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

      // Add Preview action near the main workflow buttons.
      if (!allowedActions.some((a) => a.displayName === "PreviewAction")) {
        const discardActionIndex = allowedActions.findIndex(
          (a) => a.displayName === "DiscardAction" || a.action === "discardChanges",
        );
        const insertAt =
          discardActionIndex > -1
            ? discardActionIndex + 1
            : Math.min(2, allowedActions.length);
        allowedActions.splice(insertAt, 0, previewAction);
      }

      // Surface Delete close to Preview so it is not hidden in the menu.
      const deleteIdx = allowedActions.findIndex((a) => a.action === "delete");
      if (deleteIdx > -1) {
        const [deleteAction] = allowedActions.splice(deleteIdx, 1);
        const previewIdx = allowedActions.findIndex(
          (a) => a.displayName === "PreviewAction",
        );
        const insertAt =
          previewIdx > -1 ? previewIdx + 1 : Math.min(3, allowedActions.length);
        allowedActions.splice(insertAt, 0, deleteAction);
      }

      return allowedActions;
    },
  },
};
