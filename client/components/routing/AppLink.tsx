import type React from "react";

type LinkLikeProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
  replace?: boolean;
};

export default function AppLink({
  href,
  replace: _replace,
  children,
  ...anchorProps
}: LinkLikeProps) {
  const rel = anchorProps.target === "_blank" && !anchorProps.rel
    ? "noopener noreferrer"
    : anchorProps.rel;

  return (
    <a
      href={href}
      {...anchorProps}
      rel={rel}
    >
      {children}
    </a>
  );
}
