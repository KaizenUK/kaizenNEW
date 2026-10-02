import { MarketingButton } from "../MarketingButton";
import { cx } from "../utils/cx";
import { caseStudies, type CaseStudyId } from "./evidence";

interface Props {
  studyId?: CaseStudyId;
  headingLevel?: "h2" | "h3";
  className?: string;
  imageLoading?: "eager" | "lazy";
  layout?: "stacked" | "wide";
}

/** A real screenshot and a confirmed result, suitable beside a contact action. */
export function CaseStudyCard({
  studyId = "midland",
  headingLevel: Heading = "h3",
  className,
  imageLoading = "lazy",
  layout = "stacked",
}: Props) {
  const study = caseStudies[studyId];

  return (
    <article
      className={cx(
        "min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white font-body shadow-sm",
        layout === "wide" && "lg:grid lg:grid-cols-[1.3fr_1fr]",
        className,
      )}
    >
      <div
        className={cx(
          "border-b border-slate-200 bg-slate-50 px-5 pt-6 sm:px-7 sm:pt-7",
          layout === "wide" &&
            "lg:flex lg:items-center lg:border-r lg:border-b-0 lg:pb-7",
        )}
      >
        <div
          className={cx(
            "w-full overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-sm",
            layout === "wide" && "lg:rounded-xl lg:border-b",
          )}
        >
          <div
            aria-hidden="true"
            className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5"
          >
            <span className="flex shrink-0 gap-1">
              <span className="size-1.5 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-slate-300" />
            </span>
            <span className="min-w-0 truncate text-xs text-slate-600">
              {study.websiteLabel}
            </span>
          </div>
          <img
            src={study.screenshot.src}
            alt={study.screenshot.alt}
            width={study.screenshot.width}
            height={study.screenshot.height}
            loading={imageLoading}
            decoding="async"
            className="block h-auto w-full"
          />
        </div>
      </div>
      <div
        className={cx(
          "p-6 sm:p-7",
          layout === "wide" && "lg:flex lg:flex-col lg:justify-center lg:p-8",
        )}
      >
        <p className="mb-3 text-xs font-semibold tracking-wide text-uui-brand-800">
          {study.buyer}
        </p>
        <p className="mb-3 text-sm font-semibold text-slate-600">
          {study.client}
        </p>
        <Heading className="text-balance font-display text-3xl font-bold leading-[1.1] text-uui-dark">
          {study.title}
        </Heading>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          {study.summary}
        </p>
        <p className="mt-5 border-l-2 border-uui-brand-600 pl-4 text-base font-semibold leading-relaxed text-uui-dark">
          {study.result}
        </p>
        <MarketingButton
          action="caseStudy"
          href={study.href}
          variant="link"
          className="mt-5"
        />
      </div>
    </article>
  );
}
