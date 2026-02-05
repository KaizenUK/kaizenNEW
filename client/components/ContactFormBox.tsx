import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Check, AlertCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type SubmitStatus = "idle" | "submitting" | "success" | "error";
type FormStep = 1 | 2 | 3 | 4 | 5;

export const ContactFormBox = () => {
  // Form data
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [consentToMarketing, setConsentToMarketing] = useState(false);
  const [consentToGDPR, setConsentToGDPR] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  // Form state
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Field-level errors
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [websiteError, setWebsiteError] = useState("");

  // Validation functions
  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "Email is required.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return "Email must include a domain (e.g., name@example.co.uk).";
    }
    return "";
  };

  const validatePhone = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return ""; // Phone is optional
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      return "Phone must be 10-13 digits (e.g., +441234567890 or 01234 567890).";
    }
    return "";
  };

  const validateWebsite = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return ""; // Website is optional
    // Just check that it looks like a domain (not validation for https)
    if (!trimmed.includes(".")) {
      return "Website must include a domain (e.g., example.co.uk).";
    }
    return "";
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handlePhoneBlur = () => {
    setPhoneError(validatePhone(phone));
  };

  const handleWebsiteBlur = () => {
    setWebsiteError(validateWebsite(website));
  };

  const handleNextStep = () => {
    setErrorMessage("");

    // Step 1: Name and Surname
    if (currentStep === 1) {
      if (!name.trim()) {
        setErrorMessage("Please enter your first name.");
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2: Email and Phone
    if (currentStep === 2) {
      const emailErr = validateEmail(email);
      const phoneErr = validatePhone(phone);
      setEmailError(emailErr);
      setPhoneError(phoneErr);
      if (emailErr || phoneErr) {
        return;
      }
      setCurrentStep(3);
      return;
    }

    // Step 3: Website decision
    if (currentStep === 3) {
      if (hasWebsite === null) {
        setErrorMessage("Please select yes or no.");
        return;
      }
      setCurrentStep(4);
      return;
    }

    // Step 4: Website field or straight to message
    if (currentStep === 4) {
      if (hasWebsite) {
        const websiteErr = validateWebsite(website);
        setWebsiteError(websiteErr);
        if (websiteErr) {
          return;
        }
      }
      setCurrentStep(5);
      return;
    }

    // Step 5: Message and consent
    if (currentStep === 5) {
      if (!message.trim()) {
        setErrorMessage("Please enter a message.");
        return;
      }
      if (!consentToGDPR) {
        setErrorMessage(
          "Please confirm you understand your data will be processed according to our privacy policy.",
        );
        return;
      }
      handleFinalSubmit();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as FormStep);
      setErrorMessage("");
    }
  };

  const resetForm = () => {
    setName("");
    setSurname("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setMessage("");
    setHasWebsite(null);
    setConsentToMarketing(false);
    setConsentToGDPR(false);
    setHoneypot("");
    setEmailError("");
    setPhoneError("");
    setWebsiteError("");
    setErrorMessage("");
  };

  const handleFinalSubmit = async () => {
    // Bot Detection: If honeypot field has any value, it's a bot
    if (honeypot.trim()) {
      console.warn("Honeypot field filled - likely a bot submission");
      // Silently fail or show success to confuse bots
      setStatus("success");
      resetForm();
      setTimeout(() => {
        setStatus("idle");
        setCurrentStep(1);
      }, 5000);
      return;
    }

    setStatus("submitting");

    if (!supabase) {
      setErrorMessage(
        "Database connection unavailable. Please try again later.",
      );
      setStatus("error");
      return;
    }

    try {
      const { error } = await supabase.from("contact_form_submissions").insert({
        name: name.trim(),
        last_name: surname.trim() || null,
        email: email.toLowerCase().trim(),
        phone: phone.trim() || null,
        website: website.trim() || null, // Store as user entered (no scheme required)
        message: message.trim(),
        marketing_consent: consentToMarketing,
        consent_to_gdpr: consentToGDPR,
        source_page: window.location.pathname,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (error) {
        setErrorMessage("Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
        setName("");
        setSurname("");
        setEmail("");
        setPhone("");
        setWebsite("");
        setMessage("");
        setConsentToMarketing(false);
        setConsentToGDPR(false);
        setHoneypot("");
        setTimeout(() => setStatus("idle"), 5000);
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <motion.div
      className="rounded-2xl border border-white/10 bg-gray-900/50 backdrop-blur-sm p-8 hover:border-white/20 transition"
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Mail size={24} className="text-cyan-500" />
        <h3 className="text-xl font-bold text-white">Send us a message</h3>
      </div>

      {status === "success" ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 py-8"
        >
          <Check size={24} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-400 font-medium">Message sent!</p>
            <p className="text-sm text-white/60">
              We'll get back to you shortly.
            </p>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Honeypot Field - Hidden from real users */}
          <input
            type="email"
            name="confirm_email"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {/* Name & Surname Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                disabled={status === "submitting"}
                className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Surname
              </label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Surname"
                disabled={status === "submitting"}
                className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-medium text-white mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="your@email.co.uk"
              disabled={status === "submitting"}
              className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none transition disabled:opacity-50 ${
                emailError
                  ? "border-red-500 focus:border-red-500"
                  : "border-white/10 focus:border-cyan-500"
              }`}
            />
            {emailError && (
              <p className="text-red-400 text-xs mt-1">{emailError}</p>
            )}
          </div>

          {/* Phone & Website Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="+44"
                disabled={status === "submitting"}
                className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none transition disabled:opacity-50 ${
                  phoneError
                    ? "border-red-500 focus:border-red-500"
                    : "border-white/10 focus:border-cyan-500"
                }`}
              />
              {phoneError && (
                <p className="text-red-400 text-xs mt-1">{phoneError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={handleWebsiteBlur}
                placeholder="example.co.uk"
                disabled={status === "submitting"}
                className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none transition disabled:opacity-50 ${
                  websiteError
                    ? "border-red-500 focus:border-red-500"
                    : "border-white/10 focus:border-cyan-500"
                }`}
              />
              {websiteError && (
                <p className="text-red-400 text-xs mt-1">{websiteError}</p>
              )}
            </div>
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-xs font-medium text-white mb-1">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your project..."
              disabled={status === "submitting"}
              rows={4}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50 resize-none"
            />
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-2 pt-1">
            {/* Marketing Consent */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToMarketing}
                onChange={(e) => setConsentToMarketing(e.target.checked)}
                disabled={status === "submitting"}
                className="mt-0.5 rounded border-gray-600 cursor-pointer accent-cyan-500 disabled:opacity-50"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                I consent to marketing emails about newsletters and promotions.
              </span>
            </label>

            {/* GDPR Consent - MANDATORY */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToGDPR}
                onChange={(e) => setConsentToGDPR(e.target.checked)}
                disabled={status === "submitting"}
                className="mt-0.5 rounded border-gray-600 cursor-pointer accent-cyan-500 disabled:opacity-50"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                I understand my data will be processed per GDPR and privacy
                policy. <span className="text-red-400">*</span>
              </span>
            </label>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-400 text-sm"
            >
              <AlertCircle size={18} className="flex-shrink-0" />
              {errorMessage}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold text-sm hover:from-cyan-600 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {status === "submitting" ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </motion.div>
  );
};
