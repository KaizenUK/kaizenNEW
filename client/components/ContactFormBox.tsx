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
      // If on Step 5 and hasWebsite is false, go back to Step 3 (skip Step 4)
      if (currentStep === 5 && hasWebsite === false) {
        setCurrentStep(3);
      } else {
        setCurrentStep((currentStep - 1) as FormStep);
      }
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
        resetForm();
        setTimeout(() => {
          setStatus("idle");
          setCurrentStep(1);
        }, 5000);
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <motion.div
      className="rounded-2xl border border-white/10 bg-gray-900/50 backdrop-blur-sm p-8 hover:border-white/20 transition h-full"
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
        <form className="space-y-3">
          {/* Honeypot Field */}
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

          {/* Step Progress */}
          <div className="flex gap-1.5 mb-8">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded ${
                  step <= currentStep ? "bg-cyan-500" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step 1: Name & Surname */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-white font-semibold mb-5">
                  What do we call you?
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white mb-2">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John"
                      className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white mb-2">
                      Surname
                    </label>
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="Surname"
                      className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Email & Phone */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h4 className="text-white font-semibold mb-5">
                  How do we reach you?
                </h4>
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="name@email.co"
                    className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none transition ${
                      emailError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-cyan-500"
                    }`}
                    autoFocus
                  />
                  {emailError && (
                    <p className="text-red-400 text-xs mt-2">{emailError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="+44"
                    className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none transition ${
                      phoneError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-cyan-500"
                    }`}
                  />
                  {phoneError && (
                    <p className="text-red-400 text-xs mt-2">{phoneError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Website Decision */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <h4 className="text-white font-semibold text-lg">
                  Do you have a website right now?
                </h4>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setHasWebsite(true);
                      // Auto-advance to step 4 (website field)
                      setTimeout(() => setCurrentStep(4), 100);
                    }}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                      hasWebsite === true
                        ? "bg-cyan-500 text-white"
                        : "bg-gray-800/50 text-white/60 hover:bg-gray-800"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasWebsite(false);
                      // Auto-advance to step 5 (message) - skip website field
                      setTimeout(() => setCurrentStep(5), 100);
                    }}
                    className={`flex-1 py-3 rounded-lg font-semibold transition ${
                      hasWebsite === false
                        ? "bg-cyan-500 text-white"
                        : "bg-gray-800/50 text-white/60 hover:bg-gray-800"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Website (if yes) */}
            {currentStep === 4 && hasWebsite && (
              <div className="space-y-4">
                <h4 className="text-white font-semibold mb-5">
                  What's the website?
                </h4>
                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    onBlur={handleWebsiteBlur}
                    placeholder="example.co.uk"
                    className={`w-full bg-gray-800/50 border text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none transition ${
                      websiteError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-cyan-500"
                    }`}
                    autoFocus
                  />
                  {websiteError && (
                    <p className="text-red-400 text-xs mt-2">{websiteError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Message & Consent */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h4 className="text-white font-semibold mb-5">
                  How can we help?
                </h4>
                <div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your project..."
                    rows={4}
                    className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 placeholder:text-xs rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition resize-none"
                    autoFocus
                  />
                </div>

                {/* Consent Checkboxes */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentToMarketing}
                      onChange={(e) => setConsentToMarketing(e.target.checked)}
                      className="mt-1 rounded border-gray-600 cursor-pointer accent-cyan-500"
                    />
                    <span className="text-xs text-white/70 leading-relaxed">
                      I consent to marketing emails about newsletters and promotions.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentToGDPR}
                      onChange={(e) => setConsentToGDPR(e.target.checked)}
                      className="mt-1 rounded border-gray-600 cursor-pointer accent-cyan-500"
                    />
                    <span className="text-xs text-white/70 leading-relaxed">
                      I understand my data will be processed per GDPR and privacy
                      policy. <span className="text-red-400">*</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </motion.div>

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

          {/* Buttons */}
          <div className="flex gap-3 mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNextStep}
              disabled={status === "submitting"}
              className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold text-sm hover:from-cyan-600 hover:to-cyan-700 transition disabled:opacity-50"
            >
              {status === "submitting"
                ? "Sending..."
                : currentStep === 5
                  ? "Send Message"
                  : "Next"}
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
};
