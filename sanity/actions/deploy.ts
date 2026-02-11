import type { DocumentActionComponent } from "sanity";

const DEPLOYABLE_SCHEMA_TYPES = new Set(["post", "page"]);

async function triggerStudioDeploy(payload: {
  documentId?: string;
  schemaType?: string;
}): Promise<void> {
  const response = await fetch("/api/deploy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Deploy failed (${response.status})${message ? `: ${message}` : ""}`,
    );
  }
}

export function wrapPublishWithDeploy(
  action: DocumentActionComponent,
): DocumentActionComponent {
  const PublishAction: DocumentActionComponent = (props) => {
    const original = action(props);
    if (!original) return original;

    return {
      ...original,
      label: "Publish",
      title: "Publish this document",
      onHandle: async () => {
        try {
          if (typeof original.onHandle === "function") {
            await Promise.resolve(original.onHandle());
          }
          await new Promise((resolve) => setTimeout(resolve, 1200));
          await triggerStudioDeploy({
            documentId: props.id,
            schemaType: props.type,
          });
        } catch (error) {
          console.error("Publish succeeded but deploy trigger failed", error);
        }
      },
    };
  };

  PublishAction.action = action.action;
  PublishAction.displayName = action.displayName ?? "PublishAction";
  return PublishAction;
}

export function applyDeployActions(
  previousActions: DocumentActionComponent[],
  schemaType: string,
): DocumentActionComponent[] {
  if (!DEPLOYABLE_SCHEMA_TYPES.has(schemaType)) {
    return previousActions;
  }

  return previousActions.map((action) =>
    action.action === "publish" ? wrapPublishWithDeploy(action) : action,
  );
}
