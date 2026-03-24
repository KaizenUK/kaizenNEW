export interface PageMeta {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}

export const SITE_NAME = "Kaizen Web";
export const SITE_URL = "https://kaizenweb.co.uk";
export const BUSINESS_PHONE = "+44 151 453 0008";
export const BUSINESS_PHONE_HREF = `tel:${BUSINESS_PHONE.replace(/\s+/g, "")}`;
export const BUSINESS_EMAIL = "hello@kaizenweb.co.uk";
export const BUSINESS_ADDRESS = {
  street: "103 Old Hall Street",
  locality: "Liverpool",
  region: "Merseyside",
  postalCode: "L3 9BP",
  country: "GB",
};
export const DEFAULT_OG_IMAGE =
  "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630";

const defaultMeta: PageMeta = {
  title:
    "WordPress Rebuilds, Technical SEO & Product Leadership | Kaizen Web",
  description:
    "Kaizen is a UK web consultancy focused on high-performance websites, technical SEO foundations, WordPress rebuilds, and hands-on product leadership.",
  keywords: [
    "wordpress rebuilds",
    "technical seo",
    "product owner consultancy",
    "website performance audit",
    "kaizen",
  ],
  image: DEFAULT_OG_IMAGE,
};

const pageMeta: Record<string, Partial<PageMeta>> = {
  "/": {
    title: "Web Design & Website Performance Optimisation | Kaizen Web",
    description:
      "We build websites that look outstanding, convert your customers and perform with awe. From WordPress optimisation to performance audits, Kaizen has you covered",
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
  "/services/local-seo": {
    title: "Local SEO | Fix Your Site, Fix Your Rankings | Kaizen Web",
    description:
      "We are not an SEO agency. But, if your site is struggling to rank despite you paying monthly for it, the site is the issue. Kaizen fixes your foundations.",
    keywords: [
      "local seo",
      "core web vitals",
      "technical seo",
      "page speed",
      "google business profile",
      "site not ranking",
    ],
  },
  "/services/wordpress-web-design": {
    title: "WordPress Web Design | Fast, Easy to Run Sites | Kaizen",
    description:
      "Rebuild? Improve? Migrate? We have 3 clear paths to guide you to a decent, custom coded website. Fix a slow WordPress or build something better.",
    keywords: [
      "wordpress web design",
      "wordpress migration",
      "custom wordpress sites",
      "fast wordpress",
      "technical wordpress agency",
    ],
  },
  "/contract-product-owner": {
    title:
      "Contract Product Owner | Delivery Leadership | Kaizen",
    description:
      "Stop hiring 'Yes Men'. Our Contract Product Owners prioritise ROI, manage the backlog, and ensure your software solves the actual business problem.",
    keywords: [
      "contract product owner",
      "senior product owner",
      "agile product owner",
      "delivery leadership",
    ],
  },
  "/about": {
    title: "About Kaizen | Web Performance & Delivery Leadership",
    description:
      "We're not another faceless agency. Meet Sean, our founder, and see how Kaizen approaches web performance, technical clarity, and commercial delivery.",
    keywords: [
      "about kaizen",
      "sean mcdonnell",
      "web consultancy",
      "product delivery",
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
    title: "Case Studies | Kaizen Web",
    description:
      "Proof, not promises. Two public case studies showing the kind of rebuild, technical SEO foundation work, and delivery clarity Kaizen wants more of.",
    keywords: [
      "web design case studies",
      "midland oil group",
      "helen moore hairdressing",
    ],
  },
  "/contact": {
    title: "Contact | Kaizen Web",
    description:
      "Let's talk. Send us a message, tell us where the site or delivery process is hurting, and we will come back with clear next steps.",
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
    title: "Blog | Kaizen | Performance, SEO & Delivery Insights",
    description:
      "Practical insights on website performance, technical SEO, WordPress rebuilds, and delivery leadership.",
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
    title: "Helen Moore Hairdressing Case Study | Kaizen",
    description:
      "Local hairdressing salon case study—how we built their online booking system and improved local visibility.",
  },
  "/case-studies/midland-oil-group": {
    title: "Midland Oil Group Case Study | Kaizen Web",
    description:
      "How we rebuilt Midland Oil Group - from a sluggish, confusing WordPress to high-end tech platform that transformed the business.",
  },
  "/products/consign-comply": {
    title:
      "Consign Comply | Digital Hazardous Waste Consignment Notes",
    description:
      "Replace paper consignment notes with a legally compliant digital system. Built around the official HWCN01v112 form. Offline driver portal, digital signatures, automatic PDF generation.",
    noIndex: true,
    keywords: [
      "hazardous waste consignment notes",
      "digital consignment notes",
      "HWCN01v112",
      "waste carrier compliance",
      "consign comply",
    ],
  },
  "/performance-scanner": {
    title: "Free Website Speed Test | Check Your Google PageSpeed Score",
    description:
      "Your slow website is costing you customers. Run a free PageSpeed check to find out what is holding you back and fixes. Instant results. Fix your site speed now.",
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

export const buildLocalBusinessSchema = (description: string) => ({
  "@context": "https://schema.org",
  "@type": ["ProfessionalService", "LocalBusiness", "Organization"],
  name: SITE_NAME,
  alternateName: "Kaizen",
  legalName: "Kaizen",
  image: DEFAULT_OG_IMAGE,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo.svg`,
    width: 500,
    height: 150,
  },
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
  latitude: 53.4114,
  longitude: -2.9935,
},
areaServed: [
    // Core Cities
    {
      "@type": "City",
      name: "Liverpool",
    },
    {
      "@type": "City",
      name: "Chester",
    },
    {
      "@type": "City",
      name: "Warrington",
    },
    {
      "@type": "City",
      name: "St Helens",
    },
    {
      "@type": "City",
      name: "Southport",
    },

    // Regions (The "Net")
    {
      "@type": "AdministrativeArea",
      name: "Wirral",
    },
    {
      "@type": "AdministrativeArea",
      name: "Merseyside",
    },
    {
      "@type": "AdministrativeArea",
      name: "Cheshire",
    },
    {
      "@type": "AdministrativeArea",
      name: "North Wales",
    },
    {
      "@type": "Country",
      name: "United Kingdom",
    },
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  priceRange: "££",
  foundingDate: "2026",
  foundingLocation: "Wirral, UK",
  sameAs: [
    // Socials
    "https://www.linkedin.com/company/kaizen-uk",
    "https://www.instagram.com/kaizen.web.uk/",

    // Core Trust Signals (Government & Maps)
    "https://find-and-update.company-information.service.gov.uk/company/17007703",
    "https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE",

    // Verified Directories & Reviews
    "https://clutch.co/profile/kaizen-2",
    "https://www.provenexpert.com/kaizen/",
    "https://www.yell.com/biz/kaizen-liverpool-10997636/",
    "https://the-dots.com/pages/kaizen-845569",
    "https://www.techdirectory.io/united-kingdom/liverpool/information-technology/kaizen",
    "https://www.hotfrog.co.uk/company/a0cc9bb7a4178a6dbe399d88c7d1bbce/kaizen/liverpool/web-design",
  ],
});
