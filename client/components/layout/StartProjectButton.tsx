import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import AppLink from "@/components/routing/AppLink";
import { cn } from "@/lib/utils";

interface StartProjectButtonProps {
  href?: string;
  className?: string;
  onClick?: () => void;
  compact?: boolean;
}

interface LottieInstance {
  destroy: () => void;
}

interface LottiePlayer {
  loadAnimation: (options: {
    container: HTMLElement;
    renderer: "svg" | "canvas" | "html";
    loop: boolean;
    autoplay: boolean;
    animationData: unknown;
    rendererSettings?: {
      preserveAspectRatio?: string;
      progressiveLoad?: boolean;
    };
  }) => LottieInstance;
}

declare global {
  interface Window {
    lottie?: LottiePlayer;
  }
}

let lottieScriptPromise: Promise<LottiePlayer> | null = null;
let lottieAnimationDataPromise: Promise<unknown> | null = null;

function loadAnimationData(): Promise<unknown> {
  if (lottieAnimationDataPromise) {
    return lottieAnimationDataPromise;
  }

  lottieAnimationDataPromise = fetch("/animations/start-project-button-lottie.json", {
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load nav CTA animation data.");
      }

      return response.json();
    })
    .catch((error) => {
      lottieAnimationDataPromise = null;
      throw error;
    });

  return lottieAnimationDataPromise;
}

function loadLottiePlayer(): Promise<LottiePlayer> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Lottie player can only load in the browser."));
  }

  if (window.lottie) {
    return Promise.resolve(window.lottie);
  }

  if (lottieScriptPromise) {
    return lottieScriptPromise;
  }

  lottieScriptPromise = new Promise<LottiePlayer>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-lottie-player="site-nav-cta"]',
    );

    const finish = () => {
      if (window.lottie) {
        resolve(window.lottie);
        return;
      }

      reject(new Error("Lottie player script loaded but window.lottie was not found."));
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        finish();
        return;
      }

      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Lottie player script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/lottie_svg.min.js";
    script.async = true;
    script.dataset.lottiePlayer = "site-nav-cta";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        finish();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Lottie player script.")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    lottieScriptPromise = null;
    throw error;
  });

  return lottieScriptPromise;
}

export default function StartProjectButton({
  href = "/contact/",
  className,
  onClick,
  compact = false,
}: StartProjectButtonProps) {
  const animationContainerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!animationContainerRef.current || typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let isCancelled = false;
    let animation: LottieInstance | undefined;
    const container = animationContainerRef.current;

    void Promise.all([loadLottiePlayer(), loadAnimationData()])
      .then(([lottie, animationData]) => {
        if (isCancelled || !container) {
          return;
        }

        try {
          animation = lottie.loadAnimation({
            container,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData,
            rendererSettings: {
              preserveAspectRatio: "xMidYMid slice",
              progressiveLoad: true,
            },
          });
        } catch {
          container.textContent = "";
        }
      })
      .catch(() => {
        container.textContent = "";
      });

    return () => {
      isCancelled = true;
      animation?.destroy();
      container.textContent = "";
    };
  }, []);

  return (
    <AppLink
      href={href}
      onClick={onClick}
      className={cn(
        "group relative isolate inline-flex items-center justify-center overflow-hidden rounded-[18px] border border-white/25 text-white no-underline shadow-[0_12px_32px_rgba(10,34,102,0.34)] transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_40px_rgba(10,34,102,0.4)]",
        compact
          ? "min-h-[52px] px-4 py-3 text-[15px]"
          : "min-h-[48px] px-5 py-2.5 text-[16px]",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,#266bff_0%,#1658e8_56%,#0c3eb9_100%)]" />
      <span className="pointer-events-none absolute inset-[1px] rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_20%,rgba(8,38,112,0.16)_100%)]" />
      <span className="pointer-events-none absolute inset-[-42%] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.42)_42deg,rgba(96,255,202,0.26)_96deg,rgba(255,255,255,0)_168deg,rgba(255,255,255,0)_360deg)] opacity-50 blur-md [animation:spin_9s_linear_infinite]" />
      <span className="pointer-events-none absolute inset-[-28%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.34),rgba(255,255,255,0)_56%)] opacity-55 [animation:spin_6.5s_linear_infinite_reverse]" />
      <span className="pointer-events-none absolute inset-x-5 top-[8%] h-[46%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.36),rgba(255,255,255,0))] opacity-85 blur-md" />
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <span
          ref={animationContainerRef}
          aria-hidden="true"
          className="block h-full w-full scale-[1.24] opacity-[0.88] mix-blend-screen [filter:hue-rotate(34deg)_saturate(1.15)_brightness(1.04)]"
        />
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(255,255,255,0.08)]" />
      <span className="relative z-[1] inline-flex items-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] text-white">
        <span>Start Your Project</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </AppLink>
  );
}
