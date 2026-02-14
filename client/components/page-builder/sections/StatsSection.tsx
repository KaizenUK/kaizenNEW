import type {
  SanityStatsSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";

type Props = SanityStatsSection & { settings?: SanitySectionSettings };

export default function StatsSection(props: Props) {
  const { heading, items, settings } = props;

  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-12 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {(items || []).map((item, index) => (
          <article
            key={item._key || `stat-${index}`}
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-8 text-center"
          >
            {item.value && (
              <div className="text-4xl font-black text-cyan-400">
                {item.value}
              </div>
            )}
            {item.label && (
              <p className="mt-2 text-sm font-medium text-slate-300">
                {item.label}
              </p>
            )}
          </article>
        ))}
      </div>
    </SectionWrapper>
  );
}
