import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="w-full max-w-lg p-0 border-0 overflow-hidden">
        <DialogTitle className="sr-only">Book a Meeting</DialogTitle>
        <div className="p-6">
          <div className="calendly-inline-widget" data-url="https://calendly.com/sean-kaizenweb/30-minute-meeting-clone" style={{ minWidth: "320px", height: "700px" }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
