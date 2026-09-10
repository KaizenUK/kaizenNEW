// Keep responsive property fallbacks and non-inheriting block variables consistent.
// Run after changing this map; the generated CSS is shared by preview, Astro and exports.
import { readFileSync, writeFileSync } from "node:fs";
const target = new URL("../client/visual-builder/page.css", import.meta.url);
const defaults = {
  paddingTop: "var(--v-padding)",
  paddingRight: "var(--v-padding)",
  paddingBottom: "var(--v-padding)",
  paddingLeft: "var(--v-padding)",
  marginTop: "var(--v-margin)",
  marginRight: "auto",
  marginBottom: "var(--v-margin)",
  marginLeft: "auto",
  rowGap: "var(--v-gap)",
  columnGap: "var(--v-gap)",
  columnWidths: "repeat(var(--v-columns), minmax(0, 1fr))",
  columnSpan: "1",
  order: "0",
  alignItems: "stretch",
  justifyItems: "stretch",
  width: "auto",
  height: "auto",
  fontWeight: "inherit",
  lineHeight: "1.2",
  letterSpacing: "-0.025em",
  objectFit: "cover",
  focalX: "50%",
  focalY: "50%",
  aspectRatio: "auto",
  overlayColor: "black",
  overlayOpacity: "0%",
  hoverBackground: "var(--v-background)",
  hoverColor: "var(--v-color)",
  focusColor: "#5a7f26",
};
const marker =
  "/* Generated responsive controls: scripts/generate-builder-style-css.mjs */";
let css =
  readFileSync(target, "utf8").split(marker)[0].trimEnd() +
  "\n\n" +
  marker +
  "\n";
for (const [index, prefix] of ["d", "t", "m"].entries()) {
  const media =
    index === 1
      ? "@media (max-width: 1023px) {\n"
      : index === 2
        ? "@media (max-width: 639px) {\n"
        : "";
  css += media + ".kb-page .kb-block {\n";
  for (const [key, fallback] of Object.entries(defaults)) {
    let value = fallback;
    for (const p of ["d", "t", "m"].slice(0, index + 1))
      value = `var(--${p}-${key}, ${value})`;
    css += `  --v-${key}: ${value};\n`;
  }
  css += "}\n" + (media ? "}\n" : "");
}
css += ".kb-page .kb-block {\n";
for (const prefix of ["d", "t", "m"])
  for (const key of Object.keys(defaults))
    css += `  --${prefix}-${key}: initial;\n`;
css += `
  padding: var(--v-paddingTop) var(--v-paddingRight) var(--v-paddingBottom) var(--v-paddingLeft);
  margin: var(--v-marginTop) var(--v-marginRight) var(--v-marginBottom) var(--v-marginLeft);
  width: var(--v-width);
  height: var(--v-height);
  grid-template-columns: var(--v-columnWidths);
  grid-column: span var(--v-columnSpan);
  order: var(--v-order);
  row-gap: var(--v-rowGap);
  column-gap: var(--v-columnGap);
  align-items: var(--v-alignItems);
  justify-items: var(--v-justifyItems);
  background-position: var(--v-focalX) var(--v-focalY);
  isolation: isolate;
}
.kb-page .kb-block::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--v-overlayColor);
  opacity: var(--v-overlayOpacity);
  pointer-events: none;
}
.kb-page .kb-text {
  font-weight: var(--v-fontWeight);
  line-height: var(--v-lineHeight, 1.2);
  letter-spacing: var(--v-letterSpacing, -0.025em);
}
.kb-page .kb-image img, .kb-page .kb-icon img {
  object-fit: var(--v-objectFit);
  object-position: var(--v-focalX) var(--v-focalY);
  aspect-ratio: var(--v-aspectRatio);
  height: var(--v-height);
}
.kb-page .kb-block:hover {
  background-color: var(--v-hoverBackground);
  color: var(--v-hoverColor);
}
.kb-page .kb-button:focus-within {
  outline: 2px solid var(--v-focusColor);
  outline-offset: 3px;
}
.kb-page .kb-button a:hover, .kb-page .kb-button a:focus-visible {
  background-color: var(--v-buttonHoverBackground);
  color: var(--v-buttonHoverColor);
}
.kb-page .kb-button a {
  background-color: var(--v-buttonBackground);
  color: var(--v-buttonColor);
  border-radius: var(--v-buttonRadius);
}
`;
for (const index of [0, 1, 2]) {
  const media =
    index === 1
      ? "@media (max-width: 1023px) {"
      : index === 2
        ? "@media (max-width: 639px) {"
        : "";
  css += `${media}\n.kb-page .kb-button {\n`;
  for (const [alias, key, fallback] of [
    ["buttonBackground", "background", "var(--kb-accent)"],
    ["buttonColor", "color", "#182421"],
    ["buttonRadius", "radius", "var(--kb-radius)"],
    ["buttonHoverBackground", "hoverBackground", "var(--v-buttonBackground)"],
    ["buttonHoverColor", "hoverColor", "var(--v-buttonColor)"],
  ]) {
    let value = fallback;
    for (const p of ["d", "t", "m"].slice(0, index + 1)) value = `var(--${p}-${key}, ${value})`;
    css += `  --v-${alias}: ${value};\n`;
  }
  css += `}\n${media ? "}" : ""}\n`;
}
writeFileSync(target, css);
