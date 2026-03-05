import { lazy, Suspense } from "react";
import type { ManagedPageData, ManagedPageSection } from "@shared/pageBuilder";

// ── Lazy-loaded section components ────────────────────────────────
// Each section is split into its own chunk so the browser only
// downloads JS for sections actually present on the page.

const HeroSection = lazy(
  () => import("@/components/page-builder/sections/HeroSection"),
);
const RichTextSection = lazy(
  () => import("@/components/page-builder/sections/RichTextSection"),
);
const FeaturesSection = lazy(
  () => import("@/components/page-builder/sections/FeaturesSection"),
);
const CtaSectionBlock = lazy(
  () => import("@/components/page-builder/sections/CtaSectionBlock"),
);
const TestimonialsSection = lazy(
  () => import("@/components/page-builder/sections/TestimonialsSection"),
);
const FaqSectionBlock = lazy(
  () => import("@/components/page-builder/sections/FaqSectionBlock"),
);
const StatsSection = lazy(
  () => import("@/components/page-builder/sections/StatsSection"),
);
const ImageGallerySection = lazy(
  () => import("@/components/page-builder/sections/ImageGallerySection"),
);
const VideoEmbedSection = lazy(
  () => import("@/components/page-builder/sections/VideoEmbedSection"),
);
const PricingSection = lazy(
  () => import("@/components/page-builder/sections/PricingSection"),
);
const LogoBarSection = lazy(
  () => import("@/components/page-builder/sections/LogoBarSection"),
);
const TeamGridSection = lazy(
  () => import("@/components/page-builder/sections/TeamGridSection"),
);
const ContactFormSection = lazy(
  () => import("@/components/page-builder/sections/ContactFormSection"),
);
const LayoutRowSection = lazy(
  () => import("@/components/page-builder/sections/LayoutRowSection"),
);
const SpacerSection = lazy(
  () => import("@/components/page-builder/sections/SpacerSection"),
);

function renderSection(section: ManagedPageSection) {
  let element: React.ReactNode;

  switch (section._type) {
    case "hero":
      element = <HeroSection {...section} />;
      break;
    case "richTextSection":
      element = <RichTextSection {...section} />;
      break;
    case "features":
      element = <FeaturesSection {...section} />;
      break;
    case "ctaSection":
      element = <CtaSectionBlock {...section} />;
      break;
    case "testimonials":
      element = <TestimonialsSection {...section} />;
      break;
    case "faqSection":
      element = <FaqSectionBlock {...section} />;
      break;
    case "statsSection":
      element = <StatsSection {...section} />;
      break;
    case "imageGallery":
      element = <ImageGallerySection {...section} />;
      break;
    case "videoEmbed":
      element = <VideoEmbedSection {...section} />;
      break;
    case "pricingSection":
      element = <PricingSection {...section} />;
      break;
    case "logoBar":
      element = <LogoBarSection {...section} />;
      break;
    case "teamGrid":
      element = <TeamGridSection {...section} />;
      break;
    case "contactForm":
      element = <ContactFormSection {...section} />;
      break;
    case "layoutRow":
      element = <LayoutRowSection {...section} />;
      break;
    case "spacer":
      element = <SpacerSection {...section} />;
      break;
    default:
      return null;
  }

  return <Suspense fallback={null}>{element}</Suspense>;
}

export default function ManagedPageRenderer({
  page,
  routePath: _routePath,
}: {
  page: ManagedPageData;
  routePath?: string;
}) {
  const sections = Array.isArray(page.content) ? page.content : [];

  const content = (
    <div
      className="flex w-full flex-col"
    >
      {sections.length ? (
        sections.map((section, index) => {
          const key = section._key || `${section._type}-${index}`;
          return (
            <div
              key={key}
            >
              {renderSection(section)}
            </div>
          );
        })
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="rounded-xl border border-white/10 bg-[#0b111a] px-6 py-7">
            <h1 className="text-3xl font-black text-white">
              {page.title || "Untitled page"}
            </h1>
            <p className="mt-3 text-slate-300">
              This page is now connected to Sanity. Add sections in the Page
              document to render editable content in Presentation mode.
            </p>
          </div>
        </section>
      )}
    </div>
  );

  return content;
}
