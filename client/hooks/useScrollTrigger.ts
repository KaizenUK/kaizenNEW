import { useEffect, useRef, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollTriggerConfig {
  trigger?: HTMLElement | string;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
  markers?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onEnterBack?: () => void;
  onLeaveBack?: () => void;
}

/**
 * Hook to easily use GSAP ScrollTrigger with React refs
 */
export const useScrollTrigger = <T extends HTMLElement>(
  config: ScrollTriggerConfig
): RefObject<T> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const scrollTrigger = ScrollTrigger.create({
      trigger: ref.current,
      start: config.start || 'top 80%',
      end: config.end || 'bottom 20%',
      scrub: config.scrub,
      pin: config.pin,
      markers: config.markers,
      onEnter: config.onEnter,
      onLeave: config.onLeave,
      onEnterBack: config.onEnterBack,
      onLeaveBack: config.onLeaveBack,
    });

    return () => {
      scrollTrigger.kill();
    };
  }, [config]);

  return ref;
};
