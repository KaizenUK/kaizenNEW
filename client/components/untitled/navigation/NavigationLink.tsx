import { ArrowUpRightIcon } from "../../icons/CriticalIcons";
import { cx } from "../utils/cx";
import {
  isCurrentLink,
  type NavigationLink as NavigationLinkData,
} from "./navigation-data";

interface Props {
  item: NavigationLinkData;
  pathname?: string;
  onNavigate?: () => void;
  className?: string;
  onDark?: boolean;
}

/** A document link, with the same focus and target treatment in each shell. */
export function NavigationLink({
  item,
  pathname,
  onNavigate,
  className,
  onDark = false,
}: Props) {
  const current = pathname !== undefined && isCurrentLink(item.href, pathname);
  return (
    <a
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cx(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-6 no-underline outline-uui-brand transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
        onDark
          ? "text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-uui-brand-300"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
        current && !onDark && "bg-uui-brand-50 text-uui-brand-800",
        className,
      )}
    >
      <span className="min-w-0">{item.label}</span>
      {item.external ? (
        <>
          <ArrowUpRightIcon className="size-4 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </>
      ) : null}
    </a>
  );
}
