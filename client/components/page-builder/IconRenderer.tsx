import { lazy, Suspense, useMemo } from "react";
import { stegaClean } from "@sanity/client/stega";
import type { IconPickerValue } from "@shared/pageBuilder";

interface IconRendererProps {
  icon: string | IconPickerValue | undefined | null;
  size?: number;
  className?: string;
}

/**
 * Renders an icon from the sanity-plugin-icon-picker value.
 * - String values render as text/emoji (backward compat).
 * - Object values with provider "lu" render via lucide-react.
 * - Other providers show a fallback dot.
 */
export default function IconRenderer({ icon, size = 24, className }: IconRendererProps) {
  if (!icon) return null;

  // Legacy string value (emoji or text)
  if (typeof icon === "string") {
    return <span className={className}>{stegaClean(icon)}</span>;
  }

  // Icon picker object — clean stega from all fields
  if (typeof icon === "object" && "name" in icon && "provider" in icon) {
    const cleanName = stegaClean(icon.name);
    const cleanProvider = stegaClean(icon.provider);
    if (!cleanName || !cleanProvider) return null;

    return (
      <LucideIconLazy
        iconName={cleanName}
        provider={cleanProvider}
        size={size}
        className={className}
      />
    );
  }

  return null;
}

/** Cache lazy components so they aren't recreated on every render. */
const lazyIconCache = new Map<string, React.LazyExoticComponent<React.ComponentType<{ size?: number; className?: string }>>>();

function getLazyIcon(iconName: string, provider: string) {
  const cacheKey = `${provider}:${iconName}`;
  if (lazyIconCache.has(cacheKey)) return lazyIconCache.get(cacheKey)!;

  const LazyIcon = lazy(async () => {
    if (provider === "lu") {
      // lucide-react icons: stored as "LuHeart" → export name "Heart"
      const exportName = iconName.replace(/^Lu/, "");
      try {
        const mod = await import("lucide-react");
        const Icon = (mod as Record<string, unknown>)[exportName] as
          | React.ComponentType<{ size?: number; className?: string }>
          | undefined;
        if (Icon) return { default: Icon };
      } catch {
        // fall through to fallback
      }
    }

    // Fallback for unsupported providers or missing icons
    const Fallback = ({ className: cn }: { size?: number; className?: string }) => (
      <span className={cn} title={iconName}>&#9679;</span>
    );
    return { default: Fallback as React.ComponentType<{ size?: number; className?: string }> };
  });

  lazyIconCache.set(cacheKey, LazyIcon);
  return LazyIcon;
}

function LucideIconLazy({
  iconName,
  provider,
  size,
  className,
}: {
  iconName: string;
  provider: string;
  size: number;
  className?: string;
}) {
  const LazyIcon = useMemo(() => getLazyIcon(iconName, provider), [iconName, provider]);

  return (
    <Suspense fallback={<span className={className}>&#9679;</span>}>
      <LazyIcon size={size} className={className} />
    </Suspense>
  );
}
