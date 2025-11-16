export interface PageMeta {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

export const SITE_NAME = "Kaizen Web";
export const SITE_URL = "https://www.kaizenweb.co.uk";
export const BUSINESS_PHONE = "+44 151 808 1100";
export const BUSINESS_EMAIL = "hello@kaizenweb.co.uk";
export const BUSINESS_ADDRESS = {
  street: "44 Simpson Street",
  locality: "Liverpool",
  region: "Merseyside",
  postalCode: "L1 0AX",
  country: "GB",
};
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

const defaultMeta: PageMeta = {
  title: "Kaizen Web | Liverpool Web Design & Local SEO Agency",
  description:
    "Kaizen Web is a Liverpool-based web design studio helping Merseyside businesses launch faster websites, smarter digital products, and measurable SEO campaigns.",
  keywords: [
    "Kaizen Web",
    "Liverpool web design agency",
    "Liverpool SEO",
    "Liverpool digital transformation",
    "Merseyside web design",
  ],
  image: DEFAULT_OG_IMAGE,
};

const pageMeta: Record<string, Partial<PageMeta>> = {
  "/": {
    title: "Kaizen Web | Liverpool Web Design & Growth Partner",
    description:
      "Liverpool web design agency delivering fast sites, conversion copy, and ongoing optimisation for ambitious businesses across the city and wider Merseyside.",
    keywords: [
      "Liverpool web design",
      "Liverpool website agency",
      "Kaizen Web",
      "Merseyside digital agency",
      "Baltic Triangle web studio",
    ],
  },
  "/services": {
    title: "Digital Services for Liverpool SMEs | Kaizen Web",
    description:
      "Explore Kaizen Web services covering website design, UX, ecommerce, local SEO, and agile consulting tailored to Liverpool startups and established SMEs.",
    keywords: [
      "Liverpool digital services",
      "Liverpool UX agency",
      "Liverpool ecommerce developers",
    ],
  },
  "/services/web-design": {
    title: "Liverpool Web Design Services | Kaizen Web",
    description:
      "Bespoke Liverpool web design packages focused on speed, accessibility, and conversions with hosting, care plans, and continuous optimisation.",
    keywords: [
      "Liverpool WordPress agency",
      "Liverpool web design packages",
      "Liverpool website redesign",
    ],
  },
  "/services/local-seo": {
    title: "Liverpool Local SEO Agency | Kaizen Web",
    description:
      "Boost search visibility across Liverpool postcodes with structured data, GBP optimisation, and content sprints run by Kaizen Web's local SEO specialists.",
    keywords: [
      "Liverpool local SEO",
      "Liverpool Google Business Profile",
      "Liverpool SEO experts",
    ],
  },
  "/services/digital-transformation": {
    title: "Digital Transformation Consultants Liverpool | Kaizen Web",
    description:
      "Product and process consulting for Liverpool teams needing faster delivery cycles, lean experimentation, and pragmatic automation.",
  },
  "/services/ecommerce": {
    title: "Liverpool Ecommerce Website Design | Kaizen Web",
    description:
      "Shopify and headless ecommerce builds designed in Liverpool with UX research, CRO, and lifecycle marketing baked in from day one.",
  },
  "/services/wordpress-web-design": {
    title: "WordPress Web Design Liverpool | Fast, Secure WP Sites | Kaizen",
    description:
      "We build custom WordPress websites for Liverpool & Wirral. Get the power and familiarity of WordPress, built the right way: fast, secure, and with no bloat.",
    keywords: [
      "WordPress web design Liverpool",
      "Custom WordPress sites",
      "Fast WordPress development",
      "Liverpool WordPress agency",
    ],
  },
  "/contract-product-owner": {
    title: "Contract Product Owner Liverpool | Kaizen Web",
    description:
      "Certified product owners supporting Liverpool tech squads with discovery workshops, prioritisation, and stakeholder coaching.",
  },
  "/about": {
    title: "About Kaizen Web | Liverpool Web Studio",
    description:
      "Learn more about Kaizen Web, a Liverpool-based collective of designers, strategists, and engineers focused on sustainable digital growth.",
  },
  "/pledge": {
    title: "Our \"No-BS\" Pledge | Transparent Web Design | Kaizen",
    description:
      "Our No-BS Pledge. See our transparent policy on AI, pricing, and our process. No black box, no surprise bills, no excuses.",
  },
  "/agile-coaching": {
    title: "Agile Coaching for Liverpool Teams | Kaizen Web",
    description:
      "Agile and delivery coaching so Liverpool engineering, marketing, and leadership teams can experiment confidently.",
  },
  "/product-owner": {
    title: "Fractional Product Owner Liverpool | Kaizen Web",
    description:
      "Fractional product ownership and discovery facilitation for Liverpool startups that need strategic delivery without full-time overhead.",
  },
  "/team-transformation": {
    title: "Team Transformation & Delivery Coaching Liverpool | Kaizen Web",
    description:
      "Bridge strategy and execution with Kaizen Web's delivery coaching programmes tailored to Liverpool organisations.",
  },
  "/web-design-liverpool": {
    title: "Liverpool Web Design Agency | Kaizen Web",
    description:
      "Deep-dive into our Liverpool web design process, packages, and proof showing how Kaizen Web turns clicks into local customers.",
    keywords: [
      "Liverpool city centre web design",
      "Liverpool website consultants",
      "Kaizen Web Liverpool",
    ],
  },
  "/web-design-liverpool-city-centre": {
    title: "Web Design Liverpool City Centre | Kaizen Web",
    description:
      "Studio based near the Baltic Triangle helping city centre retailers, hospitality, and creative businesses modernise their sites.",
  },
  "/case-studies": {
    title: "Liverpool Web Design Case Studies | Kaizen Web",
    description:
      "Results from Kaizen Web projects across property, legal, trades, and hospitality sectors in Liverpool.",
  },
  "/blog": {
    title: "Kaizen Web Journal | Liverpool Web Design Tips",
    description:
      "Guides on UX, performance, SEO, and agile delivery from a Liverpool web design team.",
  },
  "/contact": {
    title: "Contact Kaizen Web | Book a Liverpool Web Design Call",
    description:
      "Discuss your next Liverpool website, SEO campaign, or product sprint with Kaizen Web. Same-week discovery calls available.",
  },
  "/privacy-policy": {
    title: "Privacy Policy | Kaizen Web Liverpool",
    description:
      "Understand how Kaizen Web collects, uses, and protects data for clients and subscribers.",
    noIndex: true,
  },
  "/gdpr-policy": {
    title: "GDPR Policy | Kaizen Web Liverpool",
    description:
      "Kaizen Web's GDPR commitments covering hosting, analytics, and customer data in the UK.",
    noIndex: true,
  },
};

type DynamicMetaMatcher = {
  test: (pathname: string) => boolean;
  meta: Partial<PageMeta>;
};

const dynamicMeta: DynamicMetaMatcher[] = [
  {
    test: (pathname) => pathname.startsWith("/blog/"),
    meta: {
      title: "Liverpool Web Design Insights | Kaizen Web Blog",
      description:
        "Articles and guides from the Kaizen Web Liverpool team covering SEO, UX, content design, and agile ways of working.",
    },
  },
  {
    test: (pathname) => pathname.startsWith("/admin"),
    meta: {
      title: "Admin | Kaizen Web",
      description: "Restricted Kaizen Web admin tools.",
      noIndex: true,
    },
  },
];

const mergeMeta = (override: Partial<PageMeta> | undefined): PageMeta => {
  if (!override) {
    return { ...defaultMeta };
  }

  return {
    ...defaultMeta,
    ...override,
    keywords: override.keywords ?? defaultMeta.keywords,
    image: override.image ?? defaultMeta.image,
  };
};

export const getPageMeta = (pathname: string): PageMeta => {
  const normalizedPath = pathname === "" ? "/" : pathname;
  const exact = pageMeta[normalizedPath];

  if (exact) {
    return mergeMeta(exact);
  }

  const match = dynamicMeta.find((entry) => entry.test(normalizedPath));
  if (match) {
    return mergeMeta(match.meta);
  }

  return { ...defaultMeta };
};

export const buildLocalBusinessSchema = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: SITE_NAME,
  image: DEFAULT_OG_IMAGE,
  url: SITE_URL,
  telephone: BUSINESS_PHONE,
  email: BUSINESS_EMAIL,
  description,
  address: {
    "@type": "PostalAddress",
    streetAddress: BUSINESS_ADDRESS.street,
    addressLocality: BUSINESS_ADDRESS.locality,
    addressRegion: BUSINESS_ADDRESS.region,
    postalCode: BUSINESS_ADDRESS.postalCode,
    addressCountry: BUSINESS_ADDRESS.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 53.4084,
    longitude: -2.9916,
  },
  areaServed: {
    "@type": "City",
    name: "Liverpool",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  priceRange: "$$",
  sameAs: [
    "https://www.linkedin.com/company/kaizen-web",
    "https://www.instagram.com/kaizenwebliverpool",
    "https://twitter.com/kaizenweblpool",
  ],
});
