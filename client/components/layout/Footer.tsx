import { useState, type FormEvent } from "react";
import KaizenLogo from "@/components/KaizenLogo";
import { ArrowRight, Linkedin, Instagram, Check } from "lucide-react";
import AppLink from "@/components/routing/AppLink";

const CONSENT_TEXT =
  "I consent to receiving marketing emails from Kaizen Web Ltd about services, insights, and offers. I understand I can unsubscribe at any time.";

const Footer: React.FC = () => {
  const buildNumberRaw = (import.meta.env.VITE_BUILD_NUMBER || "").trim();
  const buildShaRaw = (import.meta.env.VITE_BUILD_SHA || "").trim();
  const buildShaShort = buildShaRaw ? buildShaRaw.slice(0, 7) : "";

  // Prefer a human build number, fall back to sha, otherwise show nothing (unless you want "local").
  const buildLabel = buildNumberRaw || buildShaShort;
  const showBuild = Boolean(buildLabel);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!consent) {
      setErrorMessage("You must consent to receive marketing emails.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const newsletterSupabase = getSupabaseClient();

      if (!newsletterSupabase) {
        setErrorMessage(
          "Database connection unavailable. Please try again later.",
        );
        setSubmitStatus("error");
        return;
      }

      const { error } = await newsletterSupabase
        .from("newsletter_subscribers")
        .insert({
          email: email.toLowerCase().trim(),
          marketing_consent: true,
          consent_text: CONSENT_TEXT,
          source_page:
            typeof window !== "undefined" ? window.location.pathname : "/",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });

      if (error) {
        if (error.code === "23505") {
          setErrorMessage("This email is already subscribed.");
        } else {
          setErrorMessage("Something went wrong. Please try again.");
        }
        setSubmitStatus("error");
      } else {
        setSubmitStatus("success");
        setEmail("");
        setConsent(false);
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const footerLinks = [
    { label: "Services", href: "/services" },
    { label: "Web Design Liverpool", href: "/web-design-liverpool" },
    { label: "Web Design Wirral", href: "/web-design-wirral" },
    { label: "Web Design Chester", href: "/web-design-chester" },
    { label: "Web Design Warrington", href: "/web-design-warrington" },
    { label: "Ecommerce", href: "/services/ecommerce" },
    { label: "Local SEO", href: "/services/local-seo" },
    { label: "WordPress Design", href: "/services/wordpress-web-design" },
    { label: "Digital Transformation", href: "/digital-transformation" },
    { label: "Agile Coaching", href: "/agile-coaching" },
    { label: "Product Owner", href: "/contract-product-owner" },
    { label: "Rescue", href: "/project-rescue" },
    { label: "Speed Scanner", href: "/performance-scanner" },
    { label: "Blog", href: "/blog" },
    { label: "Cases", href: "/case-studies" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Cookies", href: "/cookie-policy" },
    { label: "GDPR", href: "/gdpr-policy" },
    { label: "Terms", href: "/terms-and-conditions" },
  ];

  return (
    <footer className="bg-gray-950 text-white overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg
          className="absolute w-[120%] h-full left-0 top-0 opacity-[0.03]"
          viewBox="0 0 1771 923"
          fill="none"
          preserveAspectRatio="xMinYMin slice"
        >
          <path d="M0 0h166.452v923H0V0Z" fill="url(#grad1)" />
          <path
            d="M1089.25 0h177.56L900.237 923h-177.56L1089.25 0Z"
            fill="url(#grad2)"
          />
          <path d="M240.88 0h166.452v923H240.88V0Z" fill="url(#grad3)" />
          <path
            d="M1341.25 0h177.56l-366.57 923H974.677L1341.25 0Z"
            fill="url(#grad4)"
          />
          <path d="M481.791 0h166.452v923H481.791V0Z" fill="url(#grad5)" />
          <path
            d="M1593.25 0h177.56l-366.58 923h-177.56L1593.25 0Z"
            fill="url(#grad6)"
          />
          <defs>
            <linearGradient
              id="grad1"
              x1="83"
              y1="923"
              x2="83"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient
              id="grad2"
              x1="994"
              y1="923"
              x2="994"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient
              id="grad3"
              x1="324"
              y1="923"
              x2="324"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient
              id="grad4"
              x1="1246"
              y1="923"
              x2="1246"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient
              id="grad5"
              x1="565"
              y1="923"
              x2="565"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient
              id="grad6"
              x1="1498"
              y1="923"
              x2="1498"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-20 md:py-28 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white max-w-xl">
              Get started today
            </h2>
            <AppLink href="/contact" className="group flex items-center gap-0">
              <span className="px-6 py-5 bg-cyan-500 text-white text-xs font-medium uppercase tracking-widest border border-cyan-500 transition-colors hover:bg-cyan-600 hover:border-cyan-600">
                Start Your Project
              </span>
              <span className="w-14 h-14 bg-cyan-500 border border-cyan-500 flex items-center justify-center transition-colors hover:bg-cyan-600 hover:border-cyan-600 overflow-hidden relative">
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </AppLink>
          </div>
        </div>

        <div className="py-12 flex flex-col gap-12">
          <div className="flex text-white">
            <KaizenLogo className="h-6 md:h-8 w-[120px]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-2">
            <div className="lg:col-span-1">
              <p className="text-lg text-white/60 leading-relaxed">
                High-performance websites and product leadership for ambitious
                businesses.
              </p>
            </div>

            <div className="lg:col-span-1">
              <h3 className="text-xs font-medium uppercase tracking-widest text-white mb-6">
                Contact Us
              </h3>
              <div className="flex flex-col gap-4">
                <address className="not-italic text-white/60 text-sm leading-relaxed">
                  <span className="block">Wirral, Merseyside</span>
                  <span className="block">United Kingdom</span>
                </address>
                <AppLink
                  href="/contact"
                  className="text-white/60 hover:text-white transition text-sm text-left underline underline-offset-2"
                >
                  Contact us
                </AppLink>
              </div>
            </div>

            <div className="lg:col-span-1">
              <h3 className="text-xs font-medium uppercase tracking-widest text-white mb-6">
                Follow
              </h3>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.linkedin.com/company/kaizen-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white transition"
                  aria-label="LinkedIn"
                >
                  <Linkedin size={20} />
                </a>
                <a
                  href="https://www.instagram.com/kaizenwebliverpool"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white transition"
                  aria-label="Instagram"
                >
                  <Instagram size={20} />
                </a>
              </div>
            </div>

            <div className="lg:col-span-1 transform lg:-translate-x-6">
              <h3 className="text-xs font-medium uppercase tracking-widest text-white mb-6">
                Stay up to date
              </h3>
              {submitStatus === "success" ? (
                <div className="flex items-center gap-2 text-green-400">
                  <Check size={18} />
                  <span className="text-sm">Thanks for subscribing!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                  <div className="flex gap-2 border border-white/20 focus-within:border-cyan-500 transition">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 bg-transparent text-white placeholder:text-white/40 px-4 py-3 text-sm focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-3 bg-white text-gray-950 text-xs font-medium uppercase tracking-wider hover:bg-white/90 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSubmitting ? "..." : "Submit"}
                    </button>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 border transition ${
                          consent
                            ? "bg-cyan-500 border-cyan-500"
                            : "border-white/30 group-hover:border-white/50"
                        } flex items-center justify-center`}
                      >
                        {consent && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                    <span className="text-xs text-white/50 leading-relaxed">
                      I consent to receiving marketing emails from Kaizen.
                    </span>
                  </label>

                  {errorMessage && (
                    <p className="text-xs text-red-400">{errorMessage}</p>
                  )}
                </form>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="h-px bg-white/10" />
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <AppLink
                    href={link.href}
                    className="text-xs font-medium uppercase tracking-widest text-white/80 hover:text-white transition"
                  >
                    {link.label}
                  </AppLink>
                </li>
              ))}
            </ul>
            <div className="h-px bg-white/10" />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40 text-center md:text-left">
              (c) Kaizen Web Ltd t/a Kaizen (Company No. 17007703). All rights
              reserved {new Date().getFullYear()}
            </p>
            <div className="text-center md:text-right">
              <p className="text-xs text-white/30">Made with care on the Wirral</p>

              {showBuild && (
                <p
                  className="mt-1 text-[11px] font-mono tracking-wide text-cyan-300/85"
                  title="Deployed build reference"
                >
                  Build {buildLabel}
                  {buildNumberRaw && buildShaShort && (
                    <span className="text-cyan-200/70"> ({buildShaShort})</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
