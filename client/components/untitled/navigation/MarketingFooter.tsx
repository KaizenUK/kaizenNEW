import KaizenLogo from "../../KaizenLogo";
import { InstagramIcon, LinkedinIcon } from "../../icons/CriticalIcons";
import { BUSINESS_EMAIL, SERVICE_AREAS_SUMMARY } from "../../../lib/seo";
import {
  COMPANY_NUMBER,
  LEGAL_COMPANY_NAME,
  REGISTERED_OFFICE_ADDRESS,
  TRADING_NAME,
} from "@shared/legal";
import { NavigationLink } from "./NavigationLink";
import { footerGroups, socialLinks, trustLinks } from "./navigation-data";

export interface MarketingFooterProps {
  buildLabel?: string;
}

/** Static adaptation of Untitled UI Footer Large 01 brand. No second sales ask. */
export function MarketingFooter({ buildLabel }: MarketingFooterProps) {
  return (
    <footer className="bg-gray-950 font-body text-slate-300 [--radius:0.5rem]">
      <div className="mx-auto max-w-[1440px] px-6 pt-8 pb-8 sm:px-10 md:pt-16 lg:px-12">
        <div className="grid gap-8 border-b border-white/15 pb-8 md:grid-cols-[1fr_1fr] md:gap-12 md:pb-12">
          <div>
            <a
              href="/"
              aria-label="Kaizen home"
              className="inline-flex min-h-11 items-center rounded-lg outline-uui-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <KaizenLogo className="h-8 w-[146px] text-white" />
            </a>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Web design for businesses.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {socialLinks.map((link) => {
                const Icon =
                  link.icon === "linkedin" ? LinkedinIcon : InstagramIcon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-slate-200 no-underline outline-uui-brand-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    <Icon className="size-4" />
                    {link.label}
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="md:justify-self-end">
            <a
              href={`mailto:${BUSINESS_EMAIL}`}
              className="inline-flex min-h-11 max-w-full items-center rounded-lg text-lg font-semibold text-white no-underline outline-uui-brand-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {BUSINESS_EMAIL}
            </a>
            <p className="mt-3 text-sm font-semibold text-white">
              Where we work
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-300">
              {SERVICE_AREAS_SUMMARY}. We come to you.
            </p>
            <ul className="-ml-3 mt-3 flex flex-wrap gap-x-1">
              {trustLinks.map((link) => (
                <li key={link.href}>
                  <NavigationLink item={link} onDark />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="py-8 md:py-12">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-8">
            {footerGroups.map((group) => (
              <li
                key={group.label}
                className={
                  group.label === "Guides"
                    ? "row-span-2 min-w-0 sm:row-span-1"
                    : "min-w-0"
                }
              >
                <h2 className="text-xs font-semibold leading-6 tracking-[0.12em] text-white uppercase">
                  {group.label}
                </h2>
                <ul className="-ml-3 mt-3 space-y-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <NavigationLink
                        item={link}
                        onDark
                        className="w-full py-2"
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-5 border-t border-white/15 pt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 text-sm leading-6 text-slate-300">
            <p>
              &copy; {new Date().getFullYear()} {LEGAL_COMPANY_NAME} trading as{" "}
              {TRADING_NAME}. Company No. {COMPANY_NUMBER}.
            </p>
            <p className="max-w-3xl">
              Registered office: {REGISTERED_OFFICE_ADDRESS}
            </p>
          </div>
          {buildLabel ? (
            <span className="w-fit shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs leading-6 text-slate-300">
              Build {buildLabel}
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
