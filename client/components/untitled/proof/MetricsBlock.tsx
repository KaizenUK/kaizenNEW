import { MarketingButton } from "../MarketingButton";
import { cx } from "../utils/cx";
import { caseStudies, midlandMetrics, type MidlandMetricId } from "./evidence";

interface Props {
  ids?: readonly MidlandMetricId[];
  className?: string;
  onDark?: boolean;
  /** Omit only when an adjacent case-study card already supplies this link. */
  showSourceLink?: boolean;
}

/** Approved Midland figures, with the business and source attached to the block. */
export function MetricsBlock({
  ids = ["loadTime", "enquiries"],
  className,
  onDark = false,
  showSourceLink = true,
}: Props) {
  return (
    <div className={cx("min-w-0 font-body", className)}>
      <p
        className={cx(
          "mb-6 text-sm font-semibold",
          onDark ? "text-white" : "text-uui-dark",
        )}
      >
        Midland Oil Group, after the rebuild.
      </p>
      <dl
        className={cx(
          "grid grid-cols-1 gap-7",
          ids.length > 1 && "sm:grid-cols-2",
          ids.length === 3 && "lg:grid-cols-3",
        )}
      >
        {ids.map((id) => {
          const metric = midlandMetrics[id];

          return (
            <div
              key={id}
              className={cx(
                "flex min-w-0 flex-col border-l-2 pl-5",
                onDark ? "border-uui-brand-300" : "border-uui-brand-600",
              )}
            >
              <dt
                className={cx(
                  "order-2 mt-3 text-base font-semibold",
                  onDark ? "text-white" : "text-uui-dark",
                )}
              >
                {metric.label}
              </dt>
              <dd className="order-1 m-0">
                <span
                  aria-hidden="true"
                  className={cx(
                    "font-display text-5xl font-bold leading-[1.1] sm:text-6xl",
                    onDark ? "text-uui-brand-200" : "text-uui-brand-800",
                  )}
                >
                  {metric.value}
                </span>
                <span className="sr-only">{metric.accessibleValue}</span>
              </dd>
              <dd
                className={cx(
                  "order-3 m-0 mt-2 max-w-xs text-sm leading-6",
                  onDark ? "text-slate-300" : "text-slate-600",
                )}
              >
                {metric.detail}
              </dd>
            </div>
          );
        })}
      </dl>
      {showSourceLink ? (
        <MarketingButton
          action="caseStudy"
          href={caseStudies.midland.href}
          variant="link"
          size="sm"
          onDark={onDark}
          className="mt-5 whitespace-normal text-left"
        />
      ) : null}
    </div>
  );
}
