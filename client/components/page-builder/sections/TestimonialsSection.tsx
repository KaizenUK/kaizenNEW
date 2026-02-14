import type {
  SanityTestimonialsSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";

type Props = SanityTestimonialsSection & { settings?: SanitySectionSettings };

export default function TestimonialsSection(props: Props) {
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
            key={item._key || `testimonial-${index}`}
            className="rounded-xl border border-white/10 bg-white/5 p-6"
          >
            {item.quote && (
              <p className="text-base leading-relaxed text-slate-200 italic">
                &ldquo;{item.quote}&rdquo;
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              {item.image?.asset?.url && (
                <img
                  src={item.image.asset.url}
                  alt={item.name || "Testimonial author"}
                  className="h-10 w-10 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div>
                {item.name && (
                  <p className="text-sm font-semibold text-white">
                    {item.name}
                  </p>
                )}
                {(item.role || item.company) && (
                  <p className="text-xs text-slate-400">
                    {item.role}
                    {item.role && item.company ? ", " : ""}
                    {item.company}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionWrapper>
  );
}
