export type DesktopMenuKey =
  | "services"
  | "insights"
  | "case-studies"
  | "about";

export type MenuSocialIcon = "linkedin" | "instagram";

export interface MenuLink {
  label: string;
  href: string;
  description?: string;
  badge?: "New" | "Soon";
  external?: boolean;
  comingSoon?: boolean;
}

export interface MenuColumn {
  title?: string;
  items: MenuLink[];
}

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
    media?: PromoMedia;
  };
  primaryColumns: MenuColumn[];
  utilitySections?: MenuUtilitySection[];
}

const menuDefinitions: Record<DesktopMenuKey, DesktopMenuDefinition> = {
  services: {
    key: "services",
    label: "Services",
    promo: {
      title: "Senior delivery for websites that need to earn their keep.",
      description:
        "We focus the public site around the services that fit the current strategy: WordPress rebuilds, technical SEO foundations, and hands-on product leadership.",
      href: "/services/wordpress-web-design/",
      ctaLabel: "See core services",
    },
    primaryColumns: [
      {
        title: "Build & Foundations",
        items: [
          {
            label: "WordPress Web Design",
            href: "/services/wordpress-web-design/",
          },
          {
            label: "Local SEO",
            href: "/services/local-seo/",
          },
        ],
      },
      {
        title: "Leadership",
        items: [
          {
            label: "Contract Product Owner",
            href: "/contract-product-owner/",
          },
        ],
      },
    ],
    utilitySections: [
      {
        title: "Proof & Next Steps",
        items: [
          {
            label: "Case Studies",
            href: "/case-studies/",
          },
          {
            label: "Free Audit",
            href: "/performance-scanner/",
            badge: "New",
          },
          {
            label: "Contact",
            href: "/contact/",
          },
        ],
      },
    ],
  },
  insights: {
    key: "insights",
    label: "Insights",
    promo: {
      title: "Useful writing, not filler.",
      description:
        "Notes on rebuilds, performance, technical SEO, and commercial decisions from the work we actually do.",
      href: "/blog/",
      ctaLabel: "Read insights",
      media: {
        type: "image",
        src:
          "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F2bcd66303b6e425ab616ce3ad62975b8?format=webp&width=1600",
        alt: "Kaizen insights preview",
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
      title: "Two examples. Real constraints. Clear outcomes.",
      description:
        "We are trimming the public proof down to the work that best fits the direction of the business right now.",
      href: "/case-studies/midland-oil-group/",
      ctaLabel: "View case studies",
      media: {
        type: "image",
        src: "/images/case-studies/midland-oil-group-hero.webp",
        alt: "Midland Oil Group homepage preview",
      },
    },
    primaryColumns: [
      {
        title: "Platform Rebuild",
        items: [
          {
            label: "Midland Oil Group",
            href: "/case-studies/midland-oil-group/",
          },
        ],
      },
      {
        title: "Local Growth",
        items: [
          {
            label: "Helen Moore Hairdressing",
            href: "/case-studies/helen-moore-hairdressing/",
            badge: "Soon",
            comingSoon: true,
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
      title: "One person. Sharp standards.",
      description:
        "The public site is getting leaner, but the trust signals stay. This is where people can understand how we work and who they are hiring.",
      href: "/about/",
      ctaLabel: "About Kaizen",
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
