import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface FeatureCardMotionProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export default function FeatureCardMotion({
  href,
  className,
  children,
}: FeatureCardMotionProps) {
  return (
    <motion.a
      href={href}
      className={className}
      whileHover={{
        y: -3,
        borderColor: "rgba(255,255,255,0.20)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.a>
  );
}
