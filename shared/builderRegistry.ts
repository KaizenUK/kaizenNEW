/** Reviewed code shipped with this deployment. Never populated by asset uploads. Keep released IDs immutable. */
export type ConversionRequirements = {
  summary: string;
  fields: string;
  mobile: string;
  behaviour: string;
};
export type SourceRole = "source" | "reference" | "licence";
export type ReviewContract = {
  requirements: ConversionRequirements;
  sources: { hash: string; role: SourceRole }[];
};
export type RegisteredField = {
  key: "text" | "description" | "href" | "src" | "alt";
  label: string;
  type: "text" | "textarea" | "image";
  default: string;
};
export type BlockRegistration = {
  id: string;
  name: string;
  description: string;
  fields: RegisteredField[];
  /** One ordered nested-content slot. Persisted as normal Block[] in props.children. */
  slot?: { label: string };
  review: {
    reviewer: string;
    date: string;
    reference: string;
    notes: string;
    contract: ReviewContract;
  };
};
export const exampleCardRequirements: ConversionRequirements = {
  summary: "Make the sample ExampleCard an editable React card.",
  fields: "Card text.",
  mobile: "Full width on mobile, with the normal responsive layout controls.",
  behaviour: "Static semantic article. No scripts or external services.",
};
export const blockRegistry: readonly BlockRegistration[] = [
  {
    id: "content-panel-v1",
    name: "Content panel",
    description:
      "A semantic section with an editable heading and a nested content area.",
    fields: [
      {
        key: "text",
        label: "Panel heading",
        type: "text",
        default: "Our approach",
      },
    ],
    slot: { label: "Panel content" },
    review: {
      reviewer: "Codex",
      date: "2026-09-11",
      reference: "docs/builder-component-integration.md#content-panel-v1",
      notes:
        "Local semantic React section, escaped heading and builder-rendered children. No external services or browser scripts.",
      contract: {
        requirements: {
          summary:
            "Provide a registered component with nested editable content.",
          fields: "Panel heading and nested blocks.",
          mobile:
            "Normal responsive block controls and full-width nested content.",
          behaviour: "Static section with an h2 heading.",
        },
        sources: [],
      },
    },
  },
  {
    id: "example-card-v1",
    name: "Reviewed example card",
    description:
      "A reviewed adaptation of the bundled ExampleCard source. Demonstration only; no real UI8 conversion is claimed.",
    fields: [
      {
        key: "text",
        label: "Card text",
        type: "textarea",
        default: "Review this code before integration.",
      },
    ],
    review: {
      reviewer: "Codex",
      date: "2026-09-10",
      reference: "docs/builder-component-integration.md#example-card-v1",
      notes:
        "The bundled source was inspected as text and rewritten as a parameterised React article. It has no imports, effects, scripts or external requests. Text is rendered through React escaping. The sample Figma placeholder was not converted.",
      contract: {
        requirements: exampleCardRequirements,
        sources: [
          {
            role: "source",
            hash: "a74faf4605e851f67f9e447a6d817cdff3ae40b096ffd3571a4b633873cf869b",
          },
          {
            role: "licence",
            hash: "5e907d128ba556bf82a93629633132809f607525816d54b00113b332ddc1e6aa",
          },
          {
            role: "licence",
            hash: "5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57",
          },
        ],
      },
    },
  },
];
export function registrationFor(id: unknown) {
  return blockRegistry.find((item) => item.id === id);
}
export function reviewContractKey(contract: ReviewContract): string {
  return JSON.stringify([
    ...(["summary", "fields", "mobile", "behaviour"] as const).map((key) =>
      contract.requirements[key].trim(),
    ),
    contract.sources.map((source) => `${source.role}:${source.hash}`).sort(),
  ]);
}
export function registeredDefaults(id: string): Record<string, any> {
  const registration = registrationFor(id);
  if (!registration)
    throw new Error(
      `Reviewed component ${id} is not installed in this builder.`,
    );
  return {
    registrationId: id,
    ...(registration.slot ? { children: [] } : {}),
    ...Object.fromEntries(
      registration.fields.map((field) => [field.key, field.default]),
    ),
  };
}
export function validateRegisteredProps(props: Record<string, unknown>) {
  const registration = registrationFor(props.registrationId);
  if (!registration)
    throw new Error(
      "This page needs a reviewed React component that is not installed. Ask a developer to deploy its original registration before restoring or publishing it.",
    );
  if (
    props.children !== undefined &&
    (!Array.isArray(props.children) || (!registration.slot && props.children.length > 0))
  )
    throw new Error(
      "This reviewed component does not support the supplied nested content.",
    );
  for (const field of registration.fields)
    if (
      typeof props[field.key] !== "string" ||
      (props[field.key] as string).length > 10_000
    )
      throw new Error(`Invalid ${field.label} in reviewed component.`);
}
