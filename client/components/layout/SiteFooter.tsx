import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";
import AppLink from "@/components/routing/AppLink";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_PHONE,
} from "@/lib/seo";
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

const officeAddress = `${BUSINESS_ADDRESS.street}, ${BUSINESS_ADDRESS.locality}, ${BUSINESS_ADDRESS.region} ${BUSINESS_ADDRESS.postalCode}`;

const footerColumns: Array<{
  title: string;
  links: FooterLink[];
}> = [
  {
    title: "Services",
    links: [
      { label: "All Services", href: "/services/" },
      { label: "Local SEO", href: "/services/local-seo/" },
      {
        label: "WordPress Web Design",
        href: "/services/wordpress-web-design/",
      },
      { label: "E-commerce Development", href: "/services/ecommerce/" },
    ],
  },
  {
    title: "Delivery",
    links: [
      { label: "Project Rescue", href: "/project-rescue/" },
      { label: "Contract Product Owner", href: "/contract-product-owner/" },
      { label: "Agile Coaching", href: "/agile-coaching/" },
      { label: "Digital Transformation", href: "/digital-transformation/" },
    ],
  },
  {
    title: "Locations",
    links: [
      { label: "Liverpool", href: "/web-design-liverpool/" },
      { label: "Wirral", href: "/web-design-wirral/" },
      { label: "Chester", href: "/web-design-chester/" },
      { label: "Warrington", href: "/web-design-warrington/" },
    ],
  },
  {
    title: "Proof",
    links: [
      { label: "Case Studies", href: "/case-studies/" },
      { label: "AS Collections", href: "/case-studies/as-collections/" },
      {
        label: "Helen Moore Hairdressing",
        href: "/case-studies/helen-moore-hairdressing/",
      },
      { label: "Kaizen Rebuild", href: "/case-studies/kaizen-rebuild/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about/" },
      { label: "Our Pledge", href: "/pledge/" },
      { label: "Insights", href: "/blog/" },
      { label: "Contact", href: "/contact/" },
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
        "group inline-flex items-center gap-2 text-sm text-slate-300 transition-colors duration-200 hover:text-white no-underline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      {external ? (
        <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-200" />
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
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 no-underline transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </AppLink>
  );
}

export default function SiteFooter({ buildLabel }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#041126] pb-5 pt-8 text-white sm:pt-10">
      <div className="mx-auto w-full max-w-[1904px] px-2 sm:px-3">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#061632] shadow-[0_30px_80px_rgba(1,8,23,0.45)]">
          <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
            <div className="relative overflow-hidden px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(23,100,255,0.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.16),transparent_28%)]" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Senior-led delivery
                </p>
                <h2 className="mt-4 max-w-[12ch] text-[clamp(2.75rem,5.5vw,5.4rem)] font-semibold leading-[0.94] text-white">
                  Websites engineered properly.
                </h2>
                <p className="mt-5 max-w-[38rem] text-base leading-7 text-slate-300 sm:text-lg">
                  Custom code. Clear commercial thinking. One accountable team from
                  discovery to launch. If the brief is serious, the footer should be too.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <AppLink
                    href="/contact/"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1764ff] px-5 py-3 text-[15px] font-medium text-white no-underline transition-colors duration-200 hover:bg-[#0f53df]"
                  >
                    Start Your Project
                    <ArrowRight className="h-4 w-4" />
                  </AppLink>
                  <AppLink
                    href="/performance-scanner/"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.04] px-5 py-3 text-[15px] font-medium text-slate-100 no-underline transition-all duration-200 hover:border-white/24 hover:bg-white/[0.08]"
                  >
                    Book a Free Audit
                    <ArrowRight className="h-4 w-4" />
                  </AppLink>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 bg-white/[0.03] px-6 py-8 sm:grid-cols-2 sm:px-10 lg:border-l lg:border-t-0 lg:grid-cols-1 lg:px-10 lg:py-14">
              <a
                href={`mailto:${BUSINESS_EMAIL}`}
                className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 no-underline transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08]"
              >
                <Mail className="h-5 w-5 text-[#8ab4ff]" />
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Email
                </p>
                <p className="mt-2 text-lg font-medium text-white">{BUSINESS_EMAIL}</p>
              </a>

              <a
                href={`tel:${BUSINESS_PHONE.replace(/\s+/g, "")}`}
                className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 no-underline transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08]"
              >
                <Phone className="h-5 w-5 text-[#8ab4ff]" />
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Call
                </p>
                <p className="mt-2 text-lg font-medium text-white">{BUSINESS_PHONE}</p>
              </a>

              <AppLink
                href="https://www.google.com/maps/place/?q=place_id:ChIJA6LmO4Mhe0gR6N1ohnoK7ZE"
                target="_blank"
                rel="noreferrer"
                className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 no-underline transition-all duration-200 hover:border-white/20 hover:bg-white/[0.08]"
              >
                <MapPin className="h-5 w-5 text-[#8ab4ff]" />
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Liverpool Base
                </p>
                <p className="mt-2 text-base leading-6 text-slate-100">{officeAddress}</p>
              </AppLink>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
                <Building2 className="h-5 w-5 text-[#8ab4ff]" />
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Registered Office
                </p>
                <p className="mt-2 text-base leading-6 text-slate-100">
                  {REGISTERED_OFFICE_ADDRESS}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="grid xl:grid-cols-[minmax(0,1.2fr)_repeat(6,minmax(0,0.78fr))]">
              <div className="border-b border-white/10 px-6 py-8 sm:px-10 lg:px-14 lg:py-10 xl:border-b-0 xl:border-r">
                <KaizenLogo className="h-9 w-[164px] text-white" />
                <p className="mt-5 max-w-[28rem] text-base leading-7 text-slate-300">
                  Kaizen helps businesses fix the commercial problem first, then
                  builds the site properly. No page-builder fluff. No handoff maze.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {socialLinks.map((link) => (
                    <SocialBadge key={link.label} {...link} />
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                  {trustLinks.map((link) => (
                    <FooterLinkItem key={link.label} {...link} className="text-[13px]" />
                  ))}
                </div>
              </div>

              {footerColumns.map((column, index) => (
                <div
                  key={column.title}
                  className={[
                    "border-b border-white/10 px-6 py-8 sm:px-10 xl:border-b-0",
                    index > 0 ? "xl:border-l xl:border-white/10" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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
          </div>

          <div className="border-t border-white/10 px-6 py-5 sm:px-10 lg:px-14">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1 text-sm leading-6 text-slate-300">
                <p>
                  &copy; {year} {LEGAL_COMPANY_NAME} trading as {TRADING_NAME}. Company
                  No. {COMPANY_NUMBER}.
                </p>
                <p>Registered office: {REGISTERED_OFFICE_ADDRESS}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <FooterLinkItem
                  label="View company record"
                  href="https://find-and-update.company-information.service.gov.uk/company/17007703"
                  external
                  className="text-sm text-slate-300"
                />
                {buildLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400">
                    Build {buildLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
