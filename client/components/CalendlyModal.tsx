import { useEffect } from "react";

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
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    loadCalendlyScript()
      .then(() => {
        if (cancelled || typeof window === "undefined") return;

        const calendly = (window as any).Calendly;
        if (!calendly || typeof calendly.initPopupWidget !== "function") {
          return;
        }

        calendly.initPopupWidget({
          url: "https://calendly.com/sean-kaizenweb/30-minute-meeting-clone",
        });
      })
      .catch(() => {
        // Swallow errors to avoid breaking the app if Calendly is unavailable
      })
      .finally(() => {
        // Reset the open state so the site never "freezes"
        onClose();
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, onClose]);

  return null;
}
