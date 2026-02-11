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

export const deployNowAction: DocumentActionComponent = (props) => ({
  label: "Deploy Now",
  title: "Trigger a production deployment now",
  onHandle: async () => {
    try {
      await triggerStudioDeploy({
        documentId: props.id,
        schemaType: props.type,
      });
    } catch (error) {
      console.error("Manual deploy trigger failed", error);
      if (typeof window !== "undefined") {
        window.alert(
          "Deploy trigger failed. Check /api/deploy server env vars and GitHub Actions permissions.",
        );
      }
    } finally {
      props.onComplete();
    }
  },
});

deployNowAction.displayName = "DeployNowAction";

export function wrapPublishWithDeploy(
  action: DocumentActionComponent,
): DocumentActionComponent {
  const PublishAndDeployAction: DocumentActionComponent = (props) => {
    const original = action(props);
    if (!original) return original;

    return {
      ...original,
      label: "Publish + Deploy",
      title: "Publish this document and trigger a production deployment",
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
          if (typeof window !== "undefined") {
            window.alert(
              "Published, but deploy trigger failed. Use the 'Deploy Live' button to retry.",
            );
          }
        }
      },
    };
  };

  PublishAndDeployAction.action = action.action;
  PublishAndDeployAction.displayName =
    action.displayName ?? "PublishAndDeployAction";
  return PublishAndDeployAction;
}

export function applyDeployActions(
  previousActions: DocumentActionComponent[],
  schemaType: string,
): DocumentActionComponent[] {
  if (!DEPLOYABLE_SCHEMA_TYPES.has(schemaType)) {
    return previousActions;
  }

  const withPublishWrapped = previousActions.map((action) =>
    action.action === "publish" ? wrapPublishWithDeploy(action) : action,
  );

  if (
    withPublishWrapped.some(
      (action) => action.displayName === deployNowAction.displayName,
    )
  ) {
    return withPublishWrapped;
  }

  return [deployNowAction, ...withPublishWrapped];
}
