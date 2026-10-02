import {
  Button,
  Dialog,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ChevronDownIcon, XIcon } from "../../icons/CriticalIcons";
import { MarketingButton } from "../MarketingButton";
import { NavigationLink } from "./NavigationLink";
import {
  contactLink,
  isCurrentGroup,
  navigationGroups,
  socialLinks,
} from "./navigation-data";

interface Props {
  pathname: string;
  onNavigate: () => void;
}

/** Render inside the header's DialogTrigger so focus returns to its button. */
export function MobileNavigation({ pathname, onNavigate }: Props) {
  return (
    <ModalOverlay
      isDismissable
      className="fixed inset-0 z-[100] flex h-[var(--visual-viewport-height,100dvh)] items-start justify-end bg-slate-950/50 p-2 font-body backdrop-blur-sm lg:hidden"
    >
      <Modal className="flex h-full w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl outline-hidden">
        <Dialog
          aria-label="Site navigation"
          className="flex min-h-0 w-full flex-col text-slate-950 outline-hidden"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
            <Heading slot="title" className="text-lg font-semibold">
              Menu
            </Heading>
            <Button
              slot="close"
              autoFocus
              aria-label="Close navigation menu"
              className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-slate-700 outline-uui-brand hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <XIcon className="size-6" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <nav aria-label="Mobile navigation">
              <DisclosureGroup allowsMultipleExpanded>
                {navigationGroups.map((group) => (
                  <Disclosure
                    id={group.id}
                    key={group.id}
                    className="border-b border-slate-200"
                  >
                    <Heading level={3} className="m-0">
                      <Button
                        slot="trigger"
                        className="group flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-base font-semibold outline-uui-brand hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <span
                          className={
                            isCurrentGroup(group, pathname)
                              ? "text-uui-brand-800"
                              : "text-slate-950"
                          }
                        >
                          {group.label}
                        </span>
                        <ChevronDownIcon className="size-5 text-slate-500 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" />
                      </Button>
                    </Heading>
                    <DisclosurePanel className="pb-3">
                      <ul className="space-y-1">
                        {group.links.map((link) => (
                          <li key={link.href}>
                            <NavigationLink
                              item={link}
                              pathname={pathname}
                              onNavigate={onNavigate}
                              className="w-full"
                            />
                          </li>
                        ))}
                      </ul>
                      {group.supportingLinks?.length ? (
                        <ul className="mt-3 space-y-1 rounded-xl bg-slate-50 p-1">
                          {group.supportingLinks.map((link) => (
                            <li key={link.href}>
                              <NavigationLink
                                item={link}
                                pathname={pathname}
                                onNavigate={onNavigate}
                                className="w-full"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </DisclosurePanel>
                  </Disclosure>
                ))}
              </DisclosureGroup>
              <NavigationLink
                item={contactLink}
                pathname={pathname}
                onNavigate={onNavigate}
                className="min-h-14 w-full text-base font-semibold"
              />
            </nav>

            <div className="mt-3 flex flex-wrap gap-x-1 border-t border-slate-200 pt-3">
              {socialLinks.map((link) => (
                <NavigationLink
                  key={link.href}
                  item={link}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>

          <div className="grid shrink-0 gap-3 border-t border-slate-200 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <MarketingButton
              action="contact"
              onPress={onNavigate}
              className="w-full"
            />
            <MarketingButton
              action="speed"
              onPress={onNavigate}
              className="w-full"
            />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
