import { ArrowRight } from "@untitledui/icons";
import { Button } from "../../base/buttons/button";

/** Untitled UI Hero Screen Mockup 01, adapted for Kaizen's theme and real work.
 * The existing site header is supplied by Astro. No demo logos or claims ship.
 */
export const HeroScreenMockup01 = () => (
  <section className="relative overflow-hidden bg-slate-50 py-16 md:py-24">
    <div className="mx-auto w-full max-w-7xl px-6 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <p className="mb-5 text-sm font-semibold text-uui-brand-800">
          Made for your business.
        </p>
        <h1 className="font-display text-4xl font-bold leading-[1.1] text-uui-dark md:text-6xl">
          Web design that helps your business.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-balance text-slate-600 md:text-xl">
          Turn a dated, slow site into one that brings in enquiries. We make
          changes for you as your business grows.
        </p>
        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button href="/contact/" size="xl" iconTrailing={ArrowRight}>
            Talk to us about your site
          </Button>
          <Button href="/performance-scanner/" color="secondary" size="xl">
            Check your website speed
          </Button>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
          One of us will get back to you the same day, or the next working day
          at the latest.
        </p>
      </div>
      <figure className="mx-auto mt-12 max-w-5xl md:mt-16">
        <div className="rounded-2xl bg-white p-1 shadow-xl ring-1 ring-slate-200 md:rounded-3xl md:p-2">
          <div className="overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 md:rounded-2xl">
            <div
              aria-hidden="true"
              className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-3"
            >
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-slate-300" />
              <span className="size-2 rounded-full bg-slate-300" />
            </div>
            <img
              alt="The rebuilt Midland Oil homepage with clear product choices"
              src="/images/case-studies/midland-oil-group/mog-new-homepage.webp"
              width={2550}
              height={1312}
              className="h-auto w-full"
              decoding="async"
            />
          </div>
        </div>
        <figcaption className="mt-6 text-center text-sm text-slate-600">
          Midland Oil saw three times the enquiries in the first month.
          <br />
          <Button
            href="/case-studies/midland-oil-group/"
            color="link-color"
            size="md"
            className="mt-2"
          >
            See the case study
          </Button>
        </figcaption>
      </figure>
    </div>
  </section>
);
