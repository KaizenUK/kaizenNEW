import React, { Suspense, useEffect, useRef, useState, lazy } from "react";
import Layout from "@/components/Layout";

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
  children,
  minHeight = 480,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      // Keep eager loading modest so below-the-fold bundles do not execute too early.
      { rootMargin: "120px 0px" },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `${minHeight}px 1px`,
      }}
    >
      {isVisible ? children : null}
    </div>
  );
};

export default function Home() {
  return (
    <Layout>
      {/* 1. Hero — hook them with the outcome + live proof */}
      <HeroRemotionSequence />

      {/* 2. Pain — make them feel the risk of doing nothing */}
      <DeferredSection minHeight={420}>
        <Suspense fallback={<div className="min-h-[320px]" />}>
          <SocialMediaWarning />
        </Suspense>
      </DeferredSection>

      {/* 3. Audit Tool + Vitals — let them prove the problem, then show our standard */}
      <DeferredSection minHeight={900}>
        <Suspense fallback={<div className="min-h-[700px]" />}>
          <PerformanceShowcase />
        </Suspense>
      </DeferredSection>

      {/* 4. Credibility — explain why we can deliver */}
      <DeferredSection minHeight={550}>
        <Suspense fallback={<div className="min-h-[450px]" />}>
          <CredibilitySection />
        </Suspense>
      </DeferredSection>

      {/* 5. Two Verticals — show what we offer */}
      <DeferredSection minHeight={500}>
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <ServiceShowcase />
        </Suspense>
      </DeferredSection>

      {/* 6. Pricing — remove the cost objection */}
      <DeferredSection minHeight={620}>
        <Suspense fallback={<div className="min-h-[560px]" />}>
          <PricingSlider />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={260}>
        <Suspense fallback={<div className="min-h-[220px]" />}>
          <PricingCTABanner />
        </Suspense>
      </DeferredSection>

      {/* 7. AI USP — explain why the price is so low */}
      <DeferredSection minHeight={640}>
        <Suspense fallback={<div className="min-h-[420px]" />}>
          <AIPriceNarrative />
        </Suspense>
      </DeferredSection>

      {/* 8. Local Trust + Map — warm close */}
      <DeferredSection minHeight={680}>
        <Suspense fallback={<div className="min-h-[520px]" />}>
          <LocalMap />
        </Suspense>
      </DeferredSection>

      {/* Supporting content */}
      <DeferredSection minHeight={520}>
        <Suspense fallback={<div className="min-h-[420px]" />}>
          <SEOFAQSection />
        </Suspense>
      </DeferredSection>
    </Layout>
  );
}

