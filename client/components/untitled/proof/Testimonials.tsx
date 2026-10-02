import { cx } from "../utils/cx";
import { reviewIds, type ReviewId } from "./evidence";
import { TestimonialCard } from "./TestimonialCard";

interface Props {
  ids?: readonly ReviewId[];
  className?: string;
}

/** Use all four by default; pass one ID for proof beside a focused action. */
export function Testimonials({ ids = reviewIds, className }: Props) {
  return (
    <div
      className={cx(
        "grid min-w-0 grid-cols-1 gap-5",
        ids.length > 1 && "sm:grid-cols-2",
        ids.length === 3 && "xl:grid-cols-3",
        ids.length > 3 && "xl:grid-cols-4",
        className,
      )}
    >
      {ids.map((id) => (
        <TestimonialCard key={id} reviewId={id} />
      ))}
    </div>
  );
}
