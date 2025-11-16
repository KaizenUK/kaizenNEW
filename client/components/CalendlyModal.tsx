import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface CalendlyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

let calendlyScriptPromise: Promise<void> | null = null;

function loadCalendlyScript(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (calendlyScriptPromise) {
    return calendlyScriptPromise;
  }

  const existingStylesheet = document.querySelector<HTMLLinkElement>(
    'link[href="https://assets.calendly.com/assets/external/widget.css"]',
  );

  if (!existingStylesheet) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(link);
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src="https://assets.calendly.com/assets/external/widget.js"]',
  );

  if (existingScript) {
    calendlyScriptPromise = new Promise((resolve, reject) => {
      if ((window as any).Calendly) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Calendly script")),
      );
    });

    return calendlyScriptPromise;
  }

  calendlyScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Calendly script"));
    document.head.appendChild(script);
  });

  return calendlyScriptPromise;
}

export function CalendlyModal({ isOpen, onClose }: CalendlyModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    return;
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Initialise Calendly inline widget whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    loadCalendlyScript()
      .then(() => {
        if (cancelled || typeof window === "undefined") {
          return;
        }

        const calendly = (window as any).Calendly;
        const container = containerRef.current;

        if (
          !container ||
          !calendly ||
          typeof calendly.initInlineWidget !== "function"
        ) {
          return;
        }

        container.innerHTML = "";

        calendly.initInlineWidget({
          url: "https://calendly.com/sean-kaizenweb/30-minute-meeting-clone",
          parentElement: container,
          prefill: {},
          utm: {},
        });
      })
      .catch(() => {
        // Intentionally swallow errors to avoid breaking the rest of the app
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-50 w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg shadow-2xl mx-4 flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="p-6 pt-12 flex-1 flex flex-col">
          <div
            ref={containerRef}
            className="calendly-inline-widget w-full"
            style={{ minWidth: "320px", height: "700px" }}
          />
        </div>
      </div>
    </div>
  );
}
