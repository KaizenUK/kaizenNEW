import type React from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { requiresDocumentNavigation } from "@/lib/navigation";

type LinkLikeProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
  replace?: boolean;
};

export default function AppLink({
  href,
  replace,
  children,
  ...anchorProps
}: LinkLikeProps) {
  const inRouter = useInRouterContext();
  const forceDocumentNav = requiresDocumentNavigation(href);

  if (
    inRouter &&
    !forceDocumentNav &&
    !anchorProps.target &&
    !anchorProps.download
  ) {
    return (
      <Link to={href} replace={replace} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} {...anchorProps}>
      {children}
    </a>
  );
}
