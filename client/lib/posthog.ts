type PostHogProperties = Record<
  string,
  string | number | boolean | undefined
>;

type BrowserPostHog = {
  capture: (event: string, properties?: PostHogProperties) => void;
  logger?: {
    info: (message: string, attributes?: PostHogProperties) => void;
  };
};

function getPostHogClient(): BrowserPostHog | undefined {
  if (typeof window === "undefined") return;
  if (!(window as Window & { kaizenAnalyticsAllowed?: boolean }).kaizenAnalyticsAllowed) return;
  return (window as Window & { posthog?: BrowserPostHog }).posthog;
}

export function capturePostHog(
  event: string,
  properties?: PostHogProperties,
) {
  // Analytics must never turn an already saved enquiry into a failed form.
  try {
    getPostHogClient()?.capture(event, properties);
  } catch {
    // A blocked or unavailable tracker does not affect the submission.
  }
}

export function logPostHog(message: string, attributes?: PostHogProperties) {
  try {
    getPostHogClient()?.logger?.info(message, attributes);
  } catch {
    // Logging is optional too.
  }
}
