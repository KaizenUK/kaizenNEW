import SectionWrapper from "../SectionWrapper";
import { SectionHeading, CtaButton } from "../shared";
import type { ManagedPricingSection } from "@shared/pageBuilder";

export default function PricingSection({
  heading,
  subtitle,
  tiers,
  settings,
}: ManagedPricingSection) {
  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-4 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      {subtitle && (
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-gray-400">
          {subtitle}
        </p>
      )}
      <div
        className={`grid gap-6 ${
          (tiers?.length ?? 0) === 1
            ? "max-w-md mx-auto"
            : (tiers?.length ?? 0) === 2
              ? "sm:grid-cols-2 max-w-3xl mx-auto"
              : (tiers?.length ?? 0) === 3
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {(tiers || []).map((tier) => (
          <div
            key={tier._key}
            className={`relative flex flex-col rounded-2xl border p-6 transition ${
              tier.isHighlighted
                ? "border-cyan-400/50 bg-cyan-500/[0.06] shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {tier.isHighlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-0.5 text-xs font-bold text-white">
                Recommended
              </span>
            )}
            <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
            <p className="mt-2 text-3xl font-extrabold text-white">
              {tier.price}
            </p>
            {tier.description && (
              <p className="mt-2 text-sm text-gray-400">{tier.description}</p>
            )}
            {tier.features && tier.features.length > 0 && (
              <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-300">
                {tier.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-cyan-400">&#10003;</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}
            {tier.buttonLink && (
              <div className="mt-6">
                <CtaButton cta={tier.buttonLink} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
