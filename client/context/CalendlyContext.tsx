import React, { createContext, useState, ReactNode } from "react";

interface CalendlyContextValue {
  isCalendlyOpen: boolean;
  openCalendly: () => void;
  closeCalendly: () => void;
}

export const CalendlyContext = createContext<CalendlyContextValue | undefined>(
  undefined,
);

export function CalendlyProvider({ children }: { children: ReactNode }) {
  const [isCalendlyOpen, setIsCalendlyOpen] = useState(false);

  const openCalendly = () => setIsCalendlyOpen(true);
  const closeCalendly = () => setIsCalendlyOpen(false);

  return (
    <CalendlyContext.Provider
      value={{ isCalendlyOpen, openCalendly, closeCalendly }}
    >
      {children}
    </CalendlyContext.Provider>
  );
}

export function useCalendly() {
  const context = React.useContext(CalendlyContext);
  if (context === undefined) {
    throw new Error("useCalendly must be used within a CalendlyProvider");
  }
  return context;
}
