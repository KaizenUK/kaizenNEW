interface KaizenLogoProps {
  className?: string;
  title?: string;
}

export default function KaizenLogo({
  className,
  title = "Kaizen",
}: KaizenLogoProps) {
  const resolvedClassName = ["inline-block bg-current", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      role="img"
      aria-label={title}
      className={resolvedClassName}
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
