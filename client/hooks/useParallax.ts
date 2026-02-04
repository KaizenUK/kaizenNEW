import { useEffect, useRef, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ParallaxConfig {
  speed?: number; // 0.5 = slower, 2 = faster
  direction?: 'vertical' | 'horizontal';
}

/**
 * Hook for parallax scroll effects
 */
export const useParallax = <T extends HTMLElement>(
  config: ParallaxConfig = {}
): RefObject<T> => {
  const { speed = 0.5, direction = 'vertical' } = config;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const movement = (speed - 1) * 100;

    gsap.to(element, {
      [direction === 'vertical' ? 'y' : 'x']: movement,
      ease: 'none',
      scrollTrigger: {
        trigger: element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [speed, direction]);

  return ref;
};
