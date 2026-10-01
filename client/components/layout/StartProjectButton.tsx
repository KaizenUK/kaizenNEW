import { MarketingButton } from "../untitled/MarketingButton";

interface StartProjectButtonProps {
  href?: string;
  className?: string;
  onClick?: () => void;
  compact?: boolean;
}

export default function StartProjectButton({
  href,
  className,
  onClick,
  compact,
}: StartProjectButtonProps) {
  return (
    <MarketingButton
      action="contact"
      href={href}
      className={className}
      onPress={onClick}
      size={compact ? "lg" : "sm"}
    />
  );
}
