export interface PageMeta {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

export const SITE_NAME = "Kaizen Web";
export const SITE_URL = "https://kaizenweb.co.uk";
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
  title: "Web Design Liverpool | Kaizen – Agile Web Development",
  description:
    "Kaizen is a Liverpool web design agency. We build fast, high-performance websites and offer Agile coaching to improve your team's workflow. No-BS, just results.",
  keywords: [
    "web design liverpool",
    "liverpool web design",
    "agile web development",
    "kaizen",
  ],
  image: DEFAULT_OG_IMAGE,
};

const pageMeta: Record<string, Partial<PageMeta>> = {
  "/": {
    title: "Web Design Liverpool | Kaizen – Agile Web Development",
    description:
      "Kaizen is a Liverpool web design agency. We build fast, high-performance websites and offer Agile coaching to improve your team's workflow. No-BS, just results.",
    keywords: [
      "web design liverpool",
      "liverpool web design",
      "agile web development",
      "kaizen",
    ],
  },
  "/services": {
    title: "Digital Services for Liverpool SMEs | Kaizen Web",
    description:
      "Explore Kaizen Web services covering website design, UX, ecommerce, local SEO, and agile consulting tailored to Liverpool startups and established SMEs.",
  },
  "/services/web-design-liverpool": {
    title: "High-Performance Web Design Liverpool | Kaizen",
    description:
      "Need web design in Liverpool? We build fast, high-performance websites using a modern stack and a straightforward Agile process. Get more leads, not more headaches.",
    keywords: [
      "web design liverpool",
      "high-performance websites",
      "react web design liverpool",
      "web design agency wirral",
    ],
  },
  "/web-design-liverpool": {
    title: "High-Performance Web Design Liverpool | Kaizen",
    description:
      "Need web design in Liverpool? We build fast, high-performance websites using a modern stack and a straightforward Agile process. Get more leads, not more headaches.",
    keywords: [
      "web design liverpool",
      "high-performance websites",
      "react web design liverpool",
      "web design agency wirral",
    ],
  },
  "/services/local-seo": {
    title: "Local SEO Services Liverpool & Wirral | Kaizen",
    description:
      "Invisible in local search? We help Liverpool & Wirral businesses dominate the Google Map Pack and get found by local customers. No jargon, just rankings.",
    keywords: [
      "local seo liverpool",
      "local seo wirral",
      "google business profile",
      "google map pack",
      "liverpool seo",
    ],
  },
  "/services/ecommerce": {
    title:
      "E-commerce Development Liverpool | Fast Headless & WooCommerce | Kaizen",
    description:
      "We build high-performance e-commerce websites for Liverpool & Wirral. Stop losing sales to a slow site. We build fast, custom, headless e-commerce stores.",
    keywords: [
      "ecommerce development liverpool",
      "headless ecommerce",
      "woocommerce liverpool",
      "shopify developer liverpool",
      "fast ecommerce",
    ],
  },
  "/services/wordpress-web-design": {
    title: "WordPress Web Design Liverpool | Fast, Secure WP Sites | Kaizen",
    description:
      "We build custom WordPress websites for Liverpool & Wirral. Get the power and familiarity of WordPress, built the right way: fast, secure, and with no bloat.",
    keywords: [
      "wordpress web design liverpool",
      "wordpress developer wirral",
      "woocommerce developer",
      "custom wordpress theme",
    ],
  },
  "/services/digital-transformation": {
    title:
      "Digital Transformation Liverpool | Business Process Automation | Kaizen",
    description:
      "We help Liverpool & Wirral businesses stop working in chaos. We automate manual tasks, fix inefficient workflows, and get your systems talking.",
    keywords: [
      "digital transformation liverpool",
      "business process automation",
      "workflow automation",
      "business automation wirral",
    ],
  },
  "/services/agile-coaching": {
    title: "Agile Coaching for Liverpool Businesses | Kaizen",
    description:
      "Stop wasting time on chaotic projects. We offer practical Agile coaching in Liverpool to help your team work smarter, faster, and more efficiently. No jargon.",
    keywords: [
      "agile coaching liverpool",
      "agile for smes",
      "fix chaotic projects",
      "agile project management",
    ],
  },
  "/agile-coaching": {
    title: "Agile Coaching for Liverpool Businesses | Kaizen",
    description:
      "Stop wasting time on chaotic projects. We offer practical Agile coaching in Liverpool to help your team work smarter, faster, and more efficiently. No jargon.",
    keywords: [
      "agile coaching liverpool",
      "agile for smes",
      "fix chaotic projects",
      "agile project management",
    ],
  },
  "/services/contract-product-owner": {
    title: "Sean McDonnell | Contract Product Owner Liverpool | Kaizen",
    description:
      "Sean McDonnell, a Liverpool-based Senior Product Owner with 10+ years' experience in iGaming & high-stakes platform migration. I deliver complex projects, on time.",
    keywords: [
      "contract product owner liverpool",
      "senior product owner",
      "agile product owner",
      "sean mcdonnell",
    ],
  },
  "/contract-product-owner": {
    title: "Sean McDonnell | Contract Product Owner Liverpool | Kaizen",
    description:
      "Sean McDonnell, a Liverpool-based Senior Product Owner with 10+ years' experience in iGaming & high-stakes platform migration. I deliver complex projects, on time.",
    keywords: [
      "contract product owner liverpool",
      "senior product owner",
      "agile product owner",
      "sean mcdonnell",
    ],
  },
  "/about": {
    title: "About Kaizen | Liverpool Web Design & Agile Experts",
    description:
      "We're not another faceless agency. Meet Sean, our founder—a local, world-class tech expert who is relentlessly focused on getting you results.",
    keywords: [
      "about kaizen",
      "sean mcdonnell",
      "liverpool tech",
      "agile expert liverpool",
    ],
  },
  "/pledge": {
    title: 'Our "No-BS" Pledge | Transparent Web Design | Kaizen',
    description:
      'Our "No-BS" Pledge. See our transparent policy on AI, pricing, and our process. No black box, no surprise bills, no excuses.',
    keywords: [
      "kaizen pledge",
      "transparent web design",
      "transparent pricing",
      "our ai policy",
    ],
  },
  "/case-studies": {
    title: "Case Studies | Liverpool Web Design Results | Kaizen",
    description:
      'Proof, not promises. See our "no-BS" case studies for Liverpool & Wirral businesses. We deliver results.',
    keywords: [
      "web design case studies",
      "liverpool web design portfolio",
      "as collections",
      "helen moore hairdressing",
    ],
  },
  "/contact": {
    title: "Contact | Kaizen | Liverpool Web Design",
    description:
      "Let's talk. Chat with us live, or book a 15-minute, no-pressure discovery call directly in our calendar.",
    keywords: ["contact kaizen", "book a call", "liverpool web design contact"],
  },
  "/blog": {
    title: "Blog | Kaizen | Web Design & Agile Insights",
    description:
      "Practical insights on web design, local SEO, and Agile project management for Liverpool & Wirral businesses.",
    keywords: [
      "web design blog",
      "agile blog",
      "local seo tips",
      "kaizen blog",
    ],
  },
  "/blog/new-kaizen-website-relaunch": {
    title: "More Than a Refresh: Why We Rebuilt the Kaizen Website",
    description:
      "We didn't just refresh our site; we tore it down to the studs. Here's why we rebuilt the Kaizen website from the ground up for speed, security, and you.",
    keywords: [
      "kaizen relaunch",
      "website rebuild",
      "new kaizen website",
      "react vite",
    ],
  },
  "/privacy-policy": {
    title: "Privacy Policy | Kaizen",
    description:
      'Our simple, "no-jargon" privacy policy. We explain what data we collect (like chat and analytics) and how we keep it safe.',
    noIndex: true,
    keywords: ["privacy policy", "gdpr", "kaizen privacy", "cookie policy"],
  },
  "/cookie-policy": {
    title: "Cookie Policy | Kaizen",
    description:
      "A simple, clear list of the cookies this site uses for chat, analytics, and booking, and why we use them.",
    noIndex: true,
    keywords: ["cookie policy", "cookie notice", "gdpr", "analytics cookies"],
  },
  "/gdpr-policy": {
    title: "GDPR Policy | Kaizen Web Liverpool",
    description:
      "Kaizen Web's GDPR commitments covering hosting, analytics, and customer data in the UK.",
    noIndex: true,
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
  "/case-studies/as-collections": {
    title: "As Collections Case Study | Kaizen Web",
    description:
      "How we helped As Collections improve their online presence and streamline operations.",
  },
  "/case-studies/helen-moore-hairdressing": {
    title: "Helen Moore Hairdressing Case Study | Kaizen Web",
    description:
      "Local hairdressing salon case study—how we built their online booking system and improved local visibility.",
  },
  "/case-studies/independent-retailer": {
    title: "Independent Retailer Case Study | Kaizen Web",
    description:
      "How we helped an independent retailer increase online sales and streamline their operations.",
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
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
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
