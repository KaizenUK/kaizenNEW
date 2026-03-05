export type DesktopMenuKey =
  | "pages"
  | "services"
  | "insights"
  | "case-studies"
  | "about";

export interface ServiceItem {
  label: string;
  href: string;
  description: string;
  highlight?: boolean;
}

export interface ServiceColumn {
  title: string;
  items: ServiceItem[];
}

const pagesMenu: ServiceColumn[] = [
  {
    title: "Core Pages",
    items: [
      {
        label: "Home",
        href: "/",
        description: "Kaizen front page.",
      },
      {
        label: "About",
        href: "/about",
        description: "How we work and what we deliver.",
      },
      {
        label: "Contact",
        href: "/contact",
        description: "Speak to the team.",
      },
      {
        label: "Blog",
        href: "/blog",
        description: "Latest insights and guides.",
      },
      {
        label: "Page Scanner",
        href: "/performance-scanner",
        description: "Run a live speed and performance test.",
        highlight: true,
      },
    ],
  },
  {
    title: "Service Pages",
    items: [
      {
        label: "Local SEO",
        href: "/services/local-seo",
        description: "Search growth for local intent.",
      },
      {
        label: "WordPress Web Design",
        href: "/services/wordpress-web-design",
        description: "Custom WordPress builds.",
      },
      {
        label: "E-commerce Development",
        href: "/services/ecommerce",
        description: "Stores built to convert.",
      },
      {
        label: "Digital Transformation",
        href: "/digital-transformation",
        description: "Automation and systems delivery.",
      },
      {
        label: "Project Rescue",
        href: "/project-rescue",
        description: "Recover failing builds quickly.",
      },
    ],
  },
  {
    title: "Location Pages",
    items: [
      {
        label: "Web Design Liverpool",
        href: "/web-design-liverpool",
        description: "Liverpool page.",
      },
      {
        label: "Web Design Wirral",
        href: "/web-design-wirral",
        description: "Wirral page.",
      },
      {
        label: "Web Design Chester",
        href: "/web-design-chester",
        description: "Chester page.",
      },
      {
        label: "Web Design Warrington",
        href: "/web-design-warrington",
        description: "Warrington page.",
      },
      {
        label: "All Case Studies",
        href: "/case-studies",
        description: "View outcomes across client work.",
      },
    ],
  },
];

const servicesMenu: ServiceColumn[] = [
  {
    title: "Web & Growth",
    items: [
      {
        label: "High-Performance Local Websites",
        href: "/services/local-seo",
        description: "Local rankings powered by Core Web Vitals.",
      },
      {
        label: "WordPress Web Design",
        href: "/services/wordpress-web-design",
        description: "Custom, high-performance WordPress builds.",
      },
      {
        label: "E-commerce Development",
        href: "/services/ecommerce",
        description: "Shopify and custom stores that convert.",
      },
    ],
  },
  {
    title: "Product & Strategy",
    items: [
      {
        label: "Project Rescue",
        href: "/project-rescue",
        description: "Fix broken web projects fast.",
        highlight: true,
      },
      {
        label: "Contract Product Owner",
        href: "/contract-product-owner",
        description: "Hands-on product leadership.",
      },
      {
        label: "Agile Coaching",
        href: "/agile-coaching",
        description: "Turn chaos into predictable delivery.",
      },
      {
        label: "Digital Transformation",
        href: "/digital-transformation",
        description: "Automate work and connect systems.",
      },
    ],
  },
];

const insightsMenu: ServiceColumn[] = [
  {
    title: "Latest Articles",
    items: [
      {
        label: "Web Design Costs in Liverpool 2025",
        href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025",
        description: "Transparent pricing breakdown.",
      },
      {
        label: "How to Choose a Web Agency",
        href: "/blog/choose-web-design-agency-liverpool",
        description: "Red flags and what matters.",
      },
      {
        label: "Website Mistakes to Avoid",
        href: "/blog/website-mistakes-liverpool",
        description: "Errors that kill conversions.",
      },
      {
        label: "All Articles",
        href: "/blog",
        description: "Browse our full archive.",
      },
    ],
  },
];

const caseStudiesMenu: ServiceColumn[] = [
  {
    title: "Client Results",
    items: [
      {
        label: "Sweep Stakes Casino",
        href: "/case-studies/high-five-games",
        description: "+180% conversion uplift.",
      },
      {
        label: "Independent Retailer",
        href: "/case-studies/independent-retailer",
        description: "+250% organic traffic.",
      },
      {
        label: "All Case Studies",
        href: "/case-studies",
        description: "See more success stories.",
      },
    ],
  },
];

const aboutMenu: ServiceColumn[] = [
  {
    title: "About",
    items: [
      {
        label: "About Kaizen",
        href: "/about",
        description: "What we do and how we work.",
      },
      {
        label: "Our Pledge",
        href: "/pledge",
        description: "No jargon. Transparent partnership.",
      },
      {
        label: "Contact",
        href: "/contact",
        description: "Say hello or request an audit.",
      },
    ],
  },
];

export const getMenuData = (menu: DesktopMenuKey): ServiceColumn[] => {
  if (menu === "pages") return pagesMenu;
  if (menu === "insights") return insightsMenu;
  if (menu === "case-studies") return caseStudiesMenu;
  if (menu === "about") return aboutMenu;
  return servicesMenu;
};
