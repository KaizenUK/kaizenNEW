import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export type DesktopMenuKey =
  | "locations"
  | "services"
  | "insights"
  | "case-studies"
  | "about";

export type MenuSocialIcon = "linkedin" | "instagram";

export interface MenuLink {
  label: string;
  href: string;
  description?: string;
  badge?: "New";
  external?: boolean;
}

export interface MenuColumn {
  title?: string;
  items: MenuLink[];
}

export type ServiceItem = MenuLink;
export type ServiceColumn = MenuColumn;

export interface MenuSocialLink {
  label: string;
  href: string;
  icon: MenuSocialIcon;
}

export interface MenuUtilitySection {
  title?: string;
  items?: MenuLink[];
  socials?: MenuSocialLink[];
}

export type PromoMedia =
  | {
      type: "image";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      src: string;
      poster?: string;
      alt: string;
    };

export interface DesktopMenuDefinition {
  key: DesktopMenuKey;
  label: string;
  promo: {
    title: string;
    description: string;
    href: string;
    ctaLabel?: string;
    media: PromoMedia;
  };
  primaryColumns: MenuColumn[];
  utilitySections?: MenuUtilitySection[];
}

const menuDefinitions: Record<DesktopMenuKey, DesktopMenuDefinition> = {
  services: {
    key: "services",
    label: "Services",
    promo: {
      title: "Websites built to bring work in.",
      description:
        "Fast delivery, sober technical decisions, and a commercial focus from first brief to launch.",
      href: "/services/",
      ctaLabel: "Explore services",
      media: {
        type: "image",
        src:
          "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F85912ce9f05a4f7cb336598a47962b01?format=webp&width=1600",
        alt: "Kaizen service showcase",
      },
    },
    primaryColumns: [
      {
        title: "Build & Growth",
        items: [
          {
            label: "Local SEO",
            href: "/services/local-seo/",
          },
          {
            label: "WordPress Web Design",
            href: "/services/wordpress-web-design/",
          },
        ],
      },
      {
        title: "Product & Delivery",
        items: [
          {
            label: "Project Rescue",
            href: "/project-rescue/",
            badge: "New",
          },
          {
            label: "Contract Product Owner",
            href: "/contract-product-owner/",
          },
          {
            label: "Agile Coaching",
            href: "/agile-coaching/",
          },
          {
            label: "Digital Transformation",
            href: "/digital-transformation/",
          },
        ],
      },
    ],
  },
  locations: {
    key: "locations",
    label: "Locations",
    promo: {
      title: "Local landing pages, without local-page nonsense.",
      description:
        "The same delivery standard, tuned for Liverpool, Chester, Warrington, and Wirral search intent.",
      href: "/web-design-liverpool/",
      ctaLabel: "Browse locations",
      media: {
        type: "image",
        src: DEFAULT_OG_IMAGE,
        alt: "Kaizen site preview",
      },
    },
    primaryColumns: [
      {
        title: "Merseyside",
        items: [
          {
            label: "Web Design Liverpool",
            href: "/web-design-liverpool/",
          },
          {
            label: "Web Design Wirral",
            href: "/web-design-wirral/",
          },
          {
            label: "Liverpool City Centre",
            href: "/web-design-liverpool-city-centre/",
          },
        ],
      },
      {
        title: "Cheshire",
        items: [
          {
            label: "Web Design Chester",
            href: "/web-design-chester/",
          },
          {
            label: "Web Design Warrington",
            href: "/web-design-warrington/",
          },
        ],
      },
    ],
  },
  insights: {
    key: "insights",
    label: "Insights",
    promo: {
      title: "Useful writing, not placeholder content.",
      description:
        "Notes on recovery work, performance, commercial web design, and the decisions behind real delivery.",
      href: "/blog/",
      ctaLabel: "Read insights",
      media: {
        type: "image",
        src:
          "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F2bcd66303b6e425ab616ce3ad62975b8?format=webp&width=1600",
        alt: "Kaizen resources preview",
      },
    },
    primaryColumns: [
      {
        title: "Latest",
        items: [
          {
            label: "Web Design Costs in Liverpool 2025",
            href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025/",
          },
          {
            label: "How to Choose a Web Agency",
            href: "/blog/choose-web-design-agency-liverpool/",
          },
          {
            label: "Website Mistakes to Avoid",
            href: "/blog/website-mistakes-liverpool/",
          },
        ],
      },
      {
        title: "Deep Dives",
        items: [
          {
            label: "WordPress vs React ROI",
            href: "/blog/wordpress-vs-react-business-roi/",
          },
          {
            label: "Fix a Failing Software Project",
            href: "/blog/fix-failing-software-project-financial-guide/",
          },
          {
            label: "More Than a Refresh",
            href: "/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/",
          },
        ],
      },
    ],
    utilitySections: [
      {
        title: "Archive",
        items: [
          {
            label: "All Articles",
            href: "/blog/",
          },
        ],
      },
    ],
  },
  "case-studies": {
    key: "case-studies",
    label: "Case Studies",
    promo: {
      title: "Real work, real constraints, real outcomes.",
      description:
        "A sample of projects where we improved delivery, performance, conversion, or all three.",
      href: "/case-studies/midland-oil-group/",
      ctaLabel: "View case study",
      media: {
        type: "image",
        src: "/images/case-studies/midland-oil-group-hero.webp",
        alt: "Midland Oil Group homepage — custom-built platform featuring sector-first navigation and AI-powered oil finder",
      },
    },
    primaryColumns: [
      {
        title: "Client Work",
        items: [
          {
            label: "AS Collections",
            href: "/case-studies/as-collections/",
          },
          {
            label: "Independent Retailer",
            href: "/case-studies/independent-retailer/",
          },
          {
            label: "Helen Moore Hairdressing",
            href: "/case-studies/helen-moore-hairdressing/",
          },
        ],
      },
      {
        title: "Platforms & Delivery",
        items: [
          {
            label: "Midland Oil Group",
            href: "/case-studies/midland-oil-group/",
          },
          {
            label: "Kaizen Rebuild",
            href: "/case-studies/kaizen-rebuild/",
          },
        ],
      },
    ],
    utilitySections: [
      {
        title: "Browse",
        items: [
          {
            label: "All Case Studies",
            href: "/case-studies/",
          },
          {
            label: "Start Your Project",
            href: "/contact/",
          },
        ],
      },
    ],
  },
  about: {
    key: "about",
    label: "Company",
    promo: {
      title: "Small team, sharp standards.",
      description:
        "The company page should tell people how you work. Ours does, and it points at the evidence too.",
      href: "/about/",
      ctaLabel: "About Kaizen",
      media: {
        type: "image",
        src:
          "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fa18f81c064614dceb4a9d1fcb2c9f64b?format=webp&width=1600",
        alt: "Kaizen company preview",
      },
    },
    primaryColumns: [
      {
        title: "Company",
        items: [
          {
            label: "About Kaizen",
            href: "/about/",
          },
          {
            label: "Our Pledge",
            href: "/pledge/",
          },
          {
            label: "Contact",
            href: "/contact/",
          },
        ],
      },
    ],
    utilitySections: [
      {
        title: "Trust Signals",
        items: [
          {
            label: "Companies House",
            href: "https://find-and-update.company-information.service.gov.uk/company/17007703",
            external: true,
          },
          {
            label: "Google Maps",
            href: "https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE",
            external: true,
          },
          {
            label: "Clutch Profile",
            href: "https://clutch.co/profile/kaizen-2",
            external: true,
          },
        ],
      },
      {
        title: "Follow Kaizen",
        socials: [
          {
            label: "LinkedIn",
            href: "https://www.linkedin.com/company/kaizen-uk",
            icon: "linkedin",
          },
          {
            label: "Instagram",
            href: "https://www.instagram.com/kaizen.web.uk/",
            icon: "instagram",
          },
        ],
      },
    ],
  },
};

export const dropdownTriggers: Array<{
  key: DesktopMenuKey;
  label: string;
}> = [
  { key: "services", label: menuDefinitions.services.label },
  { key: "insights", label: menuDefinitions.insights.label },
  { key: "about", label: menuDefinitions.about.label },
  { key: "case-studies", label: menuDefinitions["case-studies"].label },
];

export const getDesktopMenu = (menu: DesktopMenuKey): DesktopMenuDefinition =>
  menuDefinitions[menu];

export const getMenuData = (menu: DesktopMenuKey): MenuColumn[] =>
  menuDefinitions[menu].primaryColumns;
