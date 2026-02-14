import type {
  SanityHeroSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { CtaButton } from "../shared";

type Props = SanityHeroSection & { settings?: SanitySectionSettings };

export default function HeroSection(props: Props) {
  const { title, subtitle, image, buttonLink, settings } = props;
  const imageUrl = image?.asset?.url;

  return (
    <SectionWrapper settings={settings}>
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/10 to-transparent" />
      <div className="relative text-center">
        {title && (
          <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
            {subtitle}
          </p>
        )}
        {buttonLink && (
          <div className="mt-8 flex justify-center gap-4">
            <CtaButton cta={buttonLink} />
          </div>
        )}
        {imageUrl && (
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={imageUrl}
              alt={image?.alt || title || "Hero image"}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
