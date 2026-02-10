import type { APIRoute } from "astro";

const PAGESPEED_API_KEY = process.env.VITE_PAGESPEED_API_KEY || "";

export const GET: APIRoute = async ({ url }) => {
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "URL parameter is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!PAGESPEED_API_KEY) {
    return new Response(JSON.stringify({ error: "PageSpeed API key not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
      targetUrl,
    )}&category=PERFORMANCE&strategy=MOBILE&key=${PAGESPEED_API_KEY}`,
  );

  if (!response.ok) {
    const error = await response.json();
    return new Response(
      JSON.stringify({ error: error.error?.message || "Failed to run PageSpeed audit" }),
      {
        status: response.status,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache, no-store, must-revalidate, max-age=0",
      pragma: "no-cache",
      expires: "0",
    },
  });
};
