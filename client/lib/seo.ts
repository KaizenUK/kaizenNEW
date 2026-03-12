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
  street: "103 Old Hall Street",
  locality: "Liverpool",
  region: "Merseyside",
  postalCode: "L3 9BP",
  country: "GB",
};
export const DEFAULT_OG_IMAGE =
  "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630";

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
    title: "Web Design & Performance Experts | Kaizen Web",
    description:
      "We make websites faster, better designed, and easier to find on Google. Web design, performance auditing, and product ownership — no jargon, just results.",
    keywords: [
      "web design agency",
      "website performance",
      "core web vitals",
      "website speed optimisation",
      "product owner for hire",
      "performance audit",
      "kaizen web",
      "web design uk",
      "fast websites",
      "wordpress optimisation",
    ],
  },
  "/services": {
    title:
      "Digital Services Liverpool | Web Design & Product Strategy | Kaizen",
    description:
      "A product-led digital agency. Specialising in React Development, Software Rescue, and Agile Consultancy for Liverpool & Wirral SMEs.",
  },
  "/web-design-liverpool": {
    title: "Web Design Liverpool | Fast Sites That Bring in Work",
    description:
      "Websites for Liverpool businesses who need more customers. Fast, professional, built to rank on Google. From £2k. City Centre to Merseyside.",
    keywords: [
      "web design liverpool",
      "liverpool web design",
      "web designer liverpool",
      "fast websites liverpool",
      "liverpool city centre web design",
      "commercial district websites",
    ],
  },
  "/web-design-chester": {
    title: "Web Design Chester | Trusted Sites for Law & Finance",
    description:
      "Professional websites for Chester law firms and financial advisors. Fast, secure, built to win client trust. Business Park to City Centre.",
    keywords: [
      "web design chester",
      "chester web design",
      "web designer chester",
      "chester business park web design",
      "law firm web design chester",
      "financial advisor websites",
      "professional services chester",
    ],
  },
  "/web-design-warrington": {
    title: "Web Design Warrington | Sites Built for Business",
    description:
      "Reliable websites for Warrington businesses. Fast, professional, no fuss. Perfect for logistics, manufacturing, and trade firms. Omega to Town Centre.",
    keywords: [
      "web design warrington",
      "warrington web design",
      "web designer warrington",
      "omega business park websites",
      "birchwood park web design",
      "warrington logistics websites",
      "manufacturing web design",
    ],
  },
  "/services/web-design-liverpool": {
    title: "Enterprise Web Design Liverpool | React & Next.js Developers",
    description:
      "We build high-performance React websites for Liverpool's Commercial District and Knowledge Quarter. Faster, safer, and more profitable than WordPress.",
    keywords: [
      "web design liverpool",
      "enterprise web design",
      "react development liverpool",
      "high-performance websites",
      "commercial district web design",
    ],
  },
  "/web-design-liverpool-city-centre": {
    title: "Web Design Liverpool City Centre | Kaizen",
    description:
      "City centre web design for Liverpool businesses that need fast, conversion-focused sites with clear messaging and transparent pricing.",
    keywords: [
      "web design liverpool city centre",
      "liverpool city centre web design",
      "city centre websites",
      "liverpool web design",
    ],
  },
  "/services/local-seo": {
    title: "Local SEO Liverpool | Sites That Work & Rank | Kaizen",
    description:
      "Local SEO starts with a fast website, not keywords. We build sites people want to use, then make sure Google finds them. Liverpool & Wirral.",
    keywords: [
      "local seo liverpool",
      "local seo wirral",
      "google business profile",
      "google map pack",
      "liverpool seo",
    ],
  },
  "/services/ecommerce": {
    title: "Shopify Experts Liverpool & Custom Ecommerce | Kaizen",
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
    title: "WordPress Web Design Liverpool | Fast & Easy to Edit",
    description:
      "Custom WordPress sites for Liverpool businesses. Fast, secure, and easy to update yourself. No bloated themes, just clean code that works.",
    keywords: [
      "wordpress web design liverpool",
      "wordpress developer wirral",
      "custom wordpress sites",
      "fast wordpress",
      "woocommerce liverpool",
    ],
  },
  "/digital-transformation": {
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
  "/contract-product-owner": {
    title:
      "Contract Product Owner Liverpool | Agile Strategy | Kaizen",
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
    title: "Web Design Wirral | Local Sites That Get Results",
    description:
      "Fast, professional websites for Wirral businesses. From Heswall to Birkenhead, we build sites that rank on Google and bring in customers.",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F094cdc9be84c41ee9db80308cbe5ea73?format=webp&width=1200&height=630",
    keywords: [
      "web design wirral",
      "wirral web designer",
      "web design heswall",
      "web design west kirby",
      "web design birkenhead",
      "local websites wirral",
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
    title: "Thank You | Kaizen",
    description:
      "Thanks for getting in touch with Kaizen. We'll respond quickly with practical next steps for your Liverpool or Wirral project.",
    noIndex: true,
    keywords: ["thank you", "enquiry received", "kaizen"],
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
    title: "GDPR Policy | Kaizen",
    description:
      "Kaizen's GDPR commitments covering hosting, analytics, and customer data in the UK.",
    noIndex: true,
  },
  "/case-studies/as-collections": {
    title: "As Collections Case Study | Kaizen",
    description:
      "How we helped As Collections improve their online presence and streamline operations.",
  },
  "/case-studies/helen-moore-hairdressing": {
    title: "Helen Moore Hairdressing Case Study | Kaizen",
    description:
      "Local hairdressing salon case study—how we built their online booking system and improved local visibility.",
  },
  "/case-studies/independent-retailer": {
    title: "Independent Retailer Case Study | Kaizen",
    description:
      "How we helped an independent retailer increase online sales and streamline their operations.",
  },
  "/case-studies/kaizen-rebuild": {
    title: "Kaizen Rebuild Case Study | React + Vite Migration",
    description:
      "A technical deep dive into how we migrated Kaizen Web from a legacy setup to a high-performance React + Vite + Headless architecture.",
  },
  "/case-studies/midland-oil-group": {
    title: "Midland Oil Group Case Study | Kaizen Web",
    description:
      "How we rebuilt Midland Oil Group's digital presence — replacing a slow WordPress site with a custom platform, AI-powered oil finder, and sector-first navigation.",
  },
  "/performance-scanner": {
    title: "Free Website Speed Test | Check Your Google PageSpeed Score",
    description:
      "Is your slow website costing you customers? Run a free Google PageSpeed test and check your Core Web Vitals. Get instant results and fix your mobile site speed today.",
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
      title: "Liverpool Web Design Insights | Kaizen Blog",
      description:
        "Articles and guides from the Kaizen Liverpool team covering SEO, UX, content design, and agile ways of working.",
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
