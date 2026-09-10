import React, { useContext, type ComponentType } from "react";
import { usePuck } from "@puckeditor/core";
import {
  resolveResponsiveStyle,
  tokenGroupForStyle,
  type Device,
  type ResponsiveStyle,
  type StyleValues,
} from "../../shared/visualBuilder";
import { ThemeTokensContext } from "./SiteContext";

type NumericControl = [keyof StyleValues, string, number, number, number?];
const layout: NumericControl[] = [
  ["columns", "Columns", 1, 6],
  ["columnSpan", "Columns to span", 1, 6],
  ["rowGap", "Row gap", 0, 160],
  ["columnGap", "Column gap", 0, 160],
  ["order", "Display order", -100, 100],
  ["width", "Width (%)", 1, 100],
  ["maxWidth", "Maximum width", 0, 2400],
  ["minHeight", "Minimum height", 0, 1800],
  ["height", "Height", 0, 1800],
];
const typography: NumericControl[] = [
  ["fontSize", "Text size", 8, 180],
  ["fontWeight", "Weight", 100, 900, 100],
  ["lineHeight", "Line height", 0.8, 3, 0.1],
  ["letterSpacing", "Letter spacing", -5, 20, 0.1],
];
const devices = { desktop: 1280, tablet: 768, mobile: 390 };
export default function ResponsiveField({
  value = {},
  onChange,
  AssetInput,
  blockType,
}: {
  value?: ResponsiveStyle;
  onChange: (value: ResponsiveStyle, ui?: { field: { focus: string } }) => void;
  AssetInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
  }>;
  blockType: string;
}) {
  const { appState, dispatch } = usePuck();
  const themeTokens = useContext(ThemeTokensContext);
  const width = Number(appState.ui.viewports.current.width);
  const device: Device =
    width <= 639 ? "mobile" : width <= 1023 ? "tablet" : "desktop";
  const current = value[device] || {};
  const effective = resolveResponsiveStyle(value, device);
  const isMedia = ["Image", "Icon"].includes(blockType);
  const isLayout = !["Text", "RichText", "Button", "Image", "Icon"].includes(
    blockType,
  );
  const update = (key: keyof StyleValues, v: unknown) => {
    const next = { ...current, [key]: v, tokens: { ...current.tokens } };
    delete next.tokens[key];
    if (v === undefined) delete next[key];
    onChange(
      { ...value, [device]: next },
      { field: { focus: `builder-style:${device}:${key}` } },
    );
  };
  function status(key: keyof StyleValues) {
    return (
      <span className="builder-control-source">
        {effective.tokens?.[key]
          ? `Shared token: ${effective.tokens[key]}`
          : current[key] !== undefined
            ? device === "desktop"
              ? "Base value"
              : "Override"
            : effective[key] !== undefined
              ? `Inherited: ${effective[key]}`
              : "Default"}
      </span>
    );
  }
  function reset(key: keyof StyleValues, label: string) {
    return (
      <button
        type="button"
        className="builder-reset-control"
        aria-label={`Reset ${device} ${label}`}
        title="Reset to inherited value"
        disabled={
          current[key] === undefined && current.tokens?.[key] === undefined
        }
        onClick={() => update(key, undefined)}
      >
        ↺
      </button>
    );
  }
  function tokenControl(key: keyof StyleValues, label: string) {
    const group = tokenGroupForStyle(key);
    const choices = group ? Object.keys(themeTokens[group] || {}) : [];
    if (!choices.length) return null;
    return (
      <select
        className="builder-token-select"
        aria-label={`${device} ${label} token`}
        value={current.tokens?.[key] || ""}
        onChange={(event) => {
          const next = { ...current, tokens: { ...current.tokens } };
          if (event.target.value) {
            next.tokens[key] = event.target.value;
            delete next[key];
          } else delete next.tokens[key];
          onChange(
            { ...value, [device]: next },
            { field: { focus: `builder-style:${device}:${key}` } },
          );
        }}
      >
        <option value="">Custom / inherited</option>
        {choices.map((name) => (
          <option key={name} value={name}>
            {name} · {themeTokens[group][name]}
          </option>
        ))}
      </select>
    );
  }
  function number([key, label, min, max, step = 1]: NumericControl) {
    return (
      <div className="builder-style-control" key={key}>
        <label>
          <span>{label}</span>
          <div className="builder-input-reset">
            <input
              aria-label={`${device} ${label}`}
              type="number"
              min={min}
              max={max}
              step={step}
              placeholder={String(effective[key] ?? "Auto")}
              value={(current[key] as number) ?? ""}
              onChange={(e) =>
                update(
                  key,
                  e.target.value === ""
                    ? undefined
                    : Math.max(min, Math.min(max, Number(e.target.value))),
                )
              }
            />
          </div>
        </label>
        {reset(key, label)}
        {status(key)}
        {tokenControl(key, label)}
      </div>
    );
  }
  function select(key: keyof StyleValues, label: string, options: string[]) {
    return (
      <div className="builder-style-control" key={key}>
        <label>
          {label}
          <select
            aria-label={`${device} ${label}`}
            value={String(current[key] ?? "")}
            onChange={(e) => update(key, e.target.value || undefined)}
          >
            <option value="">
              Inherit
              {effective[key] !== undefined
                ? ` (${effective[key]})`
                : " / default"}
            </option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {reset(key, label)}
        {status(key)}
        {tokenControl(key, label)}
      </div>
    );
  }
  function color(key: keyof StyleValues, label: string) {
    return (
      <div className="builder-style-control" key={key}>
        <label>
          {label}
          <div className="builder-color">
            <input
              type="color"
              aria-label={`${device} ${label} picker`}
              value={
                /^#[0-9a-f]{6}$/i.test(String(effective[key]))
                  ? String(effective[key])
                  : "#ffffff"
              }
              onChange={(e) => update(key, e.target.value)}
            />
            <input
              aria-label={`${device} ${label}`}
              placeholder={String(effective[key] ?? "Inherit")}
              value={String(current[key] ?? "")}
              onChange={(e) => update(key, e.target.value || undefined)}
            />
          </div>
        </label>
        {reset(key, label)}
        {status(key)}
        {tokenControl(key, label)}
      </div>
    );
  }
  return (
    <div className="builder-field builder-responsive-controls">
      <div className="builder-tabs" aria-label="Responsive editing device">
        {(Object.entries(devices) as [Device, number][]).map(([name, size]) => (
          <button
            key={name}
            type="button"
            aria-pressed={name === device}
            onClick={() =>
              dispatch({
                type: "setUi",
                ui: {
                  viewports: {
                    ...appState.ui.viewports,
                    current: { width: size, height: "auto" },
                  },
                },
              })
            }
          >
            {name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      <p className="builder-hint">
        {device === "desktop"
          ? "Base styles apply to every screen. Measurements are in pixels unless labelled otherwise."
          : `Editing ${device}. Empty controls inherit larger-screen styles. Use ↺ to remove an override.`}
      </p>
      <details open>
        <summary>Spacing</summary>
        {(["margin", "padding"] as const).map((group) => (
          <fieldset
            className={`builder-spacing-box builder-spacing-${group}`}
            key={group}
          >
            <legend>
              {group === "margin" ? "Outside spacing" : "Inside spacing"}
            </legend>
            {number([
              group,
              `All ${group}`,
              0,
              group === "padding" ? 240 : 200,
            ])}
            <div className="builder-spacing-sides">
              {(["Top", "Right", "Bottom", "Left"] as const).map((side) => (
                <div
                  className={`builder-spacing-${side.toLowerCase()}`}
                  key={side}
                >
                  {number([
                    `${group}${side}`,
                    `${group} ${side.toLowerCase()}`,
                    group === "padding" ? 0 : -200,
                    group === "padding" ? 240 : 200,
                  ])}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </details>
      <details open>
        <summary>Layout</summary>
        <div className="builder-control-grid">
          {layout
            .filter(
              ([key]) =>
                isLayout || !["columns", "rowGap", "columnGap"].includes(key),
            )
            .map(number)}
        </div>
        {isLayout && (
          <>
            <div className="builder-style-control">
              <label>
                Column proportions
                <input
                  aria-label={`${device} Column proportions`}
                  placeholder={String(
                    effective.columnWidths ?? "Equal widths, e.g. 1 1",
                  )}
                  value={current.columnWidths ?? ""}
                  onChange={(e) =>
                    update("columnWidths", e.target.value || undefined)
                  }
                />
              </label>
              {reset("columnWidths", "Column proportions")}
              {status("columnWidths")}
            </div>
            <p className="builder-hint">
              Use positive numbers such as 2 1 for a wider first column. Setting
              Columns at a smaller screen resets inherited proportions.
            </p>
            {select("alignItems", "Vertical alignment", [
              "start",
              "center",
              "end",
              "stretch",
            ])}
            {select("justifyItems", "Horizontal alignment", [
              "start",
              "center",
              "end",
              "stretch",
            ])}
          </>
        )}
        <div className="builder-style-control">
          <label>
            Visibility
            <select
              aria-label={`${device} Visibility`}
              value={current.hidden === undefined ? "" : String(current.hidden)}
              onChange={(e) =>
                update(
                  "hidden",
                  e.target.value === "" ? undefined : e.target.value === "true",
                )
              }
            >
              <option value="">
                Inherit ({effective.hidden ? "hidden" : "visible"})
              </option>
              <option value="false">Visible</option>
              <option value="true">Hidden</option>
            </select>
          </label>
          {reset("hidden", "Visibility")}
          {status("hidden")}
        </div>
      </details>
      <details>
        <summary>Typography</summary>
        <div className="builder-control-grid">{typography.map(number)}</div>
        {select("align", "Text alignment", ["left", "center", "right"])}
        {color("color", "Text colour")}
      </details>
      <details>
        <summary>Background & border</summary>
        {color("background", "Background")}
        <AssetInput
          value={String(
            current.backgroundImage ?? effective.backgroundImage ?? "",
          )}
          onChange={(v) => update("backgroundImage", v || undefined)}
        />
        {current.backgroundImage !== undefined && (
          <button
            type="button"
            onClick={() => update("backgroundImage", undefined)}
          >
            Reset background image
          </button>
        )}
        <button type="button" onClick={() => update("backgroundImage", "none")}>
          Remove background image on {device}
        </button>
        {color("overlayColor", "Overlay colour")}
        {number(["overlayOpacity", "Overlay opacity (%)", 0, 100])}
        <div className="builder-control-grid">
          {number(["radius", "Rounded corners", 0, 200])}
          {number(["borderWidth", "Border width", 0, 20])}
        </div>
        {color("borderColor", "Border colour")}
        {select("shadow", "Shadow", ["none", "soft", "strong"])}
      </details>
      <details>
        <summary>
          {isMedia ? "Image crop & focal point" : "Background focal point"}
        </summary>
        {isMedia && (
          <>
            {select("objectFit", "Image fit", [
              "cover",
              "contain",
              "fill",
              "scale-down",
            ])}
            {select("aspectRatio", "Image ratio", [
              "auto",
              "1 / 1",
              "4 / 3",
              "3 / 4",
              "16 / 9",
              "9 / 16",
              "3 / 2",
            ])}
          </>
        )}
        <div className="builder-focal-control">
          <div className="builder-focal-grid" aria-hidden="true">
            <span
              style={{
                left: `${effective.focalX ?? 50}%`,
                top: `${effective.focalY ?? 50}%`,
              }}
            />
          </div>
          {(["focalX", "focalY"] as const).map((key, index) => (
            <label key={key}>
              {index === 0 ? "Horizontal" : "Vertical"} focal point
              <input
                aria-label={`${device} ${key}`}
                type="range"
                min={0}
                max={100}
                value={effective[key] ?? 50}
                onChange={(e) => update(key, Number(e.target.value))}
              />
              {reset(key, key)}
              {status(key)}
            </label>
          ))}
        </div>
      </details>
      <details>
        <summary>Hover & focus</summary>
        {color("hoverBackground", "Hover background")}
        {color("hoverColor", "Hover text")}
        {color("focusColor", "Focus outline")}
        <p className="builder-hint">
          Preview the page to try hover and keyboard focus states.
        </p>
      </details>
      <button
        type="button"
        onClick={() => {
          const next = { ...value };
          delete next[device];
          onChange(next, { field: { focus: `builder-style:${device}:reset` } });
        }}
      >
        Reset {device} styles
      </button>
    </div>
  );
}
