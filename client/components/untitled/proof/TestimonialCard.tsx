import { Button } from "../base/buttons/button";
import { cx } from "../utils/cx";
import { googleReviewsUrl, reviews, type ReviewId } from "./evidence";

interface Props {
  reviewId: ReviewId;
  className?: string;
}

/** Static, fully visible evidence: no carousel, clipped quote or client script. */
export function TestimonialCard({ reviewId, className }: Props) {
  const review = reviews[reviewId];

  return (
    <figure
      className={cx(
        "m-0 flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 font-body shadow-sm sm:p-7",
        className,
      )}
    >
      <div
        role="img"
        aria-label={`${review.rating} out of 5 stars`}
        className="mb-5 flex gap-1 text-amber-600"
      >
        {Array.from({ length: review.rating }, (_, index) => (
          <svg
            key={index}
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
          </svg>
        ))}
      </div>
      <blockquote cite={googleReviewsUrl} className="m-0 mb-7">
        <p className="text-lg leading-relaxed text-uui-dark">
          {review.excerpt}
        </p>
      </blockquote>
      <figcaption className="mt-auto">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-uui-brand-50 text-sm font-semibold text-uui-brand-800 ring-1 ring-uui-brand-100"
          >
            {review.initials}
          </span>
          <div>
            <p className="font-semibold text-uui-dark">{review.author}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              <time dateTime={review.postedOn}>{review.postedMonth}</time>
            </p>
          </div>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-600">
          Part of a Google review.
        </p>
        <Button
          href={googleReviewsUrl}
          color="link-color"
          size="sm"
          className="mt-1 whitespace-normal text-left"
        >
          Read reviews on Google
        </Button>
      </figcaption>
    </figure>
  );
}
