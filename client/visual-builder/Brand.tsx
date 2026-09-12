import React from "react";

/** Shared wordmark, without workspace or authentication dependencies. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`builder-brand${compact ? " builder-brand-compact" : ""}`}>
      <span role="img" aria-label="Kaizen" className="builder-brand-logo" />
      {!compact && <small className="builder-brand-product">Builder</small>}
    </span>
  );
}
