/**
 * Existing site evidence. New claims belong in the site profile first.
 * Review names, dates, ratings, text and the Google listing URL are copied from
 * src/components/homepage/Reviews.astro at commit
 * a842521519d5700d64d702f0059a73c5adf02584. These are excerpts, never rewrites.
 * The listing URL does not identify an individual review.
 */
export const googleReviewsUrl =
  "https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE";

export const reviews = {
  bLoughran: {
    author: "B Loughran",
    initials: "BL",
    rating: 5,
    postedOn: "2026-03-05",
    postedMonth: "March 2026",
    excerpt: "Sean made the whole process straightforward and stress-free.",
  },
  helenParry: {
    author: "Helen Parry",
    initials: "HP",
    rating: 5,
    postedOn: "2026-02-26",
    postedMonth: "February 2026",
    excerpt: "work done to an incredible high standard.",
  },
  cassieWolf: {
    author: "Cassie Wolf",
    initials: "CW",
    rating: 5,
    postedOn: "2026-02-12",
    postedMonth: "February 2026",
    excerpt:
      "After many years, I needed to use it again but it was outdated and broken. Kaizen got it back up and running perfectly.",
  },
  paulTaylor: {
    author: "Paul Taylor",
    initials: "PT",
    rating: 5,
    postedOn: "2026-02-12",
    postedMonth: "February 2026",
    excerpt:
      "they were easy to work with, responsive, and delivered exactly what we needed.",
  },
} as const;

export type ReviewId = keyof typeof reviews;

export const reviewIds: readonly ReviewId[] = [
  "bLoughran",
  "helenParry",
  "cassieWolf",
  "paulTaylor",
];

/** Confirmed by Sean, 1 October 2026: docs/marketing/site-profile.md, section 3. */
export const midlandMetrics = {
  loadTime: {
    value: "1.2s",
    accessibleValue: "1.2 seconds",
    label: "Load time after the rebuild",
    detail: "Down from more than 8 seconds on the old site.",
  },
  enquiries: {
    value: "3x",
    accessibleValue: "Three times",
    label: "Enquiries in the first month",
    detail: "Three times the enquiries after the rebuild.",
  },
  years: {
    value: "40+",
    accessibleValue: "More than 40",
    label: "Years in the oil trade",
    detail: "Midland's experience, shown on its new website.",
  },
} as const;

export type MidlandMetricId = keyof typeof midlandMetrics;

/**
 * Only include a case here when its image is a real, permissioned screenshot.
 * Helen's existing stock photo is intentionally not called a screenshot.
 * Dimensions checked against the local WebP file with Sharp on 2 October 2026.
 */
export const caseStudies = {
  midland: {
    client: "Midland Oil Group",
    buyer: "For the oil trade",
    title: "Help buyers find the right oil.",
    summary: "Buyers can choose what they need with a simple oil finder.",
    result: "Several genuine enquiries a day since the rebuild.",
    href: "/case-studies/midland-oil-group/",
    websiteLabel: "midlandoilgroup.co.uk",
    screenshot: {
      src: "/images/case-studies/midland-oil-group/mog-new-homepage.webp",
      alt: "The rebuilt Midland Oil homepage with clear product choices",
      width: 2550,
      height: 1312,
    },
  },
  helen: {
    client: "Helen Moore Hairdressing",
    buyer: "For local service businesses",
    title: "Make the next booking step clear.",
    summary: "Visitors can find the salon and ask for an appointment.",
    result: "Steady bookings from new local clients since the rebuild.",
    href: "/case-studies/helen-moore-hairdressing/",
    websiteLabel: "www.helenmoorehairdressing.co.uk",
    screenshot: {
      src: "/images/case-studies/helen-moore-hairdressing/helen-homepage-2026-10-02.webp",
      alt: "Helen Moore's homepage with services and appointment buttons",
      width: 1440,
      height: 1000,
    },
  },
} as const;

export type CaseStudyId = keyof typeof caseStudies;
