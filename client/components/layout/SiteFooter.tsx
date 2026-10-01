import { ArrowUpRight, Building2, Mail, MapPin } from "lucide-react";
import {
  InstagramIcon as Instagram,
  LinkedinIcon as Linkedin,
} from "@/components/icons/CriticalIcons";
import KaizenLogo from "@/components/KaizenLogo";
import AppLink from "@/components/routing/AppLink";
import { SERVICE_AREAS_SUMMARY, BUSINESS_EMAIL } from "@/lib/seo";
import {
  COMPANY_NUMBER,
  LEGAL_COMPANY_NAME,
  REGISTERED_OFFICE_ADDRESS,
  TRADING_NAME,
} from "@shared/legal";

interface FooterProps {
  buildLabel?: string;
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const footerColumns: Array<{
  title: string;
  links: FooterLink[];
}> = [
  {
    title: "Services",
    links: [
      { label: "Local SEO", href: "/services/local-seo/" },
      {
        label: "WordPress Web Design",
        href: "/services/wordpress-web-design/",
      },
      { label: "Contract Product Owner", href: "/contract-product-owner/" },
    ],
  },
  {
    title: "Proof",
    links: [
      { label: "Case Studies", href: "/case-studies/" },
      { label: "Midland Oil Group", href: "/case-studies/midland-oil-group/" },
      {
        label: "Helen Moore Hairdressing",
        href: "/case-studies/helen-moore-hairdressing/",
      },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog/" },
      { label: "Performance Scanner", href: "/performance-scanner/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about/" },
      { label: "Our Pledge", href: "/pledge/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy/" },
      { label: "Cookie Policy", href: "/cookie-policy/" },
      { label: "GDPR Policy", href: "/gdpr-policy/" },
      { label: "Terms & Conditions", href: "/terms-and-conditions/" },
    ],
  },
];

const socialLinks: FooterLink[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/kaizen-uk",
    external: true,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/kaizen.web.uk/",
    external: true,
  },
];

const trustLinks: FooterLink[] = [
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

function FooterLinkItem({
  href,
  label,
  external,
  className,
}: FooterLink & { className?: string }) {
  return (
    <AppLink
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={[
        "group inline-flex items-center gap-2 text-sm text-white/40 transition-colors duration-200 hover:text-white no-underline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      {external ? (
        <ArrowUpRight className="h-3.5 w-3.5 text-white/20 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/60" />
      ) : null}
    </AppLink>
  );
}

function SocialBadge({ label, href, external }: FooterLink) {
  const Icon = label === "LinkedIn" ? Linkedin : Instagram;

  return (
    <AppLink
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/60 no-underline transition-all duration-200 hover:border-white/20 hover:text-white"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </AppLink>
  );
}

export default function SiteFooter({ buildLabel }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-white">
      {/* Contact and company details */}
      <div className="px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid gap-10 py-12 md:grid-cols-3 md:py-16">
          <a href={`mailto:${BUSINESS_EMAIL}`} className="group no-underline">
            <Mail className="h-5 w-5 text-white/20 transition-colors group-hover:text-white/50" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 font-body">
              Email
            </p>
            <p className="mt-2 text-lg font-medium text-white transition-colors group-hover:text-white/80">
              {BUSINESS_EMAIL}
            </p>
          </a>

          <div>
            <MapPin className="h-5 w-5 text-white/20" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 font-body">
              Where we work
            </p>
            <p className="mt-2 text-base leading-6 text-white/60">
              {SERVICE_AREAS_SUMMARY}. We come to you.
            </p>
          </div>

          <div>
            <Building2 className="h-5 w-5 text-white/20" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 font-body">
              Registered Office
            </p>
            <p className="mt-2 text-base leading-6 text-white/60">
              {REGISTERED_OFFICE_ADDRESS}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Links grid */}
        <div className="grid gap-10 py-16 md:py-20 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
          {/* Brand column */}
          <div className="lg:pr-8">
            <KaizenLogo className="h-9 w-[164px] text-white" />
            <p className="mt-5 max-w-[28rem] text-base leading-7 text-white/40 font-body">
              Better websites, better results. Continuous improvement is in the
              name.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((link) => (
                <SocialBadge key={link.label} {...link} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {trustLinks.map((link) => (
                <FooterLinkItem
                  key={link.label}
                  {...link}
                  className="text-[13px]"
                />
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30 font-body">
                {column.title}
              </p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem {...link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1 text-sm leading-6 text-white/30 font-body">
            <p>
              &copy; {year} {LEGAL_COMPANY_NAME} trading as {TRADING_NAME}.
              Company No. {COMPANY_NUMBER}.
            </p>
            <p>Registered office: {REGISTERED_OFFICE_ADDRESS}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/30">
            <FooterLinkItem
              label="View company record"
              href="https://find-and-update.company-information.service.gov.uk/company/17007703"
              external
              className="text-sm text-white/30"
            />
            {buildLabel ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-white/30">
                Build {buildLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
