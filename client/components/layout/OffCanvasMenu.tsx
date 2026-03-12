import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Instagram,
  Linkedin,
  Sparkles,
  X,
} from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";
import AppLink from "@/components/routing/AppLink";
import { cn } from "@/lib/utils";
import {
  dropdownTriggers,
  getDesktopMenu,
  type DesktopMenuKey,
  type MenuLink,
  type MenuSocialLink,
} from "./header-menu-data";

interface OffCanvasMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const directLinks = [{ href: "/case-studies", label: "Case Studies" }];

const panelMotion = {
  initial: { opacity: 0, y: -12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

function SocialIcon({ icon }: { icon: MenuSocialLink["icon"] }) {
  if (icon === "linkedin") {
    return <Linkedin className="h-4 w-4" />;
  }

  return <Instagram className="h-4 w-4" />;
}

function MobileLink({
  item,
  onClose,
  className,
  children,
}: {
  item: MenuLink;
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  const isExternal = item.external || isExternalHref(item.href);

  return (
    <AppLink
      href={item.href}
      onClick={onClose}
      className={className}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {children}
    </AppLink>
  );
}

const OffCanvasMenu: React.FC<OffCanvasMenuProps> = ({ isOpen, onClose }) => {
  const [openKey, setOpenKey] = useState<DesktopMenuKey>("services");

  const menuSections = useMemo(
    () => dropdownTriggers.map((section) => getDesktopMenu(section.key)),
    [],
  );

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[5px] lg:hidden"
            onClick={onClose}
          />

          <motion.aside
            {...panelMotion}
            className="fixed inset-x-2 top-[74px] bottom-2 z-50 flex flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_20px_48px_rgba(4,29,47,0.22)] lg:hidden"
          >
            <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <AppLink href="/" className="flex items-center" onClick={onClose}>
                <KaizenLogo className="h-[28px] w-[126px] text-[#001133]" />
              </AppLink>

              <button
                type="button"
                aria-label="Close menu"
                className="rounded-full p-2 text-[#16181d] transition hover:bg-[#edf1f7]"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                {menuSections.map((section) => {
                  const isOpenSection = openKey === section.key;

                  return (
                    <div
                      key={section.key}
                      className="overflow-hidden rounded-[20px] border border-black/10 bg-[#f7f9fc]"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenKey(section.key)}
                        className="flex w-full items-center justify-between px-4 py-4 text-left text-[17px] font-medium leading-none text-[#16181d]"
                      >
                        <span>{section.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-[#5a6475] transition-transform duration-200",
                            isOpenSection && "rotate-180",
                          )}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpenSection ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden border-t border-black/10 bg-white"
                          >
                            <div className="space-y-5 px-4 py-4">
                              <AppLink
                                href={section.promo.href}
                                onClick={onClose}
                                className="group block overflow-hidden rounded-[18px] border border-black/10 bg-[#f7f9fc] p-3"
                              >
                                <div className="overflow-hidden rounded-[14px] bg-[#edf2fb]">
                                  {section.promo.media.type === "video" ? (
                                    <video
                                      autoPlay
                                      muted
                                      loop
                                      playsInline
                                      poster={section.promo.media.poster}
                                      className="aspect-[16/10] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                    >
                                      <source
                                        src={section.promo.media.src}
                                        type="video/mp4"
                                      />
                                    </video>
                                  ) : (
                                    <img
                                      src={section.promo.media.src}
                                      alt={section.promo.media.alt}
                                      className="aspect-[16/10] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  )}
                                </div>

                                <div className="space-y-2 px-1 pt-4">
                                  <h3 className="text-[20px] font-semibold leading-[1.15] text-[#16181d]">
                                    {section.promo.title}
                                  </h3>
                                  <p className="text-sm leading-6 text-[#5a6475]">
                                    {section.promo.description}
                                  </p>
                                  <div className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-[#1764ff]">
                                    {section.promo.ctaLabel || "Explore"}
                                    <ArrowRight className="h-4 w-4" />
                                  </div>
                                </div>
                              </AppLink>

                              {section.primaryColumns.map((column) => (
                                <div key={column.title || column.items[0]?.href}>
                                  {column.title ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d7788]">
                                      {column.title}
                                    </p>
                                  ) : null}

                                  <ul className="mt-3 space-y-1">
                                    {column.items.map((item) => (
                                      <li key={item.href}>
                                        <MobileLink
                                          item={item}
                                          onClose={onClose}
                                          className="group flex items-start gap-3 rounded-2xl px-1 py-2 transition-colors duration-200 hover:text-[#1764ff]"
                                        >
                                          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#84cc16]" />
                                          <span className="inline-flex items-center gap-2 text-[16px] font-medium leading-6 text-[#16181d]">
                                            <span>{item.label}</span>
                                            {item.badge ? (
                                              <span className="rounded-sm bg-[#e5f3cf] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#355413]">
                                                {item.badge}
                                              </span>
                                            ) : null}
                                            {(item.external || isExternalHref(item.href)) ? (
                                              <ArrowUpRight className="h-4 w-4 text-[#73809a]" />
                                            ) : null}
                                          </span>
                                        </MobileLink>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}

                              {section.utilitySections?.map((utility) => (
                                <div key={utility.title || utility.items?.[0]?.href || utility.socials?.[0]?.href}>
                                  {utility.title ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d7788]">
                                      {utility.title}
                                    </p>
                                  ) : null}

                                  {utility.items?.length ? (
                                    <ul className="mt-3 space-y-1">
                                      {utility.items.map((item) => (
                                        <li key={item.href}>
                                          <MobileLink
                                            item={item}
                                            onClose={onClose}
                                            className="group inline-flex items-center gap-2 rounded-2xl px-1 py-2 text-[15px] leading-6 text-[#3a4458] transition-colors duration-200 hover:text-[#1764ff]"
                                          >
                                            <span>{item.label}</span>
                                            {item.badge ? (
                                              <span className="rounded-sm bg-[#e5f3cf] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#355413]">
                                                {item.badge}
                                              </span>
                                            ) : null}
                                            {(item.external || isExternalHref(item.href)) ? (
                                              <ArrowUpRight className="h-4 w-4 text-[#73809a]" />
                                            ) : null}
                                          </MobileLink>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}

                                  {utility.socials?.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {utility.socials.map((social) => (
                                        <AppLink
                                          key={social.href}
                                          href={social.href}
                                          onClick={onClose}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f5fa] text-[#33415d] transition-all duration-200 hover:bg-[#1764ff] hover:text-white"
                                          aria-label={social.label}
                                        >
                                          <SocialIcon icon={social.icon} />
                                        </AppLink>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[20px] border border-black/10 bg-white px-4 py-3">
                {directLinks.map(({ href, label }) => (
                  <AppLink
                    key={href}
                    href={href}
                    onClick={onClose}
                    className="flex items-center justify-between rounded-2xl py-2 text-[16px] font-medium text-[#16181d] transition-colors duration-200 hover:text-[#1764ff]"
                  >
                    <span>{label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </AppLink>
                ))}
              </div>
            </div>

            <footer className="grid gap-2 border-t border-black/10 bg-white px-4 py-4">
              <AppLink
                href="/performance-scanner"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#c5d4f1] bg-[#f4f7fe] px-4 py-3 text-[15px] font-medium text-[#133a86] transition-all duration-200 hover:border-[#1764ff] hover:bg-white hover:text-[#1764ff]"
              >
                <Sparkles className="h-4 w-4" />
                Free Audit
              </AppLink>
              <AppLink
                href="/contact"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1764ff] px-4 py-3 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0f53df]"
              >
                Start Your Project
                <ArrowRight className="h-4 w-4" />
              </AppLink>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default OffCanvasMenu;
