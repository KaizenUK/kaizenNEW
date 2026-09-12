import React, { useContext, type CSSProperties, type ReactNode } from "react";
import { MediaContext } from "./MediaContext";
import {
  safeUrl,
  resolveResponsiveStyle,
  tokenGroupForStyle,
  type Block,
  type PageDocument,
  type ResponsiveStyle,
  type StyleValues,
  type Theme,
} from "../../shared/visualBuilder";
import "./page.css";
import RichText from "./RichText";
import InteractiveBlock from "./InteractiveBlocks";
import ContentListBlock from "./ContentListBlock";
import { ContentContext } from "./ContentContext";
import { bindContentBlock } from "../../shared/builderContent";
import { SiteContext } from "./SiteContext";
import { resolveShared } from "../../shared/builderSite";
import { ImageContext } from "./ImageContext";
import { imageForBlock, imageStyle } from "../../shared/builderImages";
import RegisteredBlock from "./RegisteredBlocks";

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
  ...(Object.fromEntries(
    ["Top", "Right", "Bottom", "Left"].flatMap((side) => [
      [`padding${side}`, [0, 240, "px"]],
      [`margin${side}`, [-200, 200, "px"]],
    ]),
  ) as Record<string, [number, number, string]>),
  rowGap: [0, 160, "px"],
  columnGap: [0, 160, "px"],
  columnSpan: [1, 6, ""],
  order: [-100, 100, ""],
  width: [1, 100, "%"],
  height: [0, 1800, "px"],
  fontWeight: [100, 900, ""],
  lineHeight: [0.8, 3, ""],
  letterSpacing: [-5, 20, "px"],
  focalX: [0, 100, "%"],
  focalY: [0, 100, "%"],
  overlayOpacity: [0, 100, "%"],
};
export const safeColor = (s: unknown, fallback = "transparent") =>
  typeof s === "string" && /^(#[0-9a-f]{3,8}|transparent|white|black)$/i.test(s)
    ? s
    : fallback;
export const safeFont = (s: unknown) =>
  typeof s === "string" && /^[a-zA-Z0-9 ,'-]{1,120}$/.test(s)
    ? s
    : "system-ui, sans-serif";
export function styleVars(style: ResponsiveStyle = {}): CSSProperties {
  const result: Record<string, string | number> = {};
  for (const device of ["desktop", "tablet", "mobile"] as const) {
    const values = resolveResponsiveStyle(style, device);
    const prefix = device[0];
    // Fill grid tracks without overflowing when independent side margins are used.
    // width:auto combined with auto margins shrinks nested headers to their text width.
    const sideMargin = (key: "marginLeft" | "marginRight") => {
      const token = values.tokens?.[key];
      if (token && /^[a-z][\w-]{0,40}$/.test(token))
        return `var(--kb-token-spacing-${token}, 0px)`;
      const value = values[key];
      return `${typeof value === "number" && Number.isFinite(value) ? Math.max(-200, Math.min(200, value)) : 0}px`;
    };
    result[`--${prefix}-width`] =
      `calc(100% - ${sideMargin("marginLeft")} - ${sideMargin("marginRight")})`;
    result[`--${prefix}-columnWidths`] =
      "repeat(var(--v-columns), minmax(0, 1fr))";
    for (const [key, value] of Object.entries(values as StyleValues)) {
      const name = `--${prefix}-${key}`;
      if (numbers[key] && Number.isFinite(value)) {
        const [min, max, unit] = numbers[key];
        result[name] = `${Math.max(min, Math.min(max, Number(value)))}${unit}`;
      } else if (
        [
          "background",
          "color",
          "borderColor",
          "overlayColor",
          "hoverBackground",
          "hoverColor",
          "focusColor",
        ].includes(key)
      )
        result[name] = safeColor(value);
      else if (
        key === "columnWidths" &&
        typeof value === "string" &&
        /^\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?){0,5}$/.test(value.trim())
      ) {
        const widths = value.trim().split(/\s+/).map(Number);
        if (widths.every((n) => n > 0 && n <= 100))
          result[name] = widths.map((n) => `minmax(0, ${n}fr)`).join(" ");
      } else if (
        key === "aspectRatio" &&
        typeof value === "string" &&
        (value === "auto" ||
          (/^\d+(?:\.\d+)? \/ \d+(?:\.\d+)?$/.test(value) &&
            value
              .split(" / ")
              .every(
                (number) => Number(number) > 0 && Number(number) <= 100_000,
              )))
      )
        result[name] = String(value);
      else if (
        key === "objectFit" &&
        ["cover", "contain", "fill", "scale-down"].includes(String(value))
      )
        result[name] = String(value);
      else if (
        ["alignItems", "justifyItems"].includes(key) &&
        ["start", "center", "end", "stretch"].includes(String(value))
      )
        result[name] = String(value);
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
    for (const [key, token] of Object.entries(values.tokens || {})) {
      const group = tokenGroupForStyle(key);
      if (group && /^[a-z][\w-]{0,40}$/.test(token))
        result[`--${prefix}-${key}`] =
          `var(--kb-token-${group}-${token}, ${group === "colors" ? "transparent" : group === "fontFamily" ? "inherit" : group === "lineHeight" ? "1.5" : "0px"})`;
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
  const media = useContext(MediaContext);
  const fontUrl = safeUrl(media(theme.fontUrl), true);
  const tokens: Record<string, string> = {};
  for (const [group, values] of Object.entries(theme.tokens || {}))
    for (const [name, value] of Object.entries(values)) {
      if (!/^[a-z][\w-]{0,40}$/.test(name)) continue;
      const key = `--kb-token-${group}-${name}`;
      if (group === "colors") tokens[key] = safeColor(value);
      else if (group === "fontFamily") tokens[key] = safeFont(value);
      else if (
        ["spacing", "fontSize", "lineHeight"].includes(group) &&
        typeof value === "number" &&
        Number.isFinite(value)
      )
        tokens[key] =
          `${Math.max(0, Math.min(group === "lineHeight" ? 3 : 240, value))}${group === "lineHeight" ? "" : "px"}`;
    }
  return (
    <div
      className="kb-page"
      style={
        {
          ...tokens,
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
  const content = useContext(ContentContext);
  const media = useContext(MediaContext);
  const images = useContext(ImageContext);
  let contentError = "";
  if (block.props.contentBinding) {
    inline = undefined;
    try {
      if (!content.catalogue)
        throw new Error(
          content.error || "Load the linked Sanity post in settings.",
        );
      block = bindContentBlock(block, content.catalogue);
    } catch (error) {
      contentError = (error as Error).message;
    }
  }
  const image = media(imageForBlock(block, images));
  const styles = media(imageStyle(block, images));
  block = media(block);
  const { type, props } = block;
  const site = useContext(SiteContext);
  const common = {
    className: `kb-block kb-${type.toLowerCase()}`,
    style: styleVars(styles),
    "data-block-id": props.id,
  };
  if (contentError)
    return (
      <div {...common}>
        <div className="kb-placeholder">{contentError}</div>
      </div>
    );
  if (type === "ContentList")
    return (
      <div {...common}>
        <ContentListBlock block={block} />
      </div>
    );
  if (type === "Registered")
    return (
      <div
        {...common}
        data-kaizen-block={props.registrationId}
        data-kaizen-block-id={props.id}
      >
        <RegisteredBlock block={block}>
          {children ?? <Blocks blocks={props.children || []} />}
        </RegisteredBlock>
      </div>
    );
  if (type === "Shared") {
    try {
      if (!site) throw new Error("Choose a shared component from Site design.");
      return <Blocks blocks={[resolveShared(block, site)]} />;
    } catch (error) {
      return (
        <div {...common} className="kb-placeholder">
          {(error as Error).message}
        </div>
      );
    }
  }
  if (["Menu", "Accordion", "Tabs", "Video", "ContactForm"].includes(type))
    return (
      <div {...common}>
        <InteractiveBlock block={block} />
      </div>
    );
  if (type === "RichText")
    return (
      <div {...common}>
        <div className="kb-rich-content">
          {inline !== undefined && typeof inline !== "string" ? (
            inline
          ) : (
            <RichText html={inline ?? props.html} />
          )}
        </div>
      </div>
    );
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
            srcSet={
              image?.variants.length
                ? [...image.variants]
                    .sort((a, b) => a.width - b.width)
                    .map((variant) => `${variant.url} ${variant.width}w`)
                    .join(", ")
                : undefined
            }
            sizes={image?.variants.length ? "auto, 100vw" : undefined}
            width={image?.width}
            height={image?.height}
            alt={props.alt || ""}
            loading="lazy"
            decoding="async"
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
export function Blocks({ blocks }: { blocks: Block[] }) {
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
