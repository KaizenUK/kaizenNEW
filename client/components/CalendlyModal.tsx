import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CalendlyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendlyModal({ isOpen, onClose }: CalendlyModalProps) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Load the Calendly script once on first render
    const existingScript = document.querySelector(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg p-0 border-0 overflow-hidden">
        <DialogTitle className="sr-only">Book a Meeting</DialogTitle>
        <div className="p-6">
          <div
            className="calendly-inline-widget"
            data-url="https://calendly.com/sean-kaizenweb/30-minute-meeting-clone"
            style={{ minWidth: "320px", height: "700px" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
