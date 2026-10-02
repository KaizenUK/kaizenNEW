import { useEffect, useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import KaizenLogo from "../../KaizenLogo";
import { ChevronDownIcon, MenuIcon } from "../../icons/CriticalIcons";
import { MarketingButton } from "../MarketingButton";
import { cx } from "../utils/cx";
import { MobileNavigation } from "./MobileNavigation";
import { NavigationLink } from "./NavigationLink";
import {
  contactLink,
  isCurrentGroup,
  navigationGroups,
  type NavigationGroup,
} from "./navigation-data";

export interface MarketingHeaderProps {
  /** Astro supplies this value for matching server/client active-link markup. */
  pathname: string;
  /** The host layout must provide this main-content target. */
  mainContentId?: string;
}

/** Untitled UI's compact header/popover pattern with Kaizen navigation. */
export function MarketingHeader({
  pathname,
  mainContentId = "main-content",
}: MarketingHeaderProps) {
  const [activeGroup, setActiveGroup] = useState<NavigationGroup["id"] | null>(
    null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopPortal, setDesktopPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeHiddenNavigation = () => {
      if (desktop.matches) setMobileOpen(false);
      else setActiveGroup(null);
    };
    desktop.addEventListener("change", closeHiddenNavigation);
    return () => desktop.removeEventListener("change", closeHiddenNavigation);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 font-body">
      <a
        href={`#${mainContentId}`}
        className="sr-only rounded-lg bg-white px-4 py-3 font-semibold text-uui-brand-800 outline-uui-brand focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[120] focus:outline-2 focus:outline-offset-2"
      >
        Skip to content
      </a>
      <div className="mx-auto max-w-[1440px] px-2 pt-2 sm:px-4">
        <div className="flex h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_4px_20px_rgb(15_23_42/0.06)] sm:px-5">
          <a
            href="/"
            aria-label="Kaizen home"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg outline-uui-brand focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <KaizenLogo className="h-7 w-[112px] text-[#001133] sm:w-[128px]" />
          </a>

          <nav
            ref={setDesktopPortal}
            aria-label="Main navigation"
            className="hidden min-w-0 flex-1 justify-center lg:flex"
          >
            <ul className="flex items-center gap-0.5 xl:gap-1">
              {navigationGroups.map((group) => (
                <li key={group.id}>
                  <DialogTrigger
                    isOpen={activeGroup === group.id}
                    onOpenChange={(open) =>
                      setActiveGroup((current) =>
                        open ? group.id : current === group.id ? null : current,
                      )
                    }
                  >
                    <Button
                      className={cx(
                        "group flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold outline-uui-brand transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none xl:px-3",
                        isCurrentGroup(group, pathname)
                          ? "text-uui-brand-800"
                          : "text-slate-700",
                        activeGroup === group.id && "bg-slate-50",
                      )}
                    >
                      {group.label}
                      <ChevronDownIcon className="size-4 text-slate-500 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" />
                    </Button>
                    <Popover
                      // Keep the panel and its hidden dismiss control in the navigation landmark.
                      UNSTABLE_portalContainer={desktopPortal ?? undefined}
                      placement="bottom start"
                      offset={12}
                      containerPadding={16}
                      isNonModal
                      className="z-[70] hidden w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white font-body shadow-xl lg:block"
                    >
                      <Dialog
                        aria-label={`${group.label} navigation`}
                        className="max-h-[calc(100dvh-104px)] overflow-y-auto overscroll-contain outline-hidden"
                      >
                        <ul className="space-y-0.5 p-2">
                          {group.links.map((link) => (
                            <li key={link.href}>
                              <NavigationLink
                                item={link}
                                pathname={pathname}
                                onNavigate={() => setActiveGroup(null)}
                                className="w-full"
                              />
                            </li>
                          ))}
                        </ul>
                        {group.supportingLinks?.length ? (
                          <ul className="space-y-0.5 border-t border-slate-200 bg-slate-50 p-2">
                            {group.supportingLinks.map((link) => (
                              <li key={link.href}>
                                <NavigationLink
                                  item={link}
                                  pathname={pathname}
                                  onNavigate={() => setActiveGroup(null)}
                                  className="w-full"
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </Dialog>
                    </Popover>
                  </DialogTrigger>
                </li>
              ))}
              <li>
                <NavigationLink
                  item={contactLink}
                  pathname={pathname}
                  className="px-2 font-semibold xl:px-3"
                />
              </li>
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <MarketingButton
              action="speed"
              size="sm"
              className="hidden xl:inline-flex"
            />
            <MarketingButton
              action="contact"
              size="sm"
              className="hidden sm:inline-flex"
            />
            <DialogTrigger isOpen={mobileOpen} onOpenChange={setMobileOpen}>
              <Button
                aria-label="Open navigation menu"
                className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-slate-700 outline-uui-brand hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
              >
                <MenuIcon className="size-6" />
              </Button>
              <MobileNavigation
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </DialogTrigger>
          </div>
        </div>
      </div>
    </header>
  );
}
