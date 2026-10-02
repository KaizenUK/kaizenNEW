export interface NavigationLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface NavigationGroup {
  id: "services" | "work" | "about" | "guides";
  label: string;
  links: readonly NavigationLink[];
  supportingLinks?: readonly NavigationLink[];
}

export const homeLink: NavigationLink = { label: "Kaizen home", href: "/" };
export const contactLink: NavigationLink = {
  label: "Contact",
  href: "/contact/",
};
export const speedLink: NavigationLink = {
  label: "Check your website speed",
  href: "/performance-scanner/",
};

export const serviceLinks: readonly NavigationLink[] = [
  { label: "WordPress web design", href: "/services/wordpress-web-design/" },
  { label: "Contract product owner", href: "/contract-product-owner/" },
];

export const workLinks: readonly NavigationLink[] = [
  { label: "All our work", href: "/case-studies/" },
  { label: "Midland Oil Group", href: "/case-studies/midland-oil-group/" },
  {
    label: "Helen Moore Hairdressing",
    href: "/case-studies/helen-moore-hairdressing/",
  },
];

export const aboutLinks: readonly NavigationLink[] = [
  { label: "About Kaizen", href: "/about/" },
  { label: "Our pledge", href: "/pledge/" },
];

export const guideLinks: readonly NavigationLink[] = [
  { label: "All guides", href: "/blog/" },
  {
    label: "Website costs",
    href: "/blog/how-much-does-a-website-cost-in-liverpool-in-2025/",
  },
  {
    label: "Choosing a web designer",
    href: "/blog/choose-web-design-agency-liverpool/",
  },
  {
    label: "Common website mistakes",
    href: "/blog/website-mistakes-liverpool/",
  },
  {
    label: "Website build options",
    href: "/blog/wordpress-vs-react-business-roi/",
  },
  {
    label: "Fixing a software project",
    href: "/blog/fix-failing-software-project-financial-guide/",
  },
  {
    label: "Why we rebuilt our site",
    href: "/blog/more-than-a-refresh-why-we-rebuilt-the-kaizen-website/",
  },
];

export const legalLinks: readonly NavigationLink[] = [
  { label: "Privacy policy", href: "/privacy-policy/" },
  { label: "Cookie policy", href: "/cookie-policy/" },
  { label: "GDPR policy", href: "/gdpr-policy/" },
  { label: "Terms and conditions", href: "/terms-and-conditions/" },
];

export const trustLinks: readonly NavigationLink[] = [
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
    label: "Clutch",
    href: "https://clutch.co/profile/kaizen-2",
    external: true,
  },
];

export const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/kaizen-uk",
    icon: "linkedin",
    external: true,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/kaizen.web.uk/",
    icon: "instagram",
    external: true,
  },
] as const satisfies readonly (NavigationLink & {
  icon: "linkedin" | "instagram";
})[];

export const navigationGroups: readonly NavigationGroup[] = [
  {
    id: "services",
    label: "Services",
    links: serviceLinks,
    supportingLinks: [speedLink],
  },
  { id: "work", label: "Work", links: workLinks },
  {
    id: "about",
    label: "About",
    links: aboutLinks,
    supportingLinks: trustLinks,
  },
  {
    id: "guides",
    label: "Guides",
    links: guideLinks,
    supportingLinks: [speedLink],
  },
];

export const footerGroups: readonly {
  label: string;
  links: readonly NavigationLink[];
}[] = [
  { label: "Services", links: serviceLinks },
  { label: "Work", links: workLinks },
  { label: "About", links: [...aboutLinks, contactLink] },
  { label: "Guides", links: [...guideLinks, speedLink] },
  { label: "Legal", links: legalLinks },
];

export function normalisePath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0];
  return path.replace(/\/+$/, "") || "/";
}

export function isCurrentLink(href: string, pathname: string): boolean {
  return (
    href.startsWith("/") && normalisePath(href) === normalisePath(pathname)
  );
}

export function isCurrentGroup(
  group: NavigationGroup,
  pathname: string,
): boolean {
  const path = normalisePath(pathname);
  if (
    group.id === "guides" &&
    (path === "/blog" || path.startsWith("/blog/"))
  ) {
    return true;
  }
  if (
    group.id === "work" &&
    (path === "/case-studies" || path.startsWith("/case-studies/"))
  ) {
    return true;
  }
  return group.links.some((link) => isCurrentLink(link.href, path));
}
