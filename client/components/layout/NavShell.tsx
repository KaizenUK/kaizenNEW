import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import OffCanvasMenu from "@/components/layout/OffCanvasMenu";

export default function NavShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasOpenedMobileMenu, setHasOpenedMobileMenu] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      setHasOpenedMobileMenu(true);
    }
  }, [mobileMenuOpen]);

  return (
    <>
      <Header
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuChange={setMobileMenuOpen}
      />
      {mobileMenuOpen || hasOpenedMobileMenu ? (
        <OffCanvasMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      ) : null}
    </>
  );
}
