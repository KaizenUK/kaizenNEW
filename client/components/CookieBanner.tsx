import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface CookieConsent {
  strictlyNecessary: boolean;
  functional: boolean;
  analytics: boolean;
}

export function CookieBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    strictlyNecessary: true,
    functional: false,
    analytics: false,
  });

  useEffect(() => {
    // Don't show cookie banner inside iframes (e.g. Sanity Presentation preview)
    if (typeof window !== "undefined" && window !== window.parent) return;

    const savedConsent = localStorage.getItem("kaizen-cookie-consent");
    if (!savedConsent) {
      setIsOpen(true);
    } else {
      try {
        setConsent(JSON.parse(savedConsent));
      } catch {
        setIsOpen(true);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookieConsent = {
      strictlyNecessary: true,
      functional: true,
      analytics: true,
    };
    setConsent(allAccepted);
    localStorage.setItem("kaizen-cookie-consent", JSON.stringify(allAccepted));
    setIsOpen(false);
    setShowSettings(false);
    loadAnalyticsIfConsented(allAccepted);
  };

  const handleRejectAll = () => {
    const minimalConsent: CookieConsent = {
      strictlyNecessary: true,
      functional: false,
      analytics: false,
    };
    setConsent(minimalConsent);
    localStorage.setItem(
      "kaizen-cookie-consent",
      JSON.stringify(minimalConsent),
    );
    setIsOpen(false);
    setShowSettings(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("kaizen-cookie-consent", JSON.stringify(consent));
    setIsOpen(false);
    setShowSettings(false);
    loadAnalyticsIfConsented(consent);
  };

  const toggleFunctional = () => {
    setConsent((prev) => ({
      ...prev,
      functional: !prev.functional,
    }));
  };

  const toggleAnalytics = () => {
    setConsent((prev) => ({
      ...prev,
      analytics: !prev.analytics,
    }));
  };

  const loadAnalyticsIfConsented = (consentSettings: CookieConsent) => {
    if (consentSettings.analytics && typeof window !== "undefined") {
      // Load Google Analytics or other analytics tools here
      // For now, this is a placeholder for where you'd initialize GA
      (window as any).consentMode = {
        analytics_storage: consentSettings.analytics ? "granted" : "denied",
      };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Cookie Banner */}
      {!showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-kaizen-text-dark/10 shadow-lg">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-heading font-bold text-kaizen-dark mb-2">
                  We Value Your Privacy
                </h3>
                <p className="text-sm md:text-base text-kaizen-text-dark/70 leading-relaxed">
                  We use a few cookies to run this site and help us improve. We
                  use <span className="font-bold">Strictly Necessary</span>{" "}
                  cookies to make the site work. We'd also like to use{" "}
                  <span className="font-bold">Analytics</span> cookies to see
                  how the site is used. You can choose what to accept.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0">
                <button
                  onClick={handleAcceptAll}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
                >
                  Accept All
                </button>

                <button
                  onClick={handleRejectAll}
                  className="px-6 py-2 rounded-lg border-2 border-kaizen-text-dark/20 text-kaizen-dark font-heading font-bold hover:border-kaizen-cyan transition"
                >
                  Reject All
                </button>

                <button
                  onClick={() => setShowSettings(true)}
                  className="px-6 py-2 rounded-lg text-kaizen-cyan font-heading font-bold hover:underline transition"
                >
                  Manage Cookies
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-kaizen-text-dark/10">
              <h2 className="text-2xl font-heading font-bold text-kaizen-dark">
                Manage Cookies
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 rounded transition"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-kaizen-text-dark" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Strictly Necessary - Always On */}
              <div className="flex items-start gap-4 p-4 bg-kaizen-light rounded-lg">
                <div className="flex-1">
                  <h3 className="font-heading font-bold text-kaizen-dark mb-1">
                    Strictly Necessary
                  </h3>
                  <p className="text-sm text-kaizen-text-dark/70">
                    Required for the site to function.
                  </p>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-6 bg-kaizen-cyan rounded-full flex items-center px-1 cursor-not-allowed opacity-60">
                    <div className="w-4 h-4 bg-white rounded-full ml-auto"></div>
                  </div>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start gap-4 p-4 border border-kaizen-light rounded-lg">
                <div className="flex-1">
                  <h3 className="font-heading font-bold text-kaizen-dark mb-1">
                    Functional
                  </h3>
                  <p className="text-sm text-kaizen-text-dark/70">
                    Remember your preferences and improve your experience.
                  </p>
                </div>
                <button
                  onClick={toggleFunctional}
                  className={`flex-shrink-0 w-12 h-6 rounded-full flex items-center px-1 transition ${
                    consent.functional
                      ? "bg-kaizen-cyan"
                      : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition ${
                      consent.functional ? "ml-auto" : ""
                    }`}
                  ></div>
                </button>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start gap-4 p-4 border border-kaizen-light rounded-lg">
                <div className="flex-1">
                  <h3 className="font-heading font-bold text-kaizen-dark mb-1">
                    Analytics
                  </h3>
                  <p className="text-sm text-kaizen-text-dark/70">
                    Help us improve by understanding how you use our site.
                  </p>
                </div>
                <button
                  onClick={toggleAnalytics}
                  className={`flex-shrink-0 w-12 h-6 rounded-full flex items-center px-1 transition ${
                    consent.analytics
                      ? "bg-kaizen-cyan"
                      : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition ${
                      consent.analytics ? "ml-auto" : ""
                    }`}
                  ></div>
                </button>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-kaizen-text-dark/10">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-kaizen-text-dark/20 text-kaizen-dark font-heading font-bold hover:border-kaizen-cyan transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
