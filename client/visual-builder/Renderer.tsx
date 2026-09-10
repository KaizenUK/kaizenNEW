import React, { type CSSProperties, type ReactNode } from "react";
import {
  safeUrl,
  type Block,
  type PageDocument,
  type ResponsiveStyle,
  type StyleValues,
  type Theme,
} from "../../shared/visualBuilder";
import "./page.css";

const numbers: Record<string, [number, number, string]> = {
  padding: [0, 240, "px"],
  gap: [0, 160, "px"],
  columns: [1, 6, ""],
  fontSize: [8, 180, "px"],
  maxWidth: [0, 2400, "px"],
  minHeight: [0, 1800, "px"],
  radius: [0, 200, "px"],
  borderWidth: [0, 20, "px"],
  margin: [0, 200, "px"],
};
export const safeColor = (s: unknown, fallback = "transparent") =>
  typeof s === "string" && /^(#[0-9a-f]{3,8}|transparent|white|black)$/i.test(s)
    ? s
    : fallback;
export const safeFont = (s: unknown) =>
  typeof s === "string" && /^[a-zA-Z0-9 ,'-]{1,120}$/.test(s)
    ? s
    : "system-ui, sans-serif";
function styleVars(style: ResponsiveStyle = {}): CSSProperties {
  const result: Record<string, string | number> = {};
  for (const [device, values] of Object.entries(style)) {
    if (!["desktop", "tablet", "mobile"].includes(device) || !values) continue;
    const prefix = device[0];
    for (const [key, value] of Object.entries(values as StyleValues)) {
      const name = `--${prefix}-${key}`;
      if (numbers[key] && Number.isFinite(value)) {
        const [min, max, unit] = numbers[key];
        result[name] = `${Math.max(min, Math.min(max, Number(value)))}${unit}`;
      } else if (["background", "color", "borderColor"].includes(key))
        result[name] = safeColor(value);
      else if (
        key === "align" &&
        ["left", "center", "right"].includes(String(value))
      )
        result[name] = String(value);
      else if (key === "fontFamily") result[name] = safeFont(value);
      else if (key === "shadow")
        result[name] =
          value === "soft"
            ? "0 14px 40px #18242118"
            : value === "strong"
              ? "0 20px 60px #18242138"
              : "none";
      else if (key === "hidden") result[name] = value ? "none" : "grid";
      else if (key === "backgroundImage") {
        const url = safeUrl(value, true);
        if (url) result[name] = `url("${url.replace(/["()<>]/g, "")}")`;
        else result[name] = "none";
      }
    }
  }
  return result as CSSProperties;
}
export function PageFrame({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  const fontUrl = safeUrl(theme.fontUrl, true);
  return (
    <div
      className="kb-page"
      style={
        {
          "--kb-accent": safeColor(theme.accent, "#d5f86b"),
          "--kb-radius": `${Math.max(0, Math.min(100, theme.radius || 0))}px`,
          background: safeColor(theme.background, "#f7f8f2"),
          color: safeColor(theme.color, "#182421"),
          fontFamily: safeFont(theme.fontFamily),
        } as CSSProperties
      }
    >
      {fontUrl && (
        <style>{`@font-face{font-family:'BuilderFont';src:url('${fontUrl.replace(/['()<>]/g, "")}');font-display:swap;}`}</style>
      )}
      {children}
    </div>
  );
}
export function VisualBlock({
  block,
  children,
  inline,
}: {
  block: Block;
  children?: ReactNode;
  inline?: ReactNode;
}) {
  const { type, props } = block;
  const common = {
    className: `kb-block kb-${type.toLowerCase()}`,
    style: styleVars(props.style),
    "data-block-id": props.id,
  };
  if (type === "Text") {
    const TextTag = (
      ["h1", "h2", "h3", "p"].includes(String(props.tag)) ? props.tag : "p"
    ) as "h1" | "h2" | "h3" | "p";
    return (
      <div {...common}>
        <TextTag
          style={{
            fontSize: "inherit",
            fontWeight: "inherit",
            lineHeight: "inherit",
            margin: 0,
          }}
        >
          {inline ?? props.text}
        </TextTag>
      </div>
    );
  }
  if (type === "Image" || type === "Icon")
    return (
      <figure {...common}>
        {safeUrl(props.src, true) ? (
          <img
            src={safeUrl(props.src, true)}
            alt={props.alt || ""}
            loading="lazy"
          />
        ) : (
          <div className="kb-placeholder">
            Choose an image from your library
          </div>
        )}
      </figure>
    );
  if (type === "Button")
    return (
      <div {...common}>
        <a href={safeUrl(props.href) || "#"}>{props.text || "Learn more"}</a>
      </div>
    );
  const Tag =
    type === "Navigation" ? "nav" : type === "Footer" ? "footer" : "section";
  return <Tag {...common}>{children}</Tag>;
}
function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => (
        <VisualBlock key={block.props.id} block={block}>
          {block.props.children && <Blocks blocks={block.props.children} />}
        </VisualBlock>
      ))}
    </>
  );
}
/** No Puck import or hydration: Astro renders these React components to static HTML. */
export default function PublishedPage({
  document,
}: {
  document: PageDocument;
}) {
  return (
    <PageFrame theme={document.theme}>
      <Blocks blocks={document.data.content} />
    </PageFrame>
  );
}
