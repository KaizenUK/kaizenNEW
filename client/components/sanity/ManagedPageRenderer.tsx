import { stegaClean } from "@sanity/client/stega";
import { createDataAttribute } from "@sanity/visual-editing";
import Layout from "@/components/Layout";
import type { ManagedPageData, ManagedPageSection } from "@shared/pageBuilder";

// ── Section components ────────────────────────────────────────────
import HeroSection from "@/components/page-builder/sections/HeroSection";
import RichTextSection from "@/components/page-builder/sections/RichTextSection";
import FeaturesSection from "@/components/page-builder/sections/FeaturesSection";
import CtaSectionBlock from "@/components/page-builder/sections/CtaSectionBlock";
import TestimonialsSection from "@/components/page-builder/sections/TestimonialsSection";
import FaqSectionBlock from "@/components/page-builder/sections/FaqSectionBlock";
import StatsSection from "@/components/page-builder/sections/StatsSection";
import ImageGallerySection from "@/components/page-builder/sections/ImageGallerySection";
import VideoEmbedSection from "@/components/page-builder/sections/VideoEmbedSection";
import PricingSection from "@/components/page-builder/sections/PricingSection";
import LogoBarSection from "@/components/page-builder/sections/LogoBarSection";
import TeamGridSection from "@/components/page-builder/sections/TeamGridSection";
import ContactFormSection from "@/components/page-builder/sections/ContactFormSection";
import LayoutRowSection from "@/components/page-builder/sections/LayoutRowSection";
import SpacerSection from "@/components/page-builder/sections/SpacerSection";

const SITE_URL = "https://kaizenweb.co.uk";

function sanitizeImageUrl(value: unknown): string {
  return String(stegaClean(value) ?? "");
}

function renderSection(section: ManagedPageSection) {
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
    case "layoutRow":
      return <LayoutRowSection {...section} />;
    case "spacer":
      return <SpacerSection {...section} />;
    default:
      return null;
  }
}

export default function ManagedPageRenderer({
  page,
  routePath,
  withLayout = true,
}: {
  page: ManagedPageData;
  routePath: string;
  withLayout?: boolean;
}) {
  const seo = page.seo || {};
  const title = seo.metaTitle || page.title || "Kaizen Web";
  const description =
    seo.metaDescription ||
    "Managed page content from Sanity Presentation mode.";
  const canonicalUrl = seo.canonicalUrl || `${SITE_URL}${routePath || "/"}`;
  const ogImage = sanitizeImageUrl(seo.shareImage?.asset?.url);
  const sections = Array.isArray(page.content) ? page.content : [];

  // Build data attribute helper for Presentation drag-and-drop
  const attr = createDataAttribute({
    id: page._id,
    type: page._type || "page",
    path: "content",
  });

  const content = (
    <div
      className="flex w-full flex-col"
      data-sanity={attr.toString()}
    >
      {sections.length ? (
        sections.map((section, index) => {
          const key = section._key || `${section._type}-${index}`;
          return (
            <div
              key={key}
              data-sanity={
                section._key
                  ? attr.scope(section._key).toString()
                  : undefined
              }
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

  if (!withLayout) return content;

  return (
    <Layout
      metaOverride={{
        title,
        description,
        canonicalUrl,
        image: ogImage || undefined,
        noIndex: Boolean(seo.noIndex),
      }}
    >
      {content}
    </Layout>
  );
}
