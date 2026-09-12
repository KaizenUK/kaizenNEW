import React, { createContext, useContext } from "react";
import { type Config } from "@puckeditor/core";
import {
  blockTypes,
  freshBlocks,
  type Asset,
  type Block,
  type SharedComponent,
} from "../../shared/visualBuilder";
import { starterBlocks } from "./starters";
import { Blocks, PageFrame, VisualBlock } from "./Renderer";
import { sharedInstance } from "../../shared/builderSite";
import ResponsiveField from "./ResponsiveField";
import RichTextToolbar from "./RichTextToolbar";
import { SharedChoice, InstanceOverrides } from "./SharedFields";
import { builderFormEndpoint } from "./formConfig";
import { CategoryField, ContentBindingField } from "./ContentFields";
import {
  blockRegistry,
  registrationFor,
  registeredDefaults,
} from "../../shared/builderRegistry";
export { default as ResponsiveField } from "./ResponsiveField";
export const LibraryContext = createContext<Asset[]>([]);
export const assetComponentName = (asset: Asset) =>
  `Asset${asset.kind === "icon" ? "Icon" : "Image"}_${asset.id}`;
export function canonicalBlocks(blocks: Block[]): Block[] {
  return blocks.map((item) => ({
    ...item,
    type: String(item.type).startsWith("Reviewed_")
      ? "Registered"
      : String(item.type).startsWith("Shared_")
        ? "Shared"
        : String(item.type).startsWith("AssetIcon_")
          ? "Icon"
          : String(item.type).startsWith("AssetImage_")
            ? "Image"
            : item.type,
    props: {
      ...item.props,
      ...(item.props.children
        ? { children: canonicalBlocks(item.props.children) }
        : {}),
    },
  }));
}
export function configWithAssets(
  assets: Asset[],
  components: SharedComponent[] = [],
): Config {
  const usable = assets.filter(
    (a) => !a.generatedFrom && ["image", "icon"].includes(a.kind),
  );
  return {
    ...builderConfig,
    categories: {
      ...builderConfig.categories,
      reviewed: {
        title: "Reviewed React blocks",
        components: blockRegistry.map((item) => `Reviewed_${item.id}`),
      },
      linked: {
        title: "Shared components",
        visible: components.length > 0,
        components: components.map((item) => `Shared_${item.id}`),
      },
      assets: {
        title: "Imported assets",
        visible: false,
        components: usable.map(assetComponentName),
      },
    },
    components: {
      ...builderConfig.components,
      ...Object.fromEntries(
        blockRegistry.map((item) => [
          `Reviewed_${item.id}`,
          {
            ...builderConfig.components.Registered,
            label: item.name,
            defaultProps: {
              ...builderConfig.components.Registered.defaultProps,
              ...registeredDefaults(item.id),
            },
          },
        ]),
      ),
      ...Object.fromEntries(
        components.map((item) => [
          `Shared_${item.id}`,
          {
            ...builderConfig.components.Shared,
            label: item.name,
            defaultProps: {
              ...builderConfig.components.Shared.defaultProps,
              componentId: item.id,
            },
          },
        ]),
      ),
      ...Object.fromEntries(
        usable.map((asset) => {
          const type = asset.kind === "icon" ? "Icon" : "Image";
          return [
            assetComponentName(asset),
            {
              ...builderConfig.components[type],
              label: asset.name,
              defaultProps: {
                ...builderConfig.components[type].defaultProps,
                src: asset.url,
                alt: asset.name.replace(/\.[^.]+$/, ""),
              },
            },
          ];
        }),
      ),
    },
  };
}
export function insertBlocks(
  content: Block[],
  inserted: Block[],
  target?: string,
): Block[] {
  if (!target) return [...content, ...inserted];
  return content.flatMap((item) => {
    if (item.props.id === target)
      return item.props.children
        ? [
            {
              ...item,
              props: {
                ...item.props,
                children: [...item.props.children, ...inserted],
              },
            },
          ]
        : [item, ...inserted];
    return [
      {
        ...item,
        props: {
          ...item.props,
          ...(item.props.children
            ? { children: insertBlocks(item.props.children, inserted, target) }
            : {}),
        },
      },
    ];
  });
}
function CanvasRoot({ children, theme, site }) {
  return (
    <PageFrame theme={theme}>
      {site?.headerId && (
        <Blocks blocks={[sharedInstance(site.headerId, "site-header")]} />
      )}
      {children}
      {site?.footerId && (
        <Blocks blocks={[sharedInstance(site.footerId, "site-footer")]} />
      )}
    </PageFrame>
  );
}
function AssetField({ value, onChange }) {
  const assets = useContext(LibraryContext).filter(
    (a) => !a.generatedFrom && ["image", "icon"].includes(a.kind),
  );
  return (
    <div className="builder-field">
      <label>
        Image from library
        <select
          value={assets.some((a) => a.url === value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose an uploaded image…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.url}>
              {a.pack} / {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Or image URL
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      </label>
    </div>
  );
}
export const builderConfig: Config = {
  root: {
    fields: {},
    render: ({ children, puck }) => (
      <CanvasRoot theme={puck.metadata.theme} site={puck.metadata.site}>
        {children}
      </CanvasRoot>
    ),
  },
  categories: {
    shared: {
      title: "Shared",
      visible: false,
      components: ["Shared", "Registered"],
    },
    structure: {
      title: "Layout",
      components: ["Section", "Container", "Columns", "Grid"],
    },
    basics: {
      title: "Essentials",
      components: ["Text", "RichText", "Image", "Icon", "Button"],
    },
    interactive: {
      title: "Interactive",
      components: ["Menu", "Accordion", "Tabs", "Video", "ContactForm"],
    },
    content: { title: "Sanity content", components: ["ContentList"] },
    sections: {
      title: "Ready-made sections",
      components: [
        "Navigation",
        "Hero",
        "Features",
        "Gallery",
        "Testimonials",
        "Pricing",
        "CallToAction",
        "Footer",
      ],
    },
  },
  components: Object.fromEntries(
    blockTypes.map((type) => {
      const isContainer = ![
        "Text",
        "RichText",
        "Image",
        "Icon",
        "Button",
        "Menu",
        "Accordion",
        "Tabs",
        "Video",
        "ContactForm",
        "ContentList",
        "Shared",
        "Registered",
      ].includes(type);
      const { id: _, ...defaults } = starterBlocks[type]().props;
      return [
        type,
        {
          label:
            type === "ContentList"
              ? "Post listing"
              : type === "ContactForm"
                ? "Contact form"
                : type === "CallToAction"
                  ? "Call to action"
                  : type === "RichText"
                    ? "Rich text"
                    : type,
          defaultProps: defaults,
          resolveFields: (data, { fields }) => {
            if (type === "Registered") {
              const registration = registrationFor(data.props.registrationId);
              return {
                registration: {
                  type: "custom",
                  render: () => (
                    <p className="builder-help">
                      {registration?.description ||
                        "This reviewed component is not installed."}
                    </p>
                  ),
                },
                ...Object.fromEntries(
                  (registration?.fields || []).map((field) => [
                    field.key,
                    field.type === "image"
                      ? {
                          type: "custom",
                          label: field.label,
                          render: AssetField,
                        }
                      : { type: field.type, label: field.label },
                  ]),
                ),
                ...(registration?.slot
                  ? {
                      children: {
                        type: "slot",
                        label: registration.slot.label,
                      },
                    }
                  : {}),
                style: fields.style,
              };
            }
            if (!data.props.contentBinding) return fields;
            const result = { ...fields };
            for (const key of type === "Text"
              ? ["text"]
              : type === "Image"
                ? ["src", "alt"]
                : ["href"])
              delete result[key];
            return result;
          },
          fields: {
            ...(["Text", "Image", "Button"].includes(type)
              ? {
                  contentBinding: {
                    type: "custom",
                    label: "Sanity content",
                    render: (props) => (
                      <ContentBindingField {...props} type={type} />
                    ),
                  },
                }
              : {}),
            ...(type === "ContentList"
              ? {
                  text: { type: "text", label: "Listing heading" },
                  categoryId: {
                    type: "custom",
                    label: "Post category",
                    render: CategoryField,
                  },
                  sort: {
                    type: "select",
                    label: "Post order",
                    options: [
                      { label: "Newest first", value: "newest" },
                      { label: "Oldest first", value: "oldest" },
                      { label: "Title A–Z", value: "title" },
                    ],
                  },
                  limit: {
                    type: "number",
                    label: "Number of posts",
                    min: 1,
                    max: 24,
                  },
                  variant: {
                    type: "select",
                    label: "Card style",
                    options: [
                      { label: "Cards", value: "cards" },
                      { label: "Minimal", value: "minimal" },
                      { label: "Editorial list", value: "list" },
                    ],
                  },
                  ...Object.fromEntries(
                    [
                      ["showImages", "Post images"],
                      ["showExcerpts", "Post summaries"],
                      ["showDates", "Publication dates"],
                      ["showAuthors", "Author names"],
                    ].map(([key, label]) => [
                      key,
                      {
                        type: "radio",
                        label,
                        options: [
                          { label: "Show", value: "yes" },
                          { label: "Hide", value: "no" },
                        ],
                      },
                    ]),
                  ),
                  linkLabel: { type: "text", label: "Article link text" },
                  emptyText: { type: "text", label: "Empty listing message" },
                }
              : {}),
            ...(type === "ContactForm"
              ? {
                  delivery: {
                    type: "custom",
                    label: "Message delivery",
                    render: () => (
                      <p className="builder-help">
                        {builderFormEndpoint === "/__builder-contact"
                          ? "Local test receiver: messages stay in this development workspace. No email is sent."
                          : builderFormEndpoint
                            ? "Connected to the configured contact service. Test delivery after deploying."
                            : "Delivery needs connecting before visitors can send messages. Configure the contact service for this site."}
                      </p>
                    ),
                  },
                  text: { type: "text", label: "Heading" },
                  description: { type: "textarea", label: "Introduction" },
                  label: { type: "text", label: "Accessible name" },
                  submitLabel: { type: "text", label: "Button text" },
                  successMessage: {
                    type: "textarea",
                    label: "Success message",
                  },
                  ...Object.fromEntries(
                    [
                      ["showSurname", "Last name"],
                      ["showPhone", "Phone"],
                      ["showWebsite", "Website"],
                      ["showMarketing", "Marketing opt-in"],
                    ].map(([key, label]) => [
                      key,
                      {
                        type: "radio",
                        label,
                        options: [
                          { label: "Show", value: "yes" },
                          { label: "Hide", value: "no" },
                        ],
                      },
                    ]),
                  ),
                  privacyText: { type: "textarea", label: "Privacy notice" },
                  privacyUrl: { type: "text", label: "Privacy policy link" },
                  marketingText: {
                    type: "textarea",
                    label: "Marketing opt-in wording",
                  },
                }
              : {}),
            ...(type === "Shared"
              ? {
                  componentId: {
                    type: "custom",
                    label: "Shared component",
                    render: SharedChoice,
                  },
                  overrides: {
                    type: "custom",
                    label: "Instance overrides",
                    render: InstanceOverrides,
                  },
                }
              : {}),
            ...(["Menu", "Tabs", "Video"].includes(type)
              ? { label: { type: "text", label: "Accessible name" } }
              : {}),
            ...(type === "Menu"
              ? {
                  text: { type: "text", label: "Brand name" },
                  href: { type: "text", label: "Brand link" },
                  links: {
                    type: "array",
                    label: "Navigation links",
                    max: 20,
                    getItemSummary: (item) => item.label || "Link",
                    defaultItemProps: { label: "New link", href: "/" },
                    arrayFields: {
                      label: { type: "text", label: "Label" },
                      href: { type: "text", label: "Link" },
                    },
                  },
                }
              : {}),
            ...(["Tabs", "Accordion"].includes(type)
              ? {
                  items: {
                    type: "array",
                    label: type === "Tabs" ? "Tabs" : "Questions & answers",
                    max: 30,
                    getItemSummary: (item) => item.title || "Item",
                    defaultItemProps: {
                      title: "New item",
                      content: "Add your content here.",
                    },
                    arrayFields: {
                      title: { type: "text", label: "Title" },
                      content: { type: "textarea", label: "Content" },
                    },
                  },
                }
              : {}),
            ...(type === "Video"
              ? {
                  src: { type: "text", label: "Video URL (MP4 or WebM)" },
                  poster: {
                    type: "custom",
                    label: "Poster image",
                    render: AssetField,
                  },
                  text: { type: "textarea", label: "Caption or transcript" },
                  captions: { type: "text", label: "Captions URL (WebVTT)" },
                  captionLanguage: {
                    type: "text",
                    label: "Captions language (e.g. en)",
                  },
                }
              : {}),
            ...(type === "RichText"
              ? {
                  html: {
                    type: "richtext",
                    label: "Rich text",
                    contentEditable: true,
                    renderMenu: (props) => <RichTextToolbar {...props} />,
                    options: {
                      link: {
                        openOnClick: false,
                        HTMLAttributes: { target: null, rel: null },
                      },
                    },
                  },
                }
              : {}),
            ...(type === "Text"
              ? {
                  tag: {
                    type: "select",
                    label: "Text role",
                    options: [
                      { label: "Paragraph", value: "p" },
                      { label: "Main heading (H1)", value: "h1" },
                      { label: "Section heading (H2)", value: "h2" },
                      { label: "Subheading (H3)", value: "h3" },
                    ],
                  },
                }
              : {}),
            ...(type === "Text" || type === "Button"
              ? {
                  text: {
                    type: "textarea",
                    label: "Text",
                    contentEditable: true,
                  },
                }
              : {}),
            ...(type === "Button"
              ? { href: { type: "text", label: "Link" } }
              : {}),
            ...(["Image", "Icon"].includes(type)
              ? {
                  src: { type: "custom", label: "Image", render: AssetField },
                  alt: { type: "text", label: "Image description (alt text)" },
                }
              : {}),
            // Puck needs slots in the structural field map before resolveFields runs.
            // The selected registration controls whether this slot is exposed.
            ...(isContainer || type === "Registered"
              ? { children: { type: "slot" } }
              : {}),
            style: {
              type: "custom",
              label: "Layout & appearance",
              render: (props) => (
                <ResponsiveField
                  {...props}
                  AssetInput={AssetField}
                  blockType={type}
                />
              ),
            },
          },
          resolveData: (data, { trigger }) =>
            trigger === "insert" && data.props.children
              ? {
                  props: {
                    ...data.props,
                    children: freshBlocks(data.props.children),
                  },
                }
              : data,
          render: ({ children: Children, ...props }) => (
            <VisualBlock
              block={{ type, props } as Block}
              inline={
                type === "Text"
                  ? props.text
                  : type === "RichText"
                    ? props.html
                    : undefined
              }
            >
              {(isContainer || type === "Registered") && Children && (
                <Children
                  style={{
                    display: "grid",
                    gridTemplateColumns: "inherit",
                    gap: "inherit",
                    rowGap: "inherit",
                    columnGap: "inherit",
                    alignItems: "inherit",
                    justifyItems: "inherit",
                    gridColumn: "1 / -1",
                  }}
                />
              )}
            </VisualBlock>
          ),
        },
      ];
    }),
  ),
};
