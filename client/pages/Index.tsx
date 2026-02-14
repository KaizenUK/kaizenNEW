import HomeLayout from "@/components/HomeLayout";
import { HeroRemotionSequence } from "@/components/homepage/HeroRemotionSequence";
import {
  SocialMediaWarning,
  CredibilitySection,
} from "@/components/homepage/ValueProposition";
import { PerformanceShowcase } from "@/components/homepage/PerformanceShowcase";
import { ServiceShowcase } from "@/components/homepage/ServiceShowcase";
import {
  PricingSlider,
  PricingCTABanner,
  AIPriceNarrative,
  SEOFAQSection,
  LocalMap,
} from "@/components/homepage/BelowFoldSections";

export default function Home() {
  return (
    <HomeLayout>
      <HeroRemotionSequence />
      <SocialMediaWarning />
      <PerformanceShowcase />
      <CredibilitySection />
      <ServiceShowcase />
      <PricingSlider />
      <PricingCTABanner />
      <AIPriceNarrative />
      <LocalMap />
      <SEOFAQSection />
    </HomeLayout>
  );
}
