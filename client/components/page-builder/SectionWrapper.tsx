import { stegaClean } from "@sanity/client/stega";
import type { SanitySectionSettings } from "../../../src/lib/sanity/client";
import { urlFor } from "../../../src/lib/sanity/client";

interface SectionWrapperProps {
  settings?: SanitySectionSettings;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const BG_CLASSES: Record<string, string> = {
  default: "bg-[#050910]",
  dark: "bg-[#0a0a0a]",
  darker: "bg-[#080d14]",
  accent: "bg-gradient-to-br from-cyan-900/20 to-blue-900/20",
  gradient: "bg-gradient-to-b from-[#050910] via-[#0c1220] to-[#050910]",
  white: "bg-white text-gray-900",
};

const PT_CLASSES: Record<string, string> = {
  none: "pt-0",
  sm: "pt-8",
  md: "pt-16 md:pt-20",
  lg: "pt-20 md:pt-28",
  xl: "pt-28 md:pt-36",
};

const PB_CLASSES: Record<string, string> = {
  none: "pb-0",
  sm: "pb-8",
  md: "pb-16 md:pb-20",
  lg: "pb-20 md:pb-28",
  xl: "pb-28 md:pb-36",
};

const WIDTH_CLASSES: Record<string, string> = {
  narrow: "mx-auto max-w-3xl",
  default: "mx-auto max-w-6xl",
  wide: "mx-auto max-w-7xl",
  full: "w-full",
};

const TEXT_ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Google Fonts URL for optional font families (loaded on demand). */
const GOOGLE_FONT_SLUGS: Record<string, string> = {
  Inter: "Inter:wght@400;500;600;700;800",
  Poppins: "Poppins:wght@400;500;600;700",
  "DM Sans": "DM+Sans:wght@400;500;600;700",
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  Outfit: "Outfit:wght@400;500;600;700",
  Sora: "Sora:wght@400;500;600;700",
  Raleway: "Raleway:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700;800",
  Lato: "Lato:wght@400;700;900",
  "Open Sans": "Open+Sans:wght@400;500;600;700",
  Rubik: "Rubik:wght@400;500;600;700",
  "Work Sans": "Work+Sans:wght@400;500;600;700",
  Manrope: "Manrope:wght@400;500;600;700;800",
  "Nunito Sans": "Nunito+Sans:wght@400;500;600;700",
  "Source Sans 3": "Source+Sans+3:wght@400;500;600;700",
  "Josefin Sans": "Josefin+Sans:wght@400;500;600;700",
  Barlow: "Barlow:wght@400;500;600;700",
  Mulish: "Mulish:wght@400;500;600;700;800",
  "Libre Franklin": "Libre+Franklin:wght@400;500;600;700",
  "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700",
  Figtree: "Figtree:wght@400;500;600;700;800",
  Onest: "Onest:wght@400;500;600;700",
  Geist: "Geist:wght@400;500;600;700;800",
};

export default function SectionWrapper({
  settings,
  children,
  className = "",
  style,
}: SectionWrapperProps) {
  // Clean stega encoding from all string values used for lookups/comparisons
  const bg = stegaClean(settings?.backgroundColor ?? "default");
  const pt = stegaClean(settings?.paddingTop ?? "md");
  const pb = stegaClean(settings?.paddingBottom ?? "md");
  const width = stegaClean(settings?.containerWidth ?? "default");
  const align = stegaClean(settings?.textAlign ?? "left");
  const hideOnMobile = settings?.hideOnMobile ?? false;
  const hideOnDesktop = settings?.hideOnDesktop ?? false;
  const rawFont = stegaClean(settings?.fontFamily || "");
  const fontFamily = rawFont === "default" ? "" : rawFont;

  const visibilityClass = hideOnMobile
    ? "hidden md:block"
    : hideOnDesktop
      ? "md:hidden"
      : "";

  const bgImageUrl = settings?.backgroundImage
    ? urlFor(settings.backgroundImage).width(1920).auto("format").url()
    : null;

  const overlayOpacity = settings?.backgroundOverlay
    ? Number(stegaClean(settings.backgroundOverlay)) / 100
    : 0.6;

  // Custom background color (when preset is "custom")
  const customBg =
    bg === "custom" && settings?.customBackgroundColor
      ? settings.customBackgroundColor
      : null;

  const bgClass = customBg ? "" : (BG_CLASSES[bg] ?? BG_CLASSES.default);

  const customBgStyle: React.CSSProperties = {};
  if (customBg) {
    const { rgb, alpha } = customBg;
    if (rgb) {
      const a = typeof alpha === "number" ? alpha : 1;
      customBgStyle.backgroundColor = `rgba(${rgb.r ?? 0}, ${rgb.g ?? 0}, ${rgb.b ?? 0}, ${a})`;
    } else if (customBg.hex) {
      customBgStyle.backgroundColor = customBg.hex;
    }
  }

  // Font family override
  const fontStyle: React.CSSProperties = {};
  if (fontFamily) {
    fontStyle.fontFamily = `"${fontFamily}", "Space Grotesk", system-ui, sans-serif`;
  }

  const wrapperClasses = [
    "relative px-4",
    bgClass,
    PT_CLASSES[pt] ?? PT_CLASSES.md,
    PB_CLASSES[pb] ?? PB_CLASSES.md,
    visibilityClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const innerClasses = [
    WIDTH_CLASSES[width] ?? WIDTH_CLASSES.default,
    TEXT_ALIGN[align] ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle = { ...customBgStyle, ...fontStyle, ...style };

  // Load Google Font on demand if a non-default font is selected
  const fontLink = fontFamily && GOOGLE_FONT_SLUGS[fontFamily]
    ? `https://fonts.googleapis.com/css2?family=${GOOGLE_FONT_SLUGS[fontFamily]}&display=swap`
    : null;

  return (
    <section
      id={stegaClean(settings?.anchorId) || undefined}
      className={wrapperClasses}
      style={Object.keys(mergedStyle).length ? mergedStyle : style}
    >
      {fontLink && (
        <link rel="stylesheet" href={fontLink} />
      )}
      {bgImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImageUrl})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(5, 9, 16, ${overlayOpacity})` }}
            aria-hidden="true"
          />
        </>
      )}
      <div className={`relative ${innerClasses}`}>{children}</div>
    </section>
  );
}
