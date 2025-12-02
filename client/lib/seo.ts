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
  title: "Web Design Liverpool & Wirral | Kaizen – Agile Web Development",
  description:
    "Kaizen is a Liverpool and Wirral web design agency. We build fast, high-performance websites and offer Agile coaching to improve your team's workflow. No-BS, just results.",
  keywords: [
    "web design liverpool",
    "web design wirral",
    "liverpool web design",
    "agile web development",
    "kaizen",
  ],
  image: DEFAULT_OG_IMAGE,
};

const pageMeta: Record<string, Partial<PageMeta>> = {
  "/": {
    title: "Web Design Liverpool & Wirral | 2025 Pricing | Kaizen",
    description:
      "Premium Web Design for Liverpool. AI-Augmented React & WordPress builds led by Contract Product Owners. Fixed price quotes, no fluff.",
    keywords: [
      "web design liverpool",
      "web design wirral",
      "web design liverpool and wirral",
      "web design merseyside",
      "product owner-led web design",
      "agile web development",
      "kaizen",
      "high-performance websites",
      "web design pricing",
      "liverpool web designer",
    ],
  },
  "/services": {
    title:
      "Digital Services Liverpool | Web Design & Product Strategy | Kaizen",
    description:
      "A product-led digital agency. Specialising in React Development, Software Rescue, and Agile Consultancy for Liverpool & Wirral SMEs.",
  },
  "/services/web-design-liverpool": {
    title: "High-Performance Web Design Liverpool | Kaizen",
    description:
      "Need web design in Liverpool? We build fast, high-performance websites with a straightforward Agile process. Get more leads, not more headaches.",
    keywords: [
      "web design liverpool",
      "high-performance websites",
      "react web design liverpool",
      "web design agency wirral",
    ],
  },
  "/web-design-liverpool-city-centre": {
    title: "Web Design Liverpool City Centre | Kaizen Web",
    description:
      "City centre web design for Liverpool businesses that need fast, conversion-focused sites with clear messaging and transparent pricing.",
    keywords: [
      "web design liverpool city centre",
      "liverpool city centre web design",
      "city centre websites",
      "liverpool web design",
    ],
  },
  "/web-design-wirral": {
    title: "Web Design Wirral | Heswall, West Kirby & Birkenhead | Kaizen Web",
    description:
      "Web design for Heswall, West Kirby and Birkenhead businesses. Fast, conversion-focused sites with clear pricing and no fluff.",
    keywords: [
      "web design wirral",
      "web design heswall",
      "web design west kirby",
      "web design birkenhead",
      "wirral web design",
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
    title: "Shopify Experts Liverpool & Custom Ecommerce Development | Kaizen",
    description:
      "High-performance ecommerce. From Shopify setups to complex custom WooCommerce builds. We architect stores that convert.",
    keywords: [
      "ecommerce development liverpool",
      "headless ecommerce",
      "woocommerce liverpool",
      "shopify developer liverpool",
      "fast ecommerce",
    ],
  },
  "/services/wordpress-web-design": {
    title: "Bespoke WordPress Development Liverpool | Kaizen",
    description:
      "Custom WordPress theme development. No templates. We use AI-augmented coding to build fast, secure, and scalable sites managed by Product Owners.",
    keywords: [
      "wordpress web design liverpool",
      "wordpress developer wirral",
      "woocommerce developer",
      "custom wordpress theme",
    ],
  },
  "/services/digital-transformation": {
    title: "Digital Transformation Liverpool | Business Automation | Kaizen",
    description:
      "We don't just build websites; we automate businesses. AI-integrated workflows and custom software to reduce admin time by up to 40%.",
    keywords: [
      "digital transformation liverpool",
      "business process automation",
      "workflow automation",
      "business automation wirral",
    ],
  },
  "/services/agile-coaching": {
    title: "Agile Coaching Liverpool | Scrum & Kanban Consultancy | Kaizen",
    description:
      "Real Agile. No waffle. We coach Liverpool teams to move from chaotic workflows to strict sprints, improving delivery speed and team morale.",
    keywords: [
      "agile coaching liverpool",
      "agile for smes",
      "fix chaotic projects",
      "agile project management",
    ],
  },
  "/agile-coaching": {
    title: "Agile Coaching Liverpool | Scrum & Kanban Consultancy | Kaizen",
    description:
      "Real Agile. No waffle. We coach Liverpool teams to move from chaotic workflows to strict sprints, improving delivery speed and team morale.",
    keywords: [
      "agile coaching liverpool",
      "agile for smes",
      "fix chaotic projects",
      "agile project management",
    ],
  },
  "/services/contract-product-owner": {
    title:
      "Contract Product Owner Liverpool | Agile Delivery & Strategy | Kaizen",
    description:
      "Stop hiring 'Yes Men'. Our Contract Product Owners prioritise ROI, manage the backlog, and ensure your software solves the actual business problem.",
    keywords: [
      "contract product owner liverpool",
      "senior product owner",
      "agile product owner",
      "sean mcdonnell",
    ],
  },
  "/contract-product-owner": {
    title:
      "Contract Product Owner Liverpool | Agile Delivery & Strategy | Kaizen",
    description:
      "Stop hiring 'Yes Men'. Our Contract Product Owners prioritise ROI, manage the backlog, and ensure your software solves the actual business problem.",
    keywords: [
      "contract product owner liverpool",
      "senior product owner",
      "agile product owner",
      "sean mcdonnell",
    ],
  },
  "/project-rescue": {
    title: "Software Project Rescue Services Liverpool | Code Audits | Kaizen",
    description:
      "Stalled build? We fix failing software projects. Our AI diagnostics audit legacy code in minutes to help you decide: Rescue or Rebuild?",
    keywords: [
      "project rescue liverpool",
      "contract product owner",
      "failing web projects",
      "agile rescue",
      "product ownership",
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
  "/web-design-wirral": {
    title: "Web Design Wirral | Bespoke Web Design | Kaizen",
    description:
      "Don't settle for slow templates. Kaizen build high-performance, bespoke web design for Wirral React speed, easy to maintain, local, fixed pricing. Book a demo.",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630",
    keywords: [
      "bespoke web design wirral",
      "web design wirral",
      "wirral websites",
      "web design heswall",
      "web design west kirby",
      "web design birkenhead",
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
  "/thank-you": {
    title: "Thank You | Kaizen Web Liverpool",
    description:
      "Thanks for getting in touch with Kaizen Web. We'll respond quickly with practical next steps for your Liverpool or Wirral project.",
    noIndex: true,
    keywords: ["thank you", "enquiry received", "kaizen web"],
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
  "/case-studies/kaizen-rebuild": {
    title: "Kaizen Web Rebuild Case Study | React + Vite Migration",
    description:
      "A technical deep dive into how we migrated Kaizen Web from a legacy setup to a high-performance React + Vite + Headless architecture.",
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
  "@type": ["ProfessionalService", "LocalBusiness", "Organization"],
  name: SITE_NAME,
  alternateName: "Kaizen",
  legalName: "Kaizen Web",
  image: DEFAULT_OG_IMAGE,
  logo: {
    "@type": "ImageObject",
    url: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F19f6366118ef41298050443945090b5f?format=webp&width=800",
    width: 800,
    height: 800,
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
    latitude: 53.4084,
    longitude: -2.9916,
  },
  areaServed: [
    {
      "@type": "City",
      name: "Liverpool",
    },
    {
      "@type": "City",
      name: "Wirral",
    },
    {
      "@type": "AdministrativeArea",
      name: "Merseyside",
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
  priceRange: "$$",
  foundingDate: "2020",
  foundingLocation: "Liverpool, UK",
  sameAs: [
    "https://www.linkedin.com/company/kaizen-web",
    "https://www.instagram.com/kaizenwebliverpool",
    "https://twitter.com/kaizenweblpool",
    "https://www.crunchbase.com/organization/kaizen-web",
  ],
});
