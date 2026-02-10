import React, { Suspense, useEffect, useRef, useState, lazy } from "react";
import HomeLayout from "@/components/HomeLayout";
import { isReactSnapPrerender } from "@/lib/prerender";

// Lazy-load below-the-fold components to reduce initial bundle size
import { HeroRemotionSequence } from "@/components/homepage/HeroRemotionSequence";
const SocialMediaWarning = lazy(() =>
  import("@/components/homepage/ValueProposition").then((m) => ({
    default: m.SocialMediaWarning,
  })),
);

const PerformanceShowcase = lazy(() =>
  import("@/components/homepage/PerformanceShowcase").then((m) => ({
    default: m.PerformanceShowcase,
  })),
);
const CredibilitySection = lazy(() =>
  import("@/components/homepage/ValueProposition").then((m) => ({
    default: m.CredibilitySection,
  })),
);
const ServiceShowcase = lazy(() =>
  import("@/components/homepage/ServiceShowcase").then((m) => ({
    default: m.ServiceShowcase,
  })),
);

const PricingSlider = lazy(() =>
  import("@/components/homepage/BelowFoldSections").then((m) => ({
    default: m.PricingSlider,
  })),
);
const PricingCTABanner = lazy(() =>
  import("@/components/homepage/BelowFoldSections").then((m) => ({
    default: m.PricingCTABanner,
  })),
);
const AIPriceNarrative = lazy(() =>
  import("@/components/homepage/BelowFoldSections").then((m) => ({
    default: m.AIPriceNarrative,
  })),
);
const SEOFAQSection = lazy(() =>
  import("@/components/homepage/BelowFoldSections").then((m) => ({
    default: m.SEOFAQSection,
  })),
);
const LocalMap = lazy(() =>
  import("@/components/homepage/BelowFoldSections").then((m) => ({
    default: m.LocalMap,
  })),
);

const DeferredSection = ({
  id,
  children,
  minHeight = 480,
  activated = true,
}: {
  id: string;
  children: React.ReactNode;
  minHeight?: number;
  activated?: boolean;
}) => {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document !== "undefined") {
      const existingNode = document.querySelector(`[data-deferred-id="${id}"]`);
      if (existingNode && existingNode.childElementCount > 0) {
        return true;
      }
    }

    return isReactSnapPrerender();
  });
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activated || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      // Keep this small so heavy lazy chunks are not fetched before scroll intent.
      { rootMargin: "80px 0px" },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [activated, isVisible]);

  return (
    <div
      ref={sectionRef}
      data-deferred-id={id}
      data-deferred-rendered={isVisible ? "true" : undefined}
      style={isVisible ? undefined : { minHeight: `${minHeight}px` }}
    >
      {isVisible ? children : null}
    </div>
  );
};

export default function Home() {
  const [canLoadDeferredSections, setCanLoadDeferredSections] = useState(() =>
    isReactSnapPrerender(),
  );

  useEffect(() => {
    if (canLoadDeferredSections || typeof window === "undefined") return;

    const activate = () => setCanLoadDeferredSections(true);
    const onFirstIntent = () => activate();

    window.addEventListener("scroll", onFirstIntent, { once: true, passive: true });
    window.addEventListener("touchstart", onFirstIntent, { once: true, passive: true });
    window.addEventListener("keydown", onFirstIntent, { once: true });

    const fallbackId = window.setTimeout(activate, 2000);

    return () => {
      window.removeEventListener("scroll", onFirstIntent);
      window.removeEventListener("touchstart", onFirstIntent);
      window.removeEventListener("keydown", onFirstIntent);
      window.clearTimeout(fallbackId);
    };
  }, [canLoadDeferredSections]);

  return (
    <HomeLayout>
      {/* 1. Hero — hook them with the outcome + live proof */}
      <HeroRemotionSequence />

      {/* 2. Pain — make them feel the risk of doing nothing */}
      <DeferredSection
        id="home-social-media-warning"
        minHeight={420}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[320px]" />}>
          <SocialMediaWarning />
        </Suspense>
      </DeferredSection>

      {/* 3. Audit Tool + Vitals — let them prove the problem, then show our standard */}
      <DeferredSection
        id="home-performance-showcase"
        minHeight={900}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[700px]" />}>
          <PerformanceShowcase />
        </Suspense>
      </DeferredSection>

      {/* 4. Credibility — explain why we can deliver */}
      <DeferredSection
        id="home-credibility"
        minHeight={550}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[450px]" />}>
          <CredibilitySection />
        </Suspense>
      </DeferredSection>

      {/* 5. Two Verticals — show what we offer */}
      <DeferredSection
        id="home-service-showcase"
        minHeight={500}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <ServiceShowcase />
        </Suspense>
      </DeferredSection>

      {/* 6. Pricing — remove the cost objection */}
      <DeferredSection
        id="home-pricing-slider"
        minHeight={620}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[560px]" />}>
          <PricingSlider />
        </Suspense>
      </DeferredSection>
      <DeferredSection
        id="home-pricing-cta"
        minHeight={260}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[220px]" />}>
          <PricingCTABanner />
        </Suspense>
      </DeferredSection>

      {/* 7. AI USP — explain why the price is so low */}
      <DeferredSection
        id="home-ai-narrative"
        minHeight={640}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[420px]" />}>
          <AIPriceNarrative />
        </Suspense>
      </DeferredSection>

      {/* 8. Local Trust + Map — warm close */}
      <DeferredSection
        id="home-local-map"
        minHeight={680}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[520px]" />}>
          <LocalMap />
        </Suspense>
      </DeferredSection>

      {/* Supporting content */}
      <DeferredSection
        id="home-seo-faq"
        minHeight={520}
        activated={canLoadDeferredSections}
      >
        <Suspense fallback={<div className="min-h-[420px]" />}>
          <SEOFAQSection />
        </Suspense>
      </DeferredSection>
    </HomeLayout>
  );
}

