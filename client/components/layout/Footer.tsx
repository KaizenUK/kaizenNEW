import { useEffect, useState, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Linkedin, Instagram, Check } from "lucide-react";
import { openCrisp } from "@/lib/crisp-utils";
import { createClient } from "@supabase/supabase-js";

// Newsletter Supabase client (unified)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const newsletterSupabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const CONSENT_TEXT =
  "I consent to receiving marketing emails from Kaizen Web Ltd about services, insights, and offers. I understand I can unsubscribe at any time.";

const Footer: React.FC = () => {
  const location = useLocation();
  const [buildVersion, setBuildVersion] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetch("/build-timestamp.txt")
      .then((res) => (res.ok ? res.text() : null))
      .then((timestamp) => {
        if (timestamp) {
          const date = new Date(timestamp.trim());
          const formatted = date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London",
          });
          setBuildVersion(formatted);
        }
      })
      .catch(() => {});
  }, []);

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!consent) {
      setErrorMessage("You must consent to receive marketing emails.");
      return;
    }

    if (!newsletterSupabase) {
      setErrorMessage(
        "Database connection unavailable. Please try again later.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await newsletterSupabase
        .from("newsletter_subscribers")
        .insert({
          email: email.toLowerCase().trim(),
          marketing_consent: true,
          consent_text: CONSENT_TEXT,
          source_page: location.pathname,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
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
    { label: "Rescue", href: "/project-rescue" },
    { label: "Coaching", href: "/agile-coaching" },
    { label: "Blog", href: "/blog" },
    { label: "Cases", href: "/case-studies" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Cookies", href: "/cookie-policy" },
    { label: "GDPR", href: "/gdpr-policy" },
  ];

  return (
    <footer className="bg-gray-950 text-white overflow-hidden relative">
      {/* Decorative Background SVG */}
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
        {/* CTA Section */}
        <div className="py-20 md:py-28 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white max-w-xl">
              Get started today
            </h2>
            <motion.button
              onClick={() => openCrisp()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-0"
            >
              <span className="px-6 py-5 bg-cyan-500 text-white text-xs font-medium uppercase tracking-widest border border-cyan-500 transition-colors hover:bg-cyan-600 hover:border-cyan-600">
                Start a Chat
              </span>
              <span className="w-14 h-14 bg-cyan-500 border border-cyan-500 flex items-center justify-center transition-colors hover:bg-cyan-600 hover:border-cyan-600 overflow-hidden relative">
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </motion.button>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="py-12 flex flex-col gap-12">
          {/* Logo */}
          <div className="flex">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F326ffc7c8bf9463f93847a3777cf16eb?format=webp"
              alt="Kaizen"
              className="h-6 md:h-8 w-auto invert brightness-0 filter"
              loading="lazy"
            />
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-2">
            {/* Tagline */}
            <div className="lg:col-span-1">
              <p className="text-lg text-white/60 leading-relaxed">
                High-performance websites and product leadership for ambitious
                businesses.
              </p>
            </div>

            {/* Contact Us */}
            <div className="lg:col-span-1">
              <h3 className="text-xs font-medium uppercase tracking-widest text-white mb-6">
                Contact Us
              </h3>
              <div className="flex flex-col gap-4">
                <address className="not-italic text-white/60 text-sm leading-relaxed">
                  <span className="block">Wirral, Merseyside</span>
                  <span className="block">United Kingdom</span>
                </address>
                <button
                  onClick={() => openCrisp()}
                  className="text-white/60 hover:text-white transition text-sm text-left underline underline-offset-2"
                >
                  Chat with us
                </button>
              </div>
            </div>

            {/* Social */}
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

            {/* Newsletter */}
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

                  {/* Consent Checkbox */}
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

          {/* Navigation Links */}
          <div className="flex flex-col gap-8">
            <div className="h-px bg-white/10" />
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-xs font-medium uppercase tracking-widest text-white/80 hover:text-white transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="h-px bg-white/10" />
          </div>

          {/* Copyright */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40 text-center md:text-left">
              © Kaizen Web Ltd t/a Kaizen (Company No. 17007703). All rights
              reserved {new Date().getFullYear()}
              {buildVersion && (
                <span className="ml-2 text-white/25" title="Build version">
                  • Build: {buildVersion}
                </span>
              )}
            </p>
            <p className="text-xs text-white/30">
              Made with care on the Wirral
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
