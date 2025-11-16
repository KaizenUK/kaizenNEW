import { createContext, useContext, ReactNode } from "react";

interface CrispContextType {
  crispUnread: number | null;
  crispOpen: number | null;
  crispLatest: string | null;
}

const CrispContext = createContext<CrispContextType | undefined>(undefined);

export function CrispProvider({
  children,
  crispUnread,
  crispOpen,
  crispLatest,
}: {
  children: ReactNode;
  crispUnread: number | null;
  crispOpen: number | null;
  crispLatest: string | null;
}) {
  return (
    <CrispContext.Provider value={{ crispUnread, crispOpen, crispLatest }}>
      {children}
    </CrispContext.Provider>
  );
}

export function useCrisp() {
  const context = useContext(CrispContext);
  if (context === undefined) {
    throw new Error("useCrisp must be used within a CrispProvider");
  }
  return context;
}
