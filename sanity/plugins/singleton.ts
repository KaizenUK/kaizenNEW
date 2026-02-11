import type { DocumentActionComponent } from "sanity";
import { applyDeployActions } from "../actions/deploy";

/**
 * Prevents duplicate creation of singleton document types (e.g. siteSettings)
 * and wires up deploy actions for deployable types.
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

      return applyDeployActions(allowedActions, schemaType);
    },
  },
};
