import React, { useContext } from "react";
import { safeUrl, type Block } from "../../shared/visualBuilder";
import { builderFormEndpoint } from "./formConfig";
import { FormEndpointContext } from "./FormEndpointContext";

export default function ContactBlock({ block }: { block: Block }) {
  const p = block.props,
    id = `kb-contact-${p.id}`;
  const configured = useContext(FormEndpointContext);
  const endpoint = safeUrl(
    configured === undefined ? builderFormEndpoint : configured,
  );
  const field = (
    name: string,
    label: string,
    type: string,
    maxLength: number,
    required = false,
    autoComplete?: string,
  ) => (
    <label
      className={`kb-contact-field kb-contact-${name}`}
      htmlFor={`${id}-${name}`}
    >
      <span>
        {label}
        {required ? " (required)" : ""}
      </span>
      {type === "textarea" ? (
        <textarea
          id={`${id}-${name}`}
          name={name}
          required={required}
          maxLength={maxLength}
          rows={5}
        />
      ) : (
        <input
          id={`${id}-${name}`}
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
      )}
    </label>
  );
  return (
    <div className="kb-contact-inner">
      {p.text && <h2 id={`${id}-heading`}>{p.text}</h2>}
      {typeof p.description === "string" && p.description && (
        <p>{p.description}</p>
      )}
      <form
        data-kb-contact=""
        data-endpoint={endpoint}
        data-success={String(
          p.successMessage || "Thank you. Your message has been received.",
        )}
        aria-label={String(p.label || "Contact us")}
        method="post"
        action={endpoint || undefined}
      >
        <fieldset>
          <legend className="kb-sr-only">
            Your contact details and message
          </legend>
          <div className="kb-contact-fields">
            {field("name", "First name", "text", 100, true, "given-name")}
            {p.showSurname === "yes" &&
              field(
                "last_name",
                "Last name",
                "text",
                100,
                false,
                "family-name",
              )}
            {field("email", "Email", "email", 254, true, "email")}
            {p.showPhone === "yes" &&
              field("phone", "Phone", "tel", 40, false, "tel")}
            {p.showWebsite === "yes" &&
              field("website", "Website", "text", 200, false, "url")}
            {field("message", "Message", "textarea", 5000, true)}
          </div>
          <div className="kb-contact-trap" aria-hidden="true">
            <label htmlFor={`${id}-company-address`}>Leave this empty</label>
            <input
              id={`${id}-company-address`}
              name="company_address"
              tabIndex={-1}
              autoComplete="off"
              maxLength={200}
            />
          </div>
          <label className="kb-contact-check">
            <input type="checkbox" name="consent_to_gdpr" required />
            <span>
              {String(
                p.privacyText ||
                  "I understand my details will be used to respond to this enquiry.",
              )}{" "}
              {safeUrl(p.privacyUrl) && (
                <a href={safeUrl(p.privacyUrl)}>Privacy policy</a>
              )}{" "}
              (required)
            </span>
          </label>
          {p.showMarketing === "yes" && (
            <label className="kb-contact-check">
              <input type="checkbox" name="marketing_consent" />
              <span>
                {String(
                  p.marketingText ||
                    "I would also like to receive news and updates.",
                )}
              </span>
            </label>
          )}
          <button className="kb-contact-submit" type="submit" disabled>
            {String(p.submitLabel || "Send message")}
          </button>
        </fieldset>
        <p
          data-kb-form-status=""
          role="status"
          aria-live="polite"
          tabIndex={-1}
        />
        {!endpoint && (
          <p className="kb-contact-setup">
            This form is not connected yet. Please use another contact method.
          </p>
        )}
        <noscript>
          <p>Enable JavaScript to send this form.</p>
        </noscript>
      </form>
    </div>
  );
}
