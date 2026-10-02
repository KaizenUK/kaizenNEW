import { MarketingButton, contactResponse } from "../../MarketingButton";

/** Untitled UI Hero Screen Mockup 01, adapted to a split view of real work. */
export function HeroScreenMockup01() {
  return (
    <section
      className="marketing-section marketing-section--compact overflow-hidden bg-slate-50"
      aria-labelledby="home-heading"
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:px-12">
        <div>
          <p className="marketing-eyebrow mb-5">For owner-run businesses</p>
          <h1
            id="home-heading"
            className="max-w-xl text-balance font-display text-[2.75rem] font-bold leading-[1.1] text-uui-dark sm:text-6xl xl:text-7xl"
          >
            Web design that brings in work.
          </h1>
          <p className="mt-6 max-w-xl font-body text-lg leading-relaxed text-slate-600">
            Your site looks dated while your competitors move on. We turn slow
            pages into a clear path to an enquiry.
          </p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
            <MarketingButton action="contact" />
            <MarketingButton action="speed" />
          </div>
          <p className="mt-4 max-w-lg font-body text-sm leading-6 text-slate-600">
            {contactResponse}
          </p>
          <p className="mt-5 font-body text-sm text-slate-600">
            Working across Merseyside and West Yorkshire.
          </p>
        </div>
        <figure className="m-0 min-w-0">
          <div className="relative rounded-3xl bg-uui-brand-100 p-4 pb-16 sm:p-7 sm:pb-24">
            <div className="ml-auto w-[88%] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <p className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 font-body text-xs font-semibold text-uui-brand-800 sm:px-4">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-uui-brand-600"
                />
                After the rebuild
              </p>
              <img
                src="/images/case-studies/midland-oil-group/mog-new-homepage.webp"
                alt="Midland Oil's new homepage, with clear choices for buyers"
                width={2550}
                height={1312}
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="block h-auto w-full"
              />
            </div>
            <div className="absolute bottom-4 left-4 w-[48%] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg sm:bottom-6 sm:left-6">
              <p className="border-b border-slate-200 px-3 py-2.5 font-body text-xs font-semibold text-slate-600">
                Before
              </p>
              <img
                src="/images/case-studies/midland-oil-group/mog-old-homepage.webp"
                alt="The previous Midland Oil homepage, before our rebuild"
                width={2544}
                height={1313}
                loading="eager"
                decoding="async"
                className="block h-auto w-full"
              />
            </div>
          </div>
          <figcaption className="mt-5 border-l-2 border-uui-brand-600 pl-5 font-body">
            <p className="text-sm font-semibold text-slate-600">
              Midland Oil Group
            </p>
            <p className="mt-1 text-lg font-semibold leading-7 text-uui-dark">
              Three times the enquiries in the first month.
            </p>
            <MarketingButton
              action="caseStudy"
              variant="link"
              size="sm"
              className="mt-1"
            />
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
