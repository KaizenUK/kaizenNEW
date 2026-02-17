import type {
  SanityFeaturesSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";

type Props = SanityFeaturesSection & { settings?: SanitySectionSettings };

export default function FeaturesSection(props: Props) {
  const { heading, items, settings } = props;

  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-12 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {(items || []).map((item, index) => (
          <article
            key={item._key || `feature-${index}`}
            className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"
          >
         
            {item.title && (
              <h3 className="text-lg font-semibold text-white">
                {item.title}
              </h3>
            )}
            {item.text && (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {item.text}
              </p>
            )}
          </article>
        ))}
      </div>
    </SectionWrapper>
  );
}
