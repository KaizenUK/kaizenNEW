import type { ManagedLayoutRowSection, ManagedColumnSection } from "@shared/pageBuilder";
import SectionWrapper from "../SectionWrapper";
import HeroSection from "./HeroSection";
import RichTextSection from "./RichTextSection";
import FeaturesSection from "./FeaturesSection";
import CtaSectionBlock from "./CtaSectionBlock";
import TestimonialsSection from "./TestimonialsSection";
import FaqSectionBlock from "./FaqSectionBlock";
import StatsSection from "./StatsSection";
import ImageGallerySection from "./ImageGallerySection";
import VideoEmbedSection from "./VideoEmbedSection";
import PricingSection from "./PricingSection";
import LogoBarSection from "./LogoBarSection";
import TeamGridSection from "./TeamGridSection";
import ContactFormSection from "./ContactFormSection";
import SpacerSection from "./SpacerSection";

const GRID_CLASSES: Record<string, string> = {
  "50-50": "grid-cols-1 md:grid-cols-2",
  "33-33-33": "grid-cols-1 md:grid-cols-3",
  "70-30": "grid-cols-1 md:grid-cols-[7fr_3fr]",
  "30-70": "grid-cols-1 md:grid-cols-[3fr_7fr]",
  "25-50-25": "grid-cols-1 md:grid-cols-[1fr_2fr_1fr]",
  "25-25-25-25": "grid-cols-1 md:grid-cols-4",
};

const VALIGN_CLASSES: Record<string, string> = {
  top: "self-start",
  center: "self-center",
  bottom: "self-end",
};

function renderColumnSection(section: ManagedColumnSection) {
  switch (section._type) {
    case "hero":
      return <HeroSection {...section} />;
    case "richTextSection":
      return <RichTextSection {...section} />;
    case "features":
      return <FeaturesSection {...section} />;
    case "ctaSection":
      return <CtaSectionBlock {...section} />;
    case "testimonials":
      return <TestimonialsSection {...section} />;
    case "faqSection":
      return <FaqSectionBlock {...section} />;
    case "statsSection":
      return <StatsSection {...section} />;
    case "imageGallery":
      return <ImageGallerySection {...section} />;
    case "videoEmbed":
      return <VideoEmbedSection {...section} />;
    case "pricingSection":
      return <PricingSection {...section} />;
    case "logoBar":
      return <LogoBarSection {...section} />;
    case "teamGrid":
      return <TeamGridSection {...section} />;
    case "contactForm":
      return <ContactFormSection {...section} />;
    case "spacer":
      return <SpacerSection {...section} />;
    default:
      return null;
  }
}

export default function LayoutRowSection(props: ManagedLayoutRowSection) {
  const { layout = "50-50", columns, settings } = props;
  const gridClass = GRID_CLASSES[layout] ?? GRID_CLASSES["50-50"];

  return (
    <SectionWrapper settings={settings}>
      <div className={`grid gap-6 md:gap-8 ${gridClass}`}>
        {(columns || []).map((col, colIndex) => {
          const key = col._key || `col-${colIndex}`;
          const valign = VALIGN_CLASSES[col.verticalAlign ?? "top"] ?? "";
          const sections = Array.isArray(col.content) ? col.content : [];

          return (
            <div key={key} className={`flex flex-col gap-6 ${valign}`}>
              {sections.map((section, sIndex) => {
                const sKey = section._key || `${section._type}-${sIndex}`;
                return (
                  <div key={sKey}>
                    {renderColumnSection(section)}
                  </div>
                );
              })}
              {sections.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                  Empty column
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
