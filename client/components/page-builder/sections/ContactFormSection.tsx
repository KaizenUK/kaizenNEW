import { useState } from "react";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";
import type { ManagedContactFormSection } from "@shared/pageBuilder";

export default function ContactFormSection({
  heading,
  subtitle,
  fields,
  submitLabel = "Send Message",
  successMessage = "Thanks! We'll be in touch shortly.",
  actionUrl,
  settings,
}: ManagedContactFormSection) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = String(value);
    });

    try {
      const url = actionUrl?.trim() || "/api/contact";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Submission failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-4 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      {subtitle && (
        <p className="mx-auto mb-10 max-w-2xl text-center text-lg text-gray-400">
          {subtitle}
        </p>
      )}

      {status === "success" ? (
        <div className="mx-auto max-w-md rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-8 text-center">
          <p className="text-lg font-medium text-cyan-200">{successMessage}</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-xl space-y-5"
        >
          {(fields || []).map((field) => {
            const id = `form-${field._key}`;
            const baseInputClass =
              "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30";

            return (
              <div key={field._key}>
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-300">
                  {field.label}
                  {field.required && <span className="ml-0.5 text-cyan-400">*</span>}
                </label>
                {field.fieldType === "textarea" ? (
                  <textarea
                    id={id}
                    name={field.label}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={4}
                    className={baseInputClass}
                  />
                ) : field.fieldType === "select" ? (
                  <select
                    id={id}
                    name={field.label}
                    required={field.required}
                    className={baseInputClass}
                  >
                    <option value="">{field.placeholder || "Select..."}</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    name={field.label}
                    type={field.fieldType}
                    placeholder={field.placeholder}
                    required={field.required}
                    className={baseInputClass}
                  />
                )}
              </div>
            );
          })}

          {status === "error" && (
            <p className="text-sm text-red-400">
              Something went wrong. Please try again.
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(34,211,238,0.35)] transition hover:scale-[1.02] disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : submitLabel}
          </button>
        </form>
      )}
    </SectionWrapper>
  );
}
