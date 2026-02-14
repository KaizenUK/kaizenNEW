import SectionWrapper from "../SectionWrapper";
import type { ManagedLogoBarSection } from "@shared/pageBuilder";

export default function LogoBarSection({
  heading,
  logos,
  settings,
}: ManagedLogoBarSection) {
  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-gray-400">
          {heading}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {(logos || []).map((logo) => {
          const img = (
            <img
              key={logo._key}
              src={logo.imageUrl}
              alt={logo.alt}
              className="h-8 w-auto max-w-[120px] object-contain opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0 md:h-10 md:max-w-[140px]"
              loading="lazy"
              decoding="async"
            />
          );

          if (logo.href) {
            return (
              <a
                key={logo._key}
                href={logo.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {img}
              </a>
            );
          }

          return img;
        })}
      </div>
    </SectionWrapper>
  );
}
