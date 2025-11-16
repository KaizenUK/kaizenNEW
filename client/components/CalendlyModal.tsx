import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface CalendlyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendlyModal({ isOpen, onClose }: CalendlyModalProps) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    // Only load the script once on client-side
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]'
    );

    if (!existingScript && !scriptLoaded.current) {
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      script.onload = () => {
        scriptLoaded.current = true;
      };
      document.head.appendChild(script);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>

            {/* Calendly Widget */}
            <div className="p-6 pt-12">
              <div className="calendly-inline-widget" data-url="https://calendly.com/sean-kaizenweb/30-minute-meeting-clone" style={{ minWidth: "320px", height: "700px" }} />
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
