import React, { createContext, useContext, useState } from "react";
import { type Config } from "@puckeditor/core";
import {
  blockTypes,
  freshBlocks,
  type Asset,
  type Block,
  type Device,
  type ResponsiveStyle,
  type StyleValues,
} from "../../shared/visualBuilder";
import { starterBlocks } from "./starters";
import { PageFrame, VisualBlock } from "./Renderer";
export const LibraryContext = createContext<Asset[]>([]);
export const assetComponentName = (asset: Asset) =>
  `Asset${asset.kind === "icon" ? "Icon" : "Image"}_${asset.id}`;
export function canonicalBlocks(blocks: Block[]): Block[] {
  return blocks.map((item) => ({
    ...item,
    type: String(item.type).startsWith("AssetIcon_")
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
export function configWithAssets(assets: Asset[]): Config {
  const usable = assets.filter((a) => ["image", "icon"].includes(a.kind));
  return {
    ...builderConfig,
    categories: {
      ...builderConfig.categories,
      assets: {
        title: "Imported assets",
        visible: false,
        components: usable.map(assetComponentName),
      },
    },
    components: {
      ...builderConfig.components,
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
function CanvasRoot({ children, theme }) {
  return <PageFrame theme={theme}>{children}</PageFrame>;
}
function AssetField({ value, onChange }) {
  const assets = useContext(LibraryContext).filter((a) =>
    ["image", "icon"].includes(a.kind),
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
const sizes = [
  ["padding", "Padding", 0, 240],
  ["margin", "Outside spacing", 0, 200],
  ["gap", "Gap", 0, 160],
  ["columns", "Columns", 1, 6],
  ["fontSize", "Text size", 8, 180],
  ["maxWidth", "Maximum width", 0, 2400],
  ["minHeight", "Minimum height", 0, 1800],
  ["radius", "Rounded corners", 0, 200],
  ["borderWidth", "Border width", 0, 20],
] as const;
export function ResponsiveField({
  value = {},
  onChange,
}: {
  value?: ResponsiveStyle;
  onChange: (value: ResponsiveStyle) => void;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const current = value[device] || {};
  const inherited = {
    ...(value.desktop || {}),
    ...(device === "mobile" ? value.tablet || {} : {}),
  };
  const update = (key: keyof StyleValues, v: unknown) => {
    const values = { ...current, [key]: v };
    if (v === undefined) delete values[key];
    onChange({ ...value, [device]: values });
  };
  return (
    <div className="builder-field">
      <div className="builder-tabs">
        {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
          <button
            type="button"
            key={d}
            aria-pressed={device === d}
            onClick={() => setDevice(d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
      <p className="builder-hint">
        {device === "desktop"
          ? "Base styles apply to all screen sizes."
          : `Only changes here override ${device === "mobile" ? "tablet and desktop" : "desktop"}. Empty controls inherit.`}
      </p>
      <div className="builder-control-grid">
        {sizes.map(([key, label, min, max]) => (
          <label key={key}>
            {label}
            <input
              aria-label={`${device} ${label}`}
              type="number"
              min={min}
              max={max}
              placeholder={String(inherited[key] ?? "Auto")}
              value={current[key] ?? ""}
              onChange={(e) =>
                update(
                  key,
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </label>
        ))}
      </div>
      {(["background", "color", "borderColor"] as const).map((key) => (
        <label key={key}>
          {key === "background"
            ? "Background"
            : key === "color"
              ? "Text colour"
              : "Border colour"}
          <div className="builder-color">
            <input
              aria-label={`${device} ${key} picker`}
              type="color"
              value={
                /^#[0-9a-f]{6}$/i.test(current[key] || inherited[key] || "")
                  ? current[key] || inherited[key]
                  : "#ffffff"
              }
              onChange={(e) => update(key, e.target.value)}
            />
            <input
              aria-label={`${device} ${key}`}
              placeholder={inherited[key] || "Inherit"}
              value={current[key] || ""}
              onChange={(e) => update(key, e.target.value || undefined)}
            />
          </div>
        </label>
      ))}
      <label>
        Alignment
        <select
          value={current.align || ""}
          onChange={(e) => update("align", e.target.value || undefined)}
        >
          <option value="">Inherit</option>
          {["left", "center", "right"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Shadow
        <select
          value={current.shadow || ""}
          onChange={(e) => update("shadow", e.target.value || undefined)}
        >
          <option value="">Inherit</option>
          {["none", "soft", "strong"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Background image
        <AssetField
          value={current.backgroundImage || ""}
          onChange={(v) => update("backgroundImage", v || undefined)}
        />
      </label>
      <label>
        Visibility
        <select
          value={current.hidden === undefined ? "" : String(current.hidden)}
          onChange={(e) =>
            update(
              "hidden",
              e.target.value === "" ? undefined : e.target.value === "true",
            )
          }
        >
          <option value="">Inherit</option>
          <option value="false">Visible</option>
          <option value="true">Hidden</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          const result = { ...value };
          delete result[device];
          onChange(result);
        }}
      >
        Reset {device} styles
      </button>
    </div>
  );
}
export const builderConfig: Config = {
  root: {
    fields: {},
    render: ({ children, puck }) => (
      <CanvasRoot theme={puck.metadata.theme}>{children}</CanvasRoot>
    ),
  },
  categories: {
    structure: {
      title: "Layout",
      components: ["Section", "Container", "Columns", "Grid"],
    },
    basics: {
      title: "Essentials",
      components: ["Text", "Image", "Icon", "Button"],
    },
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
      const isContainer = !["Text", "Image", "Icon", "Button"].includes(type);
      const { id: _, ...defaults } = starterBlocks[type]().props;
      return [
        type,
        {
          label: type === "CallToAction" ? "Call to action" : type,
          defaultProps: defaults,
          fields: {
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
            ...(isContainer ? { children: { type: "slot" } } : {}),
            style: {
              type: "custom",
              label: "Layout & appearance",
              render: ResponsiveField,
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
              inline={type === "Text" ? props.text : undefined}
            >
              {isContainer && Children && (
                <Children
                  style={{
                    display: "grid",
                    gridTemplateColumns: "inherit",
                    gap: "inherit",
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
