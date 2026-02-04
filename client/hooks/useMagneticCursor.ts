import { useEffect, useRef, RefObject } from 'react';
import { gsap } from 'gsap';

interface MagneticConfig {
  strength?: number; // 0.2 = subtle, 0.8 = strong
  speed?: number; // Duration of animation in seconds
}

/**
 * Hook for magnetic cursor effect (elements follow cursor)
 */
export const useMagneticCursor = <T extends HTMLElement>(
  config: MagneticConfig = {}
): RefObject<T> => {
  const { strength = 0.3, speed = 0.3 } = config;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;

      gsap.to(element, {
        x: deltaX,
        y: deltaY,
        duration: speed,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(element, {
        x: 0,
        y: 0,
        duration: speed,
        ease: 'power2.out',
      });
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [strength, speed]);

  return ref;
};
