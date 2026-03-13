import { useState } from "react";
import { ArrowRight } from "lucide-react";
import ContactFormModal from "./ContactFormModal";

interface ContactCTAButtonProps {
  label: string;
  className?: string;
}

export default function ContactCTAButton({ label, className = "" }: ContactCTAButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative isolate inline-flex items-center justify-center overflow-hidden rounded-[18px] border border-white/25 px-5 py-2.5 text-[16px] text-white no-underline shadow-[0_12px_32px_rgba(10,34,102,0.34)] transition-transform duration-200 hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(10,34,102,0.4)] ${className}`}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,#266bff_0%,#1658e8_56%,#0c3eb9_100%)]" />
        <span className="pointer-events-none absolute inset-px rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_20%,rgba(8,38,112,0.16)_100%)]" />
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(255,255,255,0.08)]" />
        <span className="relative z-1 inline-flex items-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] text-white">
          <span>{label}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </button>
      <ContactFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
