import { ArrowRight } from "@untitledui/icons";
import { Button } from "./base/buttons/button";
import { cx } from "./utils/cx";

export const marketingActions = {
  contact: { label: "Talk to us about your site", href: "/contact/" },
  speed: { label: "Check your website speed", href: "/performance-scanner/" },
  caseStudy: {
    label: "See the case study",
    href: "/case-studies/midland-oil-group/",
  },
} as const;

export const contactResponse =
  "One of us will get back to you the same day, or the next working day at the latest.";

interface Props {
  action: keyof typeof marketingActions;
  href?: string;
  target?: "_blank" | "_self";
  variant?: "primary" | "secondary" | "link";
  size?: "sm" | "lg" | "xl";
  className?: string;
  onDark?: boolean;
  onPress?: () => void;
}

/** Three public actions, using the same Untitled UI button on every page. */
export function MarketingButton({
  action,
  href,
  target,
  variant,
  size = "lg",
  className,
  onDark = false,
  onPress,
}: Props) {
  const item = marketingActions[action];
  const style = variant ?? (action === "contact" ? "primary" : "secondary");
  return (
    <Button
      href={href ?? item.href}
      target={target}
      rel={target === "_blank" ? "noopener" : undefined}
      color={style === "link" ? "link-color" : style}
      size={size}
      className={cx(
        style === "link" &&
          onDark &&
          "text-uui-brand-200 hover:text-white *:data-icon:text-uui-brand-200 hover:*:data-icon:text-white",
        className,
      )}
      onPress={onPress}
      iconTrailing={
        action === "contact" || action === "caseStudy" ? ArrowRight : undefined
      }
    >
      {item.label}
    </Button>
  );
}
