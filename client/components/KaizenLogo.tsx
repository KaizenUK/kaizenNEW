import { cn } from "@/lib/utils";

interface KaizenLogoProps {
  className?: string;
  title?: string;
}

export default function KaizenLogo({
  className,
  title = "Kaizen",
}: KaizenLogoProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-block bg-current", className)}
      style={{
        WebkitMaskImage: "url(/logo.svg)",
        maskImage: "url(/logo.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
