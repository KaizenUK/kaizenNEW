import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Check, AlertCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export const ContactFormBox = () => {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [consentToMarketing, setConsentToMarketing] = useState(false);
  const [consentToGDPR, setConsentToGDPR] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Bot Detection: If honeypot field has any value, it's a bot
    if (honeypot.trim()) {
      console.warn("Honeypot field filled - likely a bot submission");
      // Silently fail or show success to confuse bots
      setStatus("success");
      setName("");
      setSurname("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setMessage("");
      setHoneypot("");
      setTimeout(() => setStatus("idle"), 5000);
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Please enter your first name.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

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
        surname: surname.trim() || null,
        email: email.toLowerCase().trim(),
        phone: phone.trim() || null,
        website: website.trim() || null,
        message: message.trim(),
        consent_to_marketing: consentToMarketing,
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
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              disabled={status === "submitting"}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
          </div>

          {/* Surname Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Surname
            </label>
            <input
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Your surname (optional)"
              disabled={status === "submitting"}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={status === "submitting"}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 (optional)"
              disabled={status === "submitting"}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
          </div>

          {/* Website Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Current Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yoursite.com (optional)"
              disabled={status === "submitting"}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
          </div>

          {/* Message Field */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your project..."
              disabled={status === "submitting"}
              rows={5}
              className="w-full bg-gray-800/50 border border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition disabled:opacity-50 resize-none"
            />
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-2">
            {/* Marketing Consent */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToMarketing}
                onChange={(e) => setConsentToMarketing(e.target.checked)}
                disabled={status === "submitting"}
                className="mt-1 rounded border-gray-600 cursor-pointer accent-cyan-500 disabled:opacity-50"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                I consent to receiving marketing emails about newsletters and
                promotions from Kaizen.
              </span>
            </label>

            {/* GDPR Consent - MANDATORY */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToGDPR}
                onChange={(e) => setConsentToGDPR(e.target.checked)}
                disabled={status === "submitting"}
                className="mt-1 rounded border-gray-600 cursor-pointer accent-cyan-500 disabled:opacity-50"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                I understand that my data will be processed and stored in
                accordance with GDPR regulations and our privacy policy.{" "}
                <span className="text-red-400">*</span>
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
            className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold hover:from-cyan-600 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {status === "submitting" ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </motion.div>
  );
};
