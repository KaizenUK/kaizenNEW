import React from "react";
import {
  registrationFor,
  validateRegisteredProps,
} from "../../shared/builderRegistry";
import type { Block } from "../../shared/visualBuilder";

// Reviewed adaptations are compiled here, never imported from an uploaded asset URL.
function ExampleCard({ text }: { text: string }) {
  return (
    <article className="kb-reviewed-card">
      <p>{text}</p>
    </article>
  );
}
export const registeredRenderers: Record<string, React.ComponentType<any>> = {
  "example-card-v1": ExampleCard,
};
export default function RegisteredBlock({ block }: { block: Block }) {
  const registration = registrationFor(block.props.registrationId);
  validateRegisteredProps(block.props);
  const Component = registration && registeredRenderers[registration.id];
  if (!Component)
    throw new Error(
      "The reviewed component implementation is missing from this deployment.",
    );
  return <Component {...block.props} />;
}
