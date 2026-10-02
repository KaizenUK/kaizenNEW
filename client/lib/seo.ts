import { LEGAL_COMPANY_NAME } from "../../shared/legal";
export interface PageMeta {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

export const SITE_NAME = "Kaizen Web";
export const SITE_URL = "https://kaizenweb.co.uk";
export const BUSINESS_EMAIL = "hello@kaizenweb.co.uk";
// Kaizen travels to clients and has no address customers can visit, so no
// business address is published (Google service-area rules). The registered
// office is a legal detail and lives in shared/legal.ts.
export const SERVICE_AREAS_SUMMARY = "Merseyside and West Yorkshire";
export const DEFAULT_OG_IMAGE =
  "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630";

const defaultMeta: PageMeta = {
  title:
    "Web Design and Product Owner Support | Kaizen Web",
  description:
    "We build and improve business websites. We also help owners get software projects back on track.",
  keywords: [
    "wordpress rebuilds",
    "product owner consultancy",
    "website performance audit",
    "kaizen",
  ],
  image: DEFAULT_OG_IMAGE,
};

const pageMeta: Record<string, Partial<PageMeta>> = {
  "/": {
    title: "Web Design That Loads Fast and Brings In Work | Kaizen Web",
    description:
      "We design, build and fix websites for businesses. Fast pages, clear words and a site that makes it easy for customers to get in touch.",
    keywords: [
      "website not converting visitors",
      "wordpress site running slow",
      "website performance audit",
      "small business web design uk",
      "improve google page speed score",
      "wordpress speed optimisation",
      "website losing customers",
      "core web vitals failing",
      "hire a product owner",
      "web design for small business",
      "fix slow wordpress site",
      "website redesign agency",
    ],
  },
  "/services/wordpress-web-design": {
    title: "WordPress Web Design: Fix, Rebuild or Move | Kaizen Web",
    description:
      "Is your WordPress site slow or hard to update? We can speed it up, rebuild it properly or move you to a faster custom site, and we'll say which fits.",
    keywords: [
      "wordpress web design",
      "wordpress migration",
      "custom wordpress sites",
      "fast wordpress",
      "technical wordpress agency",
    ],
  },
  "/contract-product-owner": {
    title: "Contract Product Owner for Hire | Kaizen Web",
    description:
      "Software project drifting? A contract product owner sets the priorities, keeps the work moving and makes sure what gets built is what you need.",
    keywords: [
      "contract product owner",
      "senior product owner",
      "agile product owner",
      "delivery leadership",
    ],
  },
  "/about": {
    title: "About Kaizen Web | How We Work",
    description:
      "Kaizen means continuous improvement. You deal with the same person from first call to launch, in plain English, with advice before any invoice.",
    keywords: [
      "about kaizen",
      "sean mcdonnell",
      "web consultancy",
      "product delivery",
    ],
  },
  "/pledge": {
    title: "What to Expect Before You Commit | The Kaizen Pledge",
    description:
      "What working with Kaizen looks like, in writing, before you commit to anything: how pricing works, how we use AI and what happens if the scope changes.",
    keywords: [
      "kaizen pledge",
      "transparent web design",
      "transparent pricing",
      "our ai policy",
    ],
  },
  "/case-studies": {
    title: "Web Design Case Studies | Kaizen Web",
    description:
      "Real websites we have built and fixed, and what changed for each business. See the Midland Oil Group and Helen Moore Hairdressing projects.",
    keywords: [
      "web design case studies",
      "midland oil group",
      "helen moore hairdressing",
    ],
  },
  "/contact": {
    title: "Contact Kaizen Web | Talk About Your Website",
    description:
      "Tell us what is wrong with your website, or what you need from a new one. We will come back with clear next steps, in plain English.",
    keywords: ["contact kaizen", "website consultancy contact"],
  },
  "/thank-you": {
    title: "Thank You | Kaizen",
    description:
      "Thanks for getting in touch with Kaizen. We'll respond quickly with practical next steps for your project.",
    noIndex: true,
    keywords: ["thank you", "enquiry received", "kaizen"],
  },
  "/blog": {
    title: "Website Guides for Business Owners | Kaizen Web",
    description:
      "Plain-English guides to website speed, search and getting more enquiries from your website.",
    keywords: [
      "website performance blog",
      "technical seo blog",
      "wordpress rebuild guide",
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
      "A simple, clear list of the cookies this site uses for chat and analytics, and why we use them.",
    noIndex: true,
    keywords: ["cookie policy", "cookie notice", "gdpr", "analytics cookies"],
  },
  "/gdpr-policy": {
    title: "GDPR Policy | Kaizen",
    description:
      "Kaizen's GDPR commitments covering hosting, analytics, and customer data in the UK.",
    noIndex: true,
  },
  "/case-studies/helen-moore-hairdressing": {
    title: "Salon Website Case Study: Helen Moore Hairdressing | Kaizen",
    description:
      "How we rebuilt a Wallasey salon's website so people can go from social media to a booked appointment in a few taps, and find it in local search.",
  },
  "/case-studies/midland-oil-group": {
    title: "Midland Oil Group Case Study | Kaizen Web",
    description:
      "How we rebuilt Midland Oil Group's website to help buyers find the right oil. Real before-and-after screens, an oil finder and three times the enquiries.",
  },
  "/performance-scanner": {
    title: "Free Website Speed Test for Business Sites | Kaizen Web",
    description:
      "Test how fast your website loads on a phone. See what is slowing it down and what to fix first, in plain English. Free.",
    keywords: [
      "google pagespeed insights",
      "core web vitals",
      "mobile site speed",
      "fix slow website",
      "wordpress speed optimization",
      "improve google ranking",
      "lcp score",
      "website conversion rate",
      "seo audit tool",
      "free speed test",
      "website performance",
    ],
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
      title: "Website Performance Insights | Kaizen Blog",
      description:
        "Articles and guides from Kaizen covering performance, SEO, WordPress, UX, and delivery decisions.",
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

// Organisation, not LocalBusiness: LocalBusiness needs a street address, and a
// service-area business must not publish one (seo-strategy, "Local SEO").
export const buildOrganizationSchema = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  alternateName: "Kaizen",
  legalName: LEGAL_COMPANY_NAME,
  image: DEFAULT_OG_IMAGE,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo.svg`,
    width: 500,
    height: 150,
  },
  url: SITE_URL,
  email: BUSINESS_EMAIL,
  description,
  areaServed: [
    // Merseyside and nearby
    { "@type": "City", name: "Liverpool" },
    { "@type": "City", name: "Chester" },
    { "@type": "City", name: "Warrington" },
    { "@type": "City", name: "St Helens" },
    { "@type": "City", name: "Southport" },
    { "@type": "AdministrativeArea", name: "Wirral" },
    { "@type": "AdministrativeArea", name: "Merseyside" },
    { "@type": "AdministrativeArea", name: "Cheshire" },
    { "@type": "AdministrativeArea", name: "North Wales" },
    // West Yorkshire (added 1 Oct 2026)
    { "@type": "City", name: "Leeds" },
    { "@type": "City", name: "Bradford" },
    { "@type": "Place", name: "Cleckheaton" },
    { "@type": "Place", name: "Gomersal" },
    { "@type": "AdministrativeArea", name: "West Yorkshire" },
    { "@type": "Country", name: "United Kingdom" },
  ],
  foundingDate: "2026",
  sameAs: [
    // Socials
    "https://www.linkedin.com/company/kaizen-uk",
    "https://www.instagram.com/kaizen.web.uk/",

    // Company record and Google Business Profile
    "https://find-and-update.company-information.service.gov.uk/company/17007703",
    "https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE",

    // Directories and reviews
    "https://clutch.co/profile/kaizen-2",
    "https://www.provenexpert.com/kaizen/",
    "https://www.yell.com/biz/kaizen-liverpool-10997636/",
    "https://the-dots.com/pages/kaizen-845569",
    "https://www.techdirectory.io/united-kingdom/liverpool/information-technology/kaizen",
    "https://www.hotfrog.co.uk/company/a0cc9bb7a4178a6dbe399d88c7d1bbce/kaizen/liverpool/web-design",
  ],
});
