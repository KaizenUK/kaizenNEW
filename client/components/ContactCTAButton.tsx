import { MarketingButton } from "./untitled/MarketingButton";

export default function ContactCTAButton({
  className,
}: {
  className?: string;
}) {
  return <MarketingButton action="contact" className={className} />;
}
