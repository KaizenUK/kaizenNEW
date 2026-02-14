import type { ReactNode, SVGProps } from "react";

type CriticalIconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
};

function CriticalIconBase({
  size = 24,
  children,
  ...props
}: CriticalIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </CriticalIconBase>
  );
}

export function ArrowUpRightIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </CriticalIconBase>
  );
}

export function ChevronDownIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </CriticalIconBase>
  );
}

export function MenuIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="M4 12h16" />
      <path d="M4 6h16" />
      <path d="M4 18h16" />
    </CriticalIconBase>
  );
}

export function XIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </CriticalIconBase>
  );
}

export function ZapIcon(props: CriticalIconProps) {
  return (
    <CriticalIconBase {...props}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </CriticalIconBase>
  );
}
