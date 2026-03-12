import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import KaizenLogo from "@/components/KaizenLogo";
import AppLink from "@/components/routing/AppLink";
import { requiresDocumentNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { getMenuData, type DesktopMenuKey } from "./header-menu-data";

interface OffCanvasMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const sections: Array<{ key: DesktopMenuKey; label: string }> = [
  { key: "services", label: "Services" },
  { key: "pages", label: "Pages" },
  { key: "insights", label: "Resources" },
  { key: "about", label: "Company" },
];

const directLinks = [{ href: "/case-studies", label: "Case Studies" }];

const panelMotion = {
  initial: { opacity: 0, y: -12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

const OffCanvasMenu: React.FC<OffCanvasMenuProps> = ({ isOpen, onClose }) => {
  const [openKey, setOpenKey] = useState<DesktopMenuKey>("services");

  const menuSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        columns: getMenuData(section.key),
      })),
    [],
  );

  const handleSectionToggle = (key: DesktopMenuKey) => {
    setOpenKey(key);
  };

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
            className="fixed inset-x-2 top-[74px] bottom-2 z-50 flex flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_20px_48px_rgba(4,29,47,0.22)] lg:hidden"
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
                        onClick={() => handleSectionToggle(section.key)}
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
                              {section.columns.map((column) => (
                                <div key={column.title}>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d7788]">
                                    {column.title}
                                  </p>
                                  <ul className="mt-3 space-y-1">
                                    {column.items.map((item) => {
                                      const content = (
                                        <>
                                          <span className="inline-flex w-full items-center gap-3">
                                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#34ffc2]" />
                                            <span className="text-[16px] font-medium leading-6 text-[#16181d]">
                                              {item.label}
                                            </span>
                                          </span>
                                          <span className="pl-[18px] text-sm leading-5 text-[#5a6475]">
                                            {item.description}
                                          </span>
                                        </>
                                      );

                                      const linkClassName =
                                        "group flex flex-col gap-1 rounded-2xl px-1 py-2 transition-colors duration-200 hover:text-[#1764ff]";

                                      return (
                                        <li key={item.href}>
                                          {requiresDocumentNavigation(item.href) ? (
                                            <a
                                              href={item.href}
                                              className={linkClassName}
                                              onClick={onClose}
                                            >
                                              {content}
                                            </a>
                                          ) : (
                                            <AppLink
                                              href={item.href}
                                              className={linkClassName}
                                              onClick={onClose}
                                            >
                                              {content}
                                            </AppLink>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
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
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 px-4 py-3 text-[15px] font-medium text-[#16181d] transition-colors duration-200 hover:bg-[#edf1f7]"
              >
                Page Scanner
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
